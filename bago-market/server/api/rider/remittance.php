<?php
/**
 * GET  /rider/remittance.php             — list remittances + daily pending breakdown
 * POST /rider/remittance.php             — submit a new remittance receipt
 * GET  /rider/remittance.php?accounts=1  — list rider's payment accounts
 * POST /rider/remittance.php (action=save_account) — save/update a payment account
 * DELETE /rider/remittance.php?account_id=X        — delete a payment account
 *
 * Pending logic (per-order, not per-date-range):
 *   An order is "remitted" only when it has a row in rider_remittance_orders linked to a
 *   non-rejected remittance.  New deliveries on the same date as a prior remittance period
 *   will never be in that junction table and will always appear as pending.
 *   This prevents the bug where remitting once zeroes out fresh collections on the same dates.
 */
require_once '../config/cors.php';
require_once '../config/database.php';
require_once '../middleware/auth.php';
require_once '../config/logger.php';

$database = new Database();
$db       = $database->getConnection();
$auth     = new AuthMiddleware($db);
$payload  = $auth->requireAuth();
$riderId  = $payload['user_id'];
$method   = $_SERVER['REQUEST_METHOD'];

// ── Auto-migrate ──────────────────────────────────────────────────────────────
foreach ([
    "CREATE TABLE IF NOT EXISTS rider_payment_accounts (
        id INT AUTO_INCREMENT PRIMARY KEY,
        rider_id INT NOT NULL,
        type ENUM('gcash','maya','bank','others') NOT NULL DEFAULT 'gcash',
        label VARCHAR(100) NOT NULL,
        account_name VARCHAR(255) NOT NULL,
        account_number VARCHAR(100) NOT NULL,
        qr_code_image VARCHAR(500) NULL,
        is_primary BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (rider_id) REFERENCES users(id) ON DELETE CASCADE,
        INDEX idx_rider (rider_id)
    )",
    "CREATE TABLE IF NOT EXISTS rider_remittances (
        id INT AUTO_INCREMENT PRIMARY KEY,
        rider_id INT NOT NULL,
        amount DECIMAL(10,2) NOT NULL,
        period_start DATE NOT NULL,
        period_end DATE NOT NULL,
        receipt_image VARCHAR(500) NOT NULL,
        reference_number VARCHAR(100) NULL,
        payment_method VARCHAR(100) NULL,
        status ENUM('pending','verified','rejected') DEFAULT 'pending',
        verified_by INT NULL,
        verified_at TIMESTAMP NULL,
        rejection_reason TEXT NULL,
        notes TEXT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (rider_id) REFERENCES users(id),
        INDEX idx_rider (rider_id)
    )",
    "CREATE TABLE IF NOT EXISTS remittance_qr_codes (
        id INT AUTO_INCREMENT PRIMARY KEY,
        label VARCHAR(100) NOT NULL,
        type ENUM('gcash','maya','bank','others') NOT NULL DEFAULT 'gcash',
        account_name VARCHAR(255) NOT NULL,
        account_number VARCHAR(100) NOT NULL,
        qr_code_image VARCHAR(500) NOT NULL,
        is_active BOOLEAN DEFAULT TRUE,
        created_by INT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )",
    // Junction table: exactly which orders were snapshotted into a remittance at submit time.
    // This is the source of truth for coverage — NOT the period_start/period_end date range.
    "CREATE TABLE IF NOT EXISTS rider_remittance_orders (
        id            INT AUTO_INCREMENT PRIMARY KEY,
        remittance_id INT NOT NULL,
        order_id      INT NOT NULL,
        rider_id      INT NOT NULL,
        gross_amount  DECIMAL(10,2) NOT NULL COMMENT 'order total_amount at submission time',
        rider_earning DECIMAL(10,2) NOT NULL COMMENT 'rider_earning at submission time',
        to_remit      DECIMAL(10,2) NOT NULL COMMENT 'gross_amount - rider_earning',
        created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY uq_rem_order (remittance_id, order_id),
        INDEX idx_order  (order_id),
        INDEX idx_rider  (rider_id),
        FOREIGN KEY (remittance_id) REFERENCES rider_remittances(id) ON DELETE CASCADE,
        FOREIGN KEY (order_id)      REFERENCES orders(id)             ON DELETE CASCADE
    )",
] as $ddl) {
    try { $db->exec($ddl); } catch (Exception $e) {}
}

// ── Image save helper ─────────────────────────────────────────────────────────
function saveBase64Image($base64, $subfolder) {
    if (empty($base64) || strpos($base64, 'data:') !== 0) return null;
    $parts = explode(',', $base64, 2);
    if (count($parts) < 2) return null;
    $mime   = explode(';', explode(':', $parts[0])[1])[0];
    $extMap = ['image/jpeg' => 'jpg', 'image/png' => 'png', 'image/webp' => 'webp', 'image/gif' => 'gif'];
    $ext    = $extMap[$mime] ?? 'jpg';
    $dir    = __DIR__ . '/../../uploads/' . $subfolder . '/';
    if (!is_dir($dir)) mkdir($dir, 0755, true);
    $filename = uniqid('', true) . '_' . time() . '.' . $ext;
    file_put_contents($dir . $filename, base64_decode($parts[1]));
    return '/uploads/' . $subfolder . '/' . $filename;
}

// ── Pending breakdown helper ──────────────────────────────────────────────────
/**
 * Returns per-day collections data plus pending_amount.
 *
 * Coverage is determined per-order via rider_remittance_orders:
 *   - If an order has a row in that table linked to a 'pending' or 'verified' remittance
 *     it is covered (not pending).
 *   - Orders that have NO such row are always pending, regardless of their delivery date.
 *
 * Per-day fields:
 *   gross_collected  = SUM(total_amount) for that day's pending orders
 *   my_commission    = SUM(rider_earning) for that day's pending orders
 *   to_remit         = gross_collected - my_commission
 */
function getPendingBreakdown($db, $riderId) {
    // Fetch all delivered orders for this rider, annotated with whether each order
    // is already covered by a non-rejected remittance in the junction table.
    $stmt = $db->prepare(
        "SELECT
            o.id                              AS order_id,
            DATE(d.delivered_at)              AS delivery_date,
            o.total_amount                    AS gross_amount,
            COALESCE(o.rider_earning, 0)      AS rider_earning,
            o.total_amount - COALESCE(o.rider_earning, 0) AS to_remit,
            -- covered = 1 if a non-rejected remittance owns this order
            CASE WHEN rro.id IS NOT NULL THEN 1 ELSE 0 END AS is_covered,
            rr.status                         AS covered_by_status
         FROM orders o
         JOIN deliveries d ON d.order_id = o.id
         LEFT JOIN rider_remittance_orders rro
               ON rro.order_id = o.id
              AND rro.rider_id = d.rider_id
         LEFT JOIN rider_remittances rr
               ON rr.id = rro.remittance_id
              AND rr.status IN ('pending', 'verified')
              AND rr.rider_id = d.rider_id
         WHERE d.rider_id = ?
           AND o.status = 'delivered'
           AND d.delivered_at IS NOT NULL
         ORDER BY delivery_date DESC, o.id ASC"
    );
    $stmt->execute([$riderId]);
    $orders = $stmt->fetchAll(PDO::FETCH_ASSOC);

    // Group orders by delivery_date
    $dayMap = [];
    foreach ($orders as $row) {
        $date = $row['delivery_date'];
        if (!isset($dayMap[$date])) {
            $dayMap[$date] = [
                'delivery_date'   => $date,
                'deliveries'      => 0,
                'gross_collected' => 0.0,
                'my_commission'   => 0.0,
                'to_remit'        => 0.0,
                'is_pending'      => false,
                'covered_by'      => null,
                // For pending-only sub-totals
                'pending_orders'  => [],
                // For status display: did this day have at least one covered order?
                '_any_covered'    => false,
                '_any_pending'    => false,
                '_covered_status' => null,
            ];
        }

        $dayMap[$date]['deliveries']++;
        $dayMap[$date]['gross_collected'] += (float)$row['gross_amount'];
        $dayMap[$date]['my_commission']   += (float)$row['rider_earning'];
        $dayMap[$date]['to_remit']        += (float)$row['to_remit'];

        if (!(int)$row['is_covered']) {
            $dayMap[$date]['_any_pending']   = true;
            $dayMap[$date]['pending_orders'][] = (int)$row['order_id'];
        } else {
            $dayMap[$date]['_any_covered']   = true;
            // Track the status of what covered it (for display)
            if (!$dayMap[$date]['_covered_status']) {
                $dayMap[$date]['_covered_status'] = $row['covered_by_status'];
            }
        }
    }

    // Now build the per-day summaries, separating pending from covered orders
    // For each day, we need two views:
    //   all_days  — full totals for history display
    //   pending_days — only the pending orders on that day
    $allDays     = [];
    $pendingDays = [];
    $pendingAmount = 0.0;

    foreach ($dayMap as $date => $day) {
        $hasPending = $day['_any_pending'];

        // For is_pending on a day: true if ANY order that day is still unremitted
        $day['is_pending'] = $hasPending;
        // covered_by: show 'verified'/'pending' only if ALL orders that day are covered
        $day['covered_by'] = (!$hasPending && $day['_any_covered'])
            ? $day['_covered_status']
            : null;

        // Clean internal keys before sending to client
        $pendingOrderIds = $day['pending_orders'];
        unset($day['pending_orders'], $day['_any_covered'], $day['_any_pending'], $day['_covered_status']);

        $allDays[] = $day;

        if ($hasPending) {
            // Re-query the pending-only subtotals for this day
            // (only count orders that are NOT covered)
            $pendingGross      = 0.0;
            $pendingCommission = 0.0;

            foreach ($orders as $row) {
                if ($row['delivery_date'] === $date && !(int)$row['is_covered']) {
                    $pendingGross      += (float)$row['gross_amount'];
                    $pendingCommission += (float)$row['rider_earning'];
                }
            }

            $pendingToRemit = $pendingGross - $pendingCommission;
            $pendingAmount += $pendingToRemit;

            $pendingDays[] = [
                'delivery_date'   => $date,
                'deliveries'      => count($pendingOrderIds),
                'gross_collected' => round($pendingGross,      2),
                'my_commission'   => round($pendingCommission, 2),
                'to_remit'        => round($pendingToRemit,    2),
                'order_ids'       => $pendingOrderIds, // sent to client for submit
                'is_pending'      => true,
                'covered_by'      => null,
            ];
        }
    }

    return [
        'pending_amount' => round($pendingAmount, 2),
        'pending_days'   => $pendingDays,
        'all_days'       => $allDays,
    ];
}

// ── Payment accounts list ─────────────────────────────────────────────────────
if ($method === 'GET' && isset($_GET['accounts'])) {
    $stmt = $db->prepare(
        "SELECT * FROM rider_payment_accounts WHERE rider_id = ? ORDER BY is_primary DESC, created_at ASC"
    );
    $stmt->execute([$riderId]);
    echo json_encode(["accounts" => $stmt->fetchAll(PDO::FETCH_ASSOC)]);
    exit;
}

// ── GET: remittances + admin QR codes + pending breakdown ────────────────────
if ($method === 'GET') {
    $page   = isset($_GET['page']) ? (int)$_GET['page'] : 1;
    $limit  = 20;
    $offset = ($page - 1) * $limit;

    // Remittance history
    $stmt = $db->prepare(
        "SELECT r.*, u.full_name AS verified_by_name
         FROM rider_remittances r
         LEFT JOIN users u ON r.verified_by = u.id
         WHERE r.rider_id = ?
         ORDER BY r.created_at DESC
         LIMIT $limit OFFSET $offset"
    );
    $stmt->execute([$riderId]);
    $remittances = $stmt->fetchAll(PDO::FETCH_ASSOC);

    $countStmt = $db->prepare("SELECT COUNT(*) FROM rider_remittances WHERE rider_id = ?");
    $countStmt->execute([$riderId]);
    $total = (int)$countStmt->fetchColumn();

    // Admin QR codes
    $qrStmt  = $db->query("SELECT * FROM remittance_qr_codes WHERE is_active = 1 ORDER BY id ASC");
    $qrCodes = $qrStmt->fetchAll(PDO::FETCH_ASSOC);

    // Pending breakdown (per-order coverage model)
    $breakdown = getPendingBreakdown($db, $riderId);

    echo json_encode([
        "remittances"    => $remittances,
        "total"          => $total,
        "total_pages"    => ceil($total / $limit),
        "qr_codes"       => $qrCodes,
        "pending_amount" => $breakdown['pending_amount'],
        "pending_days"   => $breakdown['pending_days'],
        "all_days"       => $breakdown['all_days'],
    ]);
    exit;
}

// ── DELETE: remove a payment account ─────────────────────────────────────────
if ($method === 'DELETE') {
    $accountId = isset($_GET['account_id']) ? (int)$_GET['account_id'] : 0;
    if ($accountId === 0) {
        http_response_code(400);
        echo json_encode(["message" => "account_id is required."]);
        exit;
    }
    $stmt = $db->prepare("DELETE FROM rider_payment_accounts WHERE id = ? AND rider_id = ?");
    $stmt->execute([$accountId, $riderId]);
    log_activity($db, $riderId, 'delete_payment_account', 'rider', $riderId,
        "Rider deleted payment account #$accountId");
    echo json_encode(["message" => "Account removed."]);
    exit;
}

// ── POST ──────────────────────────────────────────────────────────────────────
if ($method === 'POST') {
    $data   = json_decode(file_get_contents("php://input"));
    $action = $data->action ?? 'submit_remittance';

    // ── Save payment account ──────────────────────────────────────────────────
    if ($action === 'save_account') {
        if (empty($data->type) || empty($data->label) || empty($data->account_name) || empty($data->account_number)) {
            http_response_code(400);
            echo json_encode(["message" => "type, label, account_name, and account_number are required."]);
            exit;
        }

        $qrPath = null;
        if (!empty($data->qr_code_image) && strpos($data->qr_code_image, 'data:') === 0) {
            $qrPath = saveBase64Image($data->qr_code_image, 'rider_qr_codes');
        } elseif (!empty($data->qr_code_image) && strpos($data->qr_code_image, '/uploads/') === 0) {
            $qrPath = $data->qr_code_image;
        }

        $isPrimary = !empty($data->is_primary) ? 1 : 0;
        if ($isPrimary) {
            $db->prepare("UPDATE rider_payment_accounts SET is_primary=0 WHERE rider_id=?")->execute([$riderId]);
        }

        if (!empty($data->account_id)) {
            $stmt = $db->prepare(
                "UPDATE rider_payment_accounts
                 SET type=?, label=?, account_name=?, account_number=?,
                     qr_code_image=COALESCE(?, qr_code_image), is_primary=?, updated_at=NOW()
                 WHERE id=? AND rider_id=?"
            );
            $stmt->execute([
                $data->type, $data->label, $data->account_name, $data->account_number,
                $qrPath, $isPrimary, $data->account_id, $riderId,
            ]);
            log_activity($db, $riderId, 'update_payment_account', 'rider', $riderId,
                "Rider updated payment account #{$data->account_id} ({$data->type}: {$data->label})");
            echo json_encode(["message" => "Account updated."]);
        } else {
            $stmt = $db->prepare(
                "INSERT INTO rider_payment_accounts
                    (rider_id, type, label, account_name, account_number, qr_code_image, is_primary)
                 VALUES (?, ?, ?, ?, ?, ?, ?)"
            );
            $stmt->execute([
                $riderId, $data->type, $data->label,
                $data->account_name, $data->account_number, $qrPath, $isPrimary,
            ]);
            $newAccId = (int)$db->lastInsertId();
            log_activity($db, $riderId, 'add_payment_account', 'rider', $riderId,
                "Rider added payment account ({$data->type}: {$data->label})");
            echo json_encode(["message" => "Account saved.", "id" => $newAccId]);
        }
        exit;
    }

    // ── Submit remittance ─────────────────────────────────────────────────────
    if (empty($data->amount) || empty($data->receipt_image)) {
        http_response_code(400);
        echo json_encode(["message" => "amount and receipt_image are required."]);
        exit;
    }

    // Get the current pending breakdown — this is the authoritative list of what needs remitting
    $breakdown = getPendingBreakdown($db, $riderId);

    if ($breakdown['pending_amount'] <= 0 || empty($breakdown['pending_days'])) {
        http_response_code(400);
        echo json_encode(["message" => "No pending collections to remit."]);
        exit;
    }

    // Collect all pending order IDs across all pending days
    $allPendingOrderIds = [];
    foreach ($breakdown['pending_days'] as $day) {
        foreach ($day['order_ids'] as $oid) {
            $allPendingOrderIds[] = (int)$oid;
        }
    }

    if (empty($allPendingOrderIds)) {
        http_response_code(400);
        echo json_encode(["message" => "No pending orders found."]);
        exit;
    }

    // Derive period from pending days (min/max delivery dates)
    $dates       = array_column($breakdown['pending_days'], 'delivery_date');
    $periodStart = min($dates);
    $periodEnd   = max($dates);

    $receiptPath = saveBase64Image($data->receipt_image, 'remittance_receipts');
    if (!$receiptPath) {
        http_response_code(422);
        echo json_encode(["message" => "Failed to save receipt image."]);
        exit;
    }

    try {
        $db->beginTransaction();

        // Insert remittance record
        $stmt = $db->prepare(
            "INSERT INTO rider_remittances
                (rider_id, amount, period_start, period_end, receipt_image,
                 reference_number, payment_method, notes)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
        );
        $stmt->execute([
            $riderId,
            (float)$data->amount,
            $periodStart,
            $periodEnd,
            $receiptPath,
            $data->reference_number ?? null,
            $data->payment_method   ?? null,
            $data->notes            ?? null,
        ]);
        $remittanceId = (int)$db->lastInsertId();

        // Snapshot exactly which orders are being remitted right now
        // by inserting into the junction table.
        $jStmt = $db->prepare(
            "INSERT IGNORE INTO rider_remittance_orders
                (remittance_id, order_id, rider_id, gross_amount, rider_earning, to_remit)
             SELECT ?, o.id, d.rider_id,
                    o.total_amount,
                    COALESCE(o.rider_earning, 0),
                    o.total_amount - COALESCE(o.rider_earning, 0)
             FROM orders o
             JOIN deliveries d ON d.order_id = o.id
             WHERE o.id = ? AND d.rider_id = ? AND o.status = 'delivered'"
        );

        foreach ($allPendingOrderIds as $orderId) {
            $jStmt->execute([$remittanceId, $orderId, $riderId]);
        }

        // Notify admin
        $adminStmt = $db->query("SELECT id FROM users WHERE role='admin' LIMIT 1");
        $admin     = $adminStmt->fetch(PDO::FETCH_ASSOC);
        if ($admin) {
            $riderStmt = $db->prepare("SELECT full_name FROM users WHERE id=?");
            $riderStmt->execute([$riderId]);
            $riderName = $riderStmt->fetchColumn();
            $notif = $db->prepare(
                "INSERT INTO notifications (user_id, title, message, type) VALUES (?,?,?,'remittance')"
            );
            $notif->execute([
                $admin['id'],
                'Remittance Submitted',
                "Rider $riderName submitted a remittance of ₱" . number_format((float)$data->amount, 2)
                    . " (" . count($allPendingOrderIds) . " orders, {$periodStart} – {$periodEnd})",
            ]);
        }

        $db->commit();
    } catch (Exception $e) {
        $db->rollBack();
        http_response_code(500);
        echo json_encode(["message" => "Failed to submit remittance: " . $e->getMessage()]);
        exit;
    }

    log_activity($db, $riderId, 'submit_remittance', 'remittance', $remittanceId,
        "Rider submitted remittance of ₱" . number_format((float)$data->amount, 2) .
        " (" . count($allPendingOrderIds) . " orders, $periodStart – $periodEnd)");

    http_response_code(201);
    echo json_encode([
        "message" => "Remittance submitted successfully. Awaiting admin verification.",
    ]);
    exit;
}

http_response_code(405);
echo json_encode(["message" => "Method not allowed."]);
