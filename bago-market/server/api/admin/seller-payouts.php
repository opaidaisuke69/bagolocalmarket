<?php
/**
 * Admin Seller Payout API
 *
 * GET    ?action=summary                              — pending earnings per seller
 * GET    ?action=payouts[&seller_id=][&status=][&page=][&search=]
 * GET    ?action=seller_accounts&seller_id=           — seller remittance accounts
 * POST                                                — create / distribute payout
 * PUT                                                 — release | processing | cancel | update_details
 * DELETE ?payout_id=                                 — delete a cancelled payout
 *
 * Payout math (per seller, per order):
 *   gross_amount     = SUM(oi.item_subtotal)       — seller revenue (price × qty)
 *   commission_amount= SUM(oi.commission_amount)   — platform 2%, already stored at order time
 *   net_amount       = gross_amount - commission_amount  — what the seller receives
 */

require_once '../config/cors.php';
require_once '../config/database.php';
require_once '../middleware/auth.php';
require_once '../config/logger.php';

$database = new Database();
$db       = $database->getConnection();
$auth     = new AuthMiddleware($db);
$payload  = $auth->requireRole(['admin']);

$method = $_SERVER['REQUEST_METHOD'];

// ── Auto-migrate ──────────────────────────────────────────────────────────────
foreach ([
    "CREATE TABLE IF NOT EXISTS seller_remittance_accounts (
        id             INT AUTO_INCREMENT PRIMARY KEY,
        seller_id      INT NOT NULL,
        type           ENUM('gcash','maya','bank','others') NOT NULL DEFAULT 'gcash',
        label          VARCHAR(100)  NOT NULL,
        account_name   VARCHAR(255)  NOT NULL,
        account_number VARCHAR(100)  NOT NULL,
        bank_name      VARCHAR(150)  NULL,
        qr_code_image  VARCHAR(500)  NULL,
        is_primary     BOOLEAN NOT NULL DEFAULT FALSE,
        is_active      BOOLEAN NOT NULL DEFAULT TRUE,
        created_at     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (seller_id) REFERENCES users(id) ON DELETE CASCADE,
        INDEX idx_seller (seller_id)
    )",
    "CREATE TABLE IF NOT EXISTS seller_payouts (
        id                   INT AUTO_INCREMENT PRIMARY KEY,
        seller_id            INT           NOT NULL,
        payout_period_start  DATE          NOT NULL,
        payout_period_end    DATE          NOT NULL,
        gross_amount         DECIMAL(12,2) NOT NULL DEFAULT 0.00,
        commission_amount    DECIMAL(12,2) NOT NULL DEFAULT 0.00,
        net_amount           DECIMAL(12,2) NOT NULL DEFAULT 0.00,
        order_count          INT           NOT NULL DEFAULT 0,
        remittance_account_id INT          NULL,
        payment_method       VARCHAR(100)  NULL,
        reference_number     VARCHAR(150)  NULL,
        receipt_image        VARCHAR(500)  NULL,
        status               ENUM('pending','processing','released','cancelled') NOT NULL DEFAULT 'pending',
        notes                TEXT          NULL,
        created_by           INT           NOT NULL,
        released_by          INT           NULL,
        released_at          TIMESTAMP     NULL,
        created_at           TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at           TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (seller_id)  REFERENCES users(id),
        FOREIGN KEY (created_by) REFERENCES users(id),
        INDEX idx_seller (seller_id),
        INDEX idx_status (status)
    )",
    "CREATE TABLE IF NOT EXISTS seller_payout_orders (
        id        INT AUTO_INCREMENT PRIMARY KEY,
        payout_id INT NOT NULL,
        order_id  INT NOT NULL,
        UNIQUE KEY uq_payout_order (payout_id, order_id),
        FOREIGN KEY (payout_id) REFERENCES seller_payouts(id) ON DELETE CASCADE,
        FOREIGN KEY (order_id)  REFERENCES orders(id)
    )",
] as $ddl) {
    try { $db->exec($ddl); } catch (Exception $e) {}
}

// ── Helper: save base64 image ─────────────────────────────────────────────────
function saveBase64Image($base64, $subdir) {
    if (empty($base64) || strpos($base64, 'data:') !== 0) return null;
    [$meta, $raw] = explode(',', $base64, 2);
    $mime  = explode(';', explode(':', $meta)[1])[0];
    $extMap = ['image/jpeg' => 'jpg', 'image/png' => 'png', 'image/webp' => 'webp'];
    $ext   = $extMap[$mime] ?? 'jpg';
    $dir   = __DIR__ . '/../../uploads/' . $subdir . '/';
    if (!is_dir($dir)) mkdir($dir, 0755, true);
    $fn = uniqid('', true) . '_' . time() . '.' . $ext;
    file_put_contents($dir . $fn, base64_decode($raw));
    return '/uploads/' . $subdir . '/' . $fn;
}

// ── Helper: calculate pending amounts for one seller ─────────────────────────
// Returns [ gross, commission, net, order_count, order_ids[], earliest, latest ]
// Only counts delivered orders not already covered by a non-cancelled payout.
function calcPendingForSeller($db, $sellerId) {
    $stmt = $db->prepare(
        "SELECT
            o.id                                                AS order_id,
            COALESCE(SUM(oi.item_subtotal),    0)              AS order_gross,
            COALESCE(SUM(oi.commission_amount),0)              AS order_commission,
            o.created_at
         FROM orders o
         JOIN order_items oi ON oi.order_id = o.id AND oi.seller_id = ?
         WHERE o.status = 'delivered'
           AND o.id NOT IN (
               SELECT spo.order_id
               FROM seller_payout_orders spo
               JOIN seller_payouts py ON py.id = spo.payout_id
               WHERE py.seller_id = ? AND py.status != 'cancelled'
           )
         GROUP BY o.id, o.created_at
         ORDER BY o.created_at ASC"
    );
    $stmt->execute([$sellerId, $sellerId]);
    $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

    $gross      = 0.0;
    $commission = 0.0;
    $orderIds   = [];
    $earliest   = null;
    $latest     = null;

    foreach ($rows as $r) {
        $gross      += (float)$r['order_gross'];
        $commission += (float)$r['order_commission'];
        $orderIds[]  = (int)$r['order_id'];
        if ($earliest === null) $earliest = $r['created_at'];
        $latest = $r['created_at'];
    }

    return [
        'gross'       => round($gross, 2),
        'commission'  => round($commission, 2),
        'net'         => round($gross - $commission, 2),
        'order_count' => count($orderIds),
        'order_ids'   => $orderIds,
        'earliest'    => $earliest,
        'latest'      => $latest,
    ];
}

// =============================================================================
// GET
// =============================================================================
if ($method === 'GET') {
    $action = $_GET['action'] ?? 'summary';

    // ── Pending earnings summary per seller ───────────────────────────────────
    if ($action === 'summary') {

        // Get all sellers who have at least one delivered, unpaid order
        $sellerStmt = $db->query(
            "SELECT DISTINCT
                sp.user_id       AS seller_id,
                sp.store_name,
                u.full_name      AS seller_name,
                u.email          AS seller_email,
                u.contact_number AS seller_contact,
                -- primary remittance account
                sra.id           AS payout_account_id,
                sra.type         AS payout_type,
                sra.label        AS payout_label,
                sra.account_name AS payout_account_name,
                sra.account_number AS payout_account_number,
                sra.bank_name    AS payout_bank_name
             FROM seller_profiles sp
             JOIN users u ON u.id = sp.user_id AND u.deleted_at IS NULL
             JOIN order_items oi ON oi.seller_id = sp.user_id
             JOIN orders o ON o.id = oi.order_id AND o.status = 'delivered'
             LEFT JOIN seller_remittance_accounts sra
                    ON sra.seller_id = sp.user_id AND sra.is_primary = 1 AND sra.is_active = 1
             WHERE oi.order_id NOT IN (
                 SELECT spo.order_id
                 FROM seller_payout_orders spo
                 JOIN seller_payouts py ON py.id = spo.payout_id
                 WHERE py.seller_id = sp.user_id AND py.status != 'cancelled'
             )"
        );
        $sellers = $sellerStmt->fetchAll(PDO::FETCH_ASSOC);

        // For each seller, compute exact amounts from order_items
        $totalGross = 0; $totalCommission = 0; $totalNet = 0; $totalOrders = 0;

        foreach ($sellers as &$s) {
            $calc = calcPendingForSeller($db, $s['seller_id']);
            $s['gross_amount']      = $calc['gross'];
            $s['commission_amount'] = $calc['commission'];
            $s['net_amount']        = $calc['net'];
            $s['order_count']       = $calc['order_count'];
            $s['earliest_order']    = $calc['earliest'];
            $s['latest_order']      = $calc['latest'];

            $totalGross      += $calc['gross'];
            $totalCommission += $calc['commission'];
            $totalNet        += $calc['net'];
            $totalOrders     += $calc['order_count'];
        }
        unset($s);

        // Sort by net descending
        usort($sellers, fn($a, $b) => $b['net_amount'] <=> $a['net_amount']);

        // Filter out zero-net sellers (edge case: all items had 0 subtotal)
        $sellers = array_values(array_filter($sellers, fn($s) => $s['order_count'] > 0));

        $totals = [
            'total_sellers'    => count($sellers),
            'total_gross'      => round($totalGross, 2),
            'total_commission' => round($totalCommission, 2),
            'total_net'        => round($totalNet, 2),
            'total_orders'     => $totalOrders,
        ];

        echo json_encode(['sellers' => $sellers, 'totals' => $totals]);
        exit;
    }

    // ── Seller remittance accounts ────────────────────────────────────────────
    if ($action === 'seller_accounts') {
        $sellerId = (int)($_GET['seller_id'] ?? 0);
        if (!$sellerId) {
            http_response_code(400);
            echo json_encode(['message' => 'seller_id is required.']);
            exit;
        }
        $stmt = $db->prepare(
            "SELECT * FROM seller_remittance_accounts
             WHERE seller_id = ? AND is_active = 1
             ORDER BY is_primary DESC, created_at ASC"
        );
        $stmt->execute([$sellerId]);
        echo json_encode(['accounts' => $stmt->fetchAll(PDO::FETCH_ASSOC)]);
        exit;
    }

    // ── Payout history list ───────────────────────────────────────────────────
    if ($action === 'payouts') {
        $page     = max(1, (int)($_GET['page'] ?? 1));
        $limit    = 20;
        $offset   = ($page - 1) * $limit;
        $sellerId = isset($_GET['seller_id']) ? (int)$_GET['seller_id'] : 0;
        $status   = $_GET['status'] ?? '';
        $search   = $_GET['search'] ?? '';

        $where = '1=1'; $params = [];
        if ($sellerId) { $where .= ' AND py.seller_id = ?'; $params[] = $sellerId; }
        if ($status)   { $where .= ' AND py.status = ?';    $params[] = $status; }
        if ($search) {
            $where .= ' AND (sp.store_name LIKE ? OR u.full_name LIKE ? OR py.reference_number LIKE ?)';
            $like = "%$search%";
            array_push($params, $like, $like, $like);
        }

        $cStmt = $db->prepare(
            "SELECT COUNT(*) FROM seller_payouts py
             JOIN users u ON u.id = py.seller_id
             JOIN seller_profiles sp ON sp.user_id = py.seller_id
             WHERE $where"
        );
        $cStmt->execute($params);
        $total = (int)$cStmt->fetchColumn();

        $stmt = $db->prepare(
            "SELECT
                py.*,
                sp.store_name,
                u.full_name      AS seller_name,
                u.email          AS seller_email,
                u.contact_number AS seller_contact,
                sra.type         AS account_type,
                sra.label        AS account_label,
                sra.account_name AS account_holder,
                sra.account_number,
                sra.bank_name,
                adm.full_name    AS created_by_name,
                rel.full_name    AS released_by_name
             FROM seller_payouts py
             JOIN users u            ON u.id = py.seller_id
             JOIN seller_profiles sp ON sp.user_id = py.seller_id
             LEFT JOIN seller_remittance_accounts sra ON sra.id = py.remittance_account_id
             LEFT JOIN users adm ON adm.id = py.created_by
             LEFT JOIN users rel ON rel.id = py.released_by
             WHERE $where
             ORDER BY py.created_at DESC
             LIMIT $limit OFFSET $offset"
        );
        $stmt->execute($params);
        $payouts = $stmt->fetchAll(PDO::FETCH_ASSOC);

        // Summary stats
        $sStmt = $db->prepare(
            "SELECT
                COALESCE(SUM(CASE WHEN py.status='pending'    THEN py.net_amount END),0) AS pending_amount,
                COALESCE(SUM(CASE WHEN py.status='processing' THEN py.net_amount END),0) AS processing_amount,
                COALESCE(SUM(CASE WHEN py.status='released'   THEN py.net_amount END),0) AS released_amount,
                COUNT(CASE WHEN py.status='pending'    THEN 1 END) AS pending_count,
                COUNT(CASE WHEN py.status='processing' THEN 1 END) AS processing_count,
                COUNT(CASE WHEN py.status='released'   THEN 1 END) AS released_count
             FROM seller_payouts py
             JOIN users u            ON u.id = py.seller_id
             JOIN seller_profiles sp ON sp.user_id = py.seller_id
             WHERE $where"
        );
        $sStmt->execute($params);
        $summary = $sStmt->fetch(PDO::FETCH_ASSOC);

        echo json_encode([
            'payouts'     => $payouts,
            'total'       => $total,
            'total_pages' => (int)ceil($total / $limit),
            'page'        => $page,
            'summary'     => $summary,
        ]);
        exit;
    }

    http_response_code(400);
    echo json_encode(['message' => 'Unknown action.']);
    exit;
}

// =============================================================================
// POST — create / distribute payout
// =============================================================================
if ($method === 'POST') {
    $data = json_decode(file_get_contents('php://input'), true);

    $sellerId = (int)($data['seller_id'] ?? 0);
    if (!$sellerId) {
        http_response_code(400);
        echo json_encode(['message' => 'seller_id is required.']);
        exit;
    }

    // ── Recalculate amounts server-side from actual order_items ──────────────
    // Never trust the frontend for financial figures.
    $calc = calcPendingForSeller($db, $sellerId);

    if ($calc['order_count'] === 0) {
        http_response_code(400);
        echo json_encode(['message' => 'No unpaid delivered orders found for this seller.']);
        exit;
    }

    $gross      = $calc['gross'];
    $commission = $calc['commission'];
    $net        = $calc['net'];
    $orderCount = $calc['order_count'];
    $orderIds   = $calc['order_ids'];

    // Period: span of the included orders
    $periodStart = $data['payout_period_start'] ?? ($calc['earliest'] ? substr($calc['earliest'], 0, 10) : date('Y-m-d'));
    $periodEnd   = $data['payout_period_end']   ?? ($calc['latest']   ? substr($calc['latest'],   0, 10) : date('Y-m-d'));

    $accountId  = !empty($data['remittance_account_id']) ? (int)$data['remittance_account_id'] : null;
    $payMethod  = $data['payment_method']   ?? null;
    $refNum     = $data['reference_number'] ?? null;
    $notes      = $data['notes']            ?? null;
    $status     = in_array($data['status'] ?? '', ['pending','processing','released'])
                  ? $data['status'] : 'pending';

    $receiptPath = null;
    if (!empty($data['receipt_image'])) {
        $receiptPath = saveBase64Image($data['receipt_image'], 'seller_payout_receipts');
    }

    // Auto-resolve primary account when none specified
    if (!$accountId) {
        $accStmt = $db->prepare(
            "SELECT id FROM seller_remittance_accounts
             WHERE seller_id = ? AND is_primary = 1 AND is_active = 1 LIMIT 1"
        );
        $accStmt->execute([$sellerId]);
        $accRow = $accStmt->fetch(PDO::FETCH_ASSOC);
        if ($accRow) $accountId = (int)$accRow['id'];
    }

    // Auto-fill payment method label from account
    if ($accountId && !$payMethod) {
        $accStmt = $db->prepare("SELECT label FROM seller_remittance_accounts WHERE id = ?");
        $accStmt->execute([$accountId]);
        $accRow = $accStmt->fetch(PDO::FETCH_ASSOC);
        if ($accRow) $payMethod = $accRow['label'];
    }

    try {
        $db->beginTransaction();

        $releasedBy = $status === 'released' ? $payload['user_id'] : null;
        $releasedAt = $status === 'released' ? date('Y-m-d H:i:s') : null;

        $ins = $db->prepare(
            "INSERT INTO seller_payouts
                (seller_id, payout_period_start, payout_period_end,
                 gross_amount, commission_amount, net_amount, order_count,
                 remittance_account_id, payment_method, reference_number,
                 receipt_image, status, notes, created_by, released_by, released_at)
             VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)"
        );
        $ins->execute([
            $sellerId, $periodStart, $periodEnd,
            $gross, $commission, $net, $orderCount,
            $accountId, $payMethod, $refNum,
            $receiptPath, $status, $notes,
            $payload['user_id'], $releasedBy, $releasedAt,
        ]);
        $payoutId = (int)$db->lastInsertId();

        // Link the exact orders included in this payout
        $insOrder = $db->prepare(
            "INSERT IGNORE INTO seller_payout_orders (payout_id, order_id) VALUES (?, ?)"
        );
        foreach ($orderIds as $oid) {
            $insOrder->execute([$payoutId, $oid]);
        }

        // Notify seller
        try {
            $msg = sprintf(
                "A payout of ₱%s (net after 2%% commission) has been initiated for %d orders (%s to %s).",
                number_format($net, 2), $orderCount, $periodStart, $periodEnd
            );
            $db->prepare(
                "INSERT INTO notifications (user_id, title, message, type)
                 VALUES (?, 'Payout Initiated', ?, 'payout')"
            )->execute([$sellerId, $msg]);
        } catch (Exception $e) {}

        // Admin log
        try {
            $db->prepare(
                "INSERT INTO admin_logs (admin_id, action, target_type, target_id, details, ip_address)
                 VALUES (?, 'create_payout', 'seller', ?, ?, ?)"
            )->execute([
                $payload['user_id'], $sellerId,
                "Payout #$payoutId | Gross ₱$gross | Commission ₱$commission | Net ₱$net | $orderCount orders | $periodStart→$periodEnd | $status",
                $_SERVER['REMOTE_ADDR'] ?? '',
            ]);
        } catch (Exception $e) {}

        $db->commit();

        echo json_encode([
            'message'    => 'Payout created.',
            'payout_id'  => $payoutId,
            'gross'      => $gross,
            'commission' => $commission,
            'net'        => $net,
            'orders'     => $orderCount,
        ]);
    } catch (Exception $e) {
        $db->rollBack();
        http_response_code(500);
        echo json_encode(['message' => 'Failed to create payout: ' . $e->getMessage()]);
    }
    exit;
}

// =============================================================================
// PUT — update payout status / details
// =============================================================================
if ($method === 'PUT') {
    $data     = json_decode(file_get_contents('php://input'), true);
    $payoutId = (int)($data['payout_id'] ?? 0);

    if (!$payoutId) {
        http_response_code(400);
        echo json_encode(['message' => 'payout_id is required.']);
        exit;
    }

    $existing = $db->prepare("SELECT * FROM seller_payouts WHERE id = ?");
    $existing->execute([$payoutId]);
    $payout = $existing->fetch(PDO::FETCH_ASSOC);

    if (!$payout) {
        http_response_code(404);
        echo json_encode(['message' => 'Payout not found.']);
        exit;
    }

    $action = $data['action'] ?? '';

    try {
        $db->beginTransaction();

        if ($action === 'release') {
            $receiptPath = $payout['receipt_image'];
            if (!empty($data['receipt_image']) && strpos($data['receipt_image'], 'data:') === 0) {
                $receiptPath = saveBase64Image($data['receipt_image'], 'seller_payout_receipts');
            }
            $refNum    = $data['reference_number'] ?? $payout['reference_number'];
            $payMethod = $data['payment_method']   ?? $payout['payment_method'];
            $accountId = !empty($data['remittance_account_id'])
                         ? (int)$data['remittance_account_id']
                         : $payout['remittance_account_id'];

            $db->prepare(
                "UPDATE seller_payouts
                 SET status='released', released_by=?, released_at=NOW(),
                     reference_number=?, payment_method=?,
                     receipt_image=COALESCE(?,receipt_image),
                     remittance_account_id=COALESCE(?,remittance_account_id),
                     updated_at=NOW()
                 WHERE id=?"
            )->execute([$payload['user_id'], $refNum, $payMethod, $receiptPath, $accountId, $payoutId]);

            try {
                $msg = sprintf(
                    "Your payout of ₱%s has been released.%s",
                    number_format($payout['net_amount'], 2),
                    $refNum ? " Reference: $refNum." : ''
                );
                $db->prepare(
                    "INSERT INTO notifications (user_id, title, message, type)
                     VALUES (?, 'Payout Released', ?, 'payout')"
                )->execute([$payout['seller_id'], $msg]);
            } catch (Exception $e) {}

            $message = 'Payout marked as released.';

        } elseif ($action === 'processing') {
            $db->prepare(
                "UPDATE seller_payouts SET status='processing', updated_at=NOW() WHERE id=?"
            )->execute([$payoutId]);
            $message = 'Payout marked as processing.';

        } elseif ($action === 'cancel') {
            $db->prepare(
                "UPDATE seller_payouts SET status='cancelled', updated_at=NOW() WHERE id=?"
            )->execute([$payoutId]);
            try {
                $db->prepare(
                    "INSERT INTO notifications (user_id, title, message, type)
                     VALUES (?, 'Payout Cancelled', 'Your pending payout has been cancelled. Please contact support.', 'payout')"
                )->execute([$payout['seller_id']]);
            } catch (Exception $e) {}
            $message = 'Payout cancelled.';

        } elseif ($action === 'update_details') {
            $receiptPath = $payout['receipt_image'];
            if (!empty($data['receipt_image']) && strpos($data['receipt_image'], 'data:') === 0) {
                $receiptPath = saveBase64Image($data['receipt_image'], 'seller_payout_receipts');
            }
            $db->prepare(
                "UPDATE seller_payouts
                 SET reference_number=?, payment_method=?, notes=?,
                     receipt_image=COALESCE(?,receipt_image), updated_at=NOW()
                 WHERE id=?"
            )->execute([
                $data['reference_number'] ?? $payout['reference_number'],
                $data['payment_method']   ?? $payout['payment_method'],
                $data['notes']            ?? $payout['notes'],
                $receiptPath, $payoutId,
            ]);
            $message = 'Payout details updated.';

        } else {
            http_response_code(400);
            echo json_encode(['message' => 'Invalid action. Use: release | processing | cancel | update_details']);
            exit;
        }

        try {
            $db->prepare(
                "INSERT INTO admin_logs (admin_id, action, target_type, target_id, details, ip_address)
                 VALUES (?, ?, 'seller_payout', ?, ?, ?)"
            )->execute([
                $payload['user_id'], "payout_$action", $payoutId,
                "Payout #$payoutId — $action", $_SERVER['REMOTE_ADDR'] ?? '',
            ]);
        } catch (Exception $e) {}

        $db->commit();
        echo json_encode(['message' => $message]);
    } catch (Exception $e) {
        $db->rollBack();
        http_response_code(500);
        echo json_encode(['message' => 'Action failed: ' . $e->getMessage()]);
    }
    exit;
}

// =============================================================================
// DELETE — remove a cancelled payout
// =============================================================================
if ($method === 'DELETE') {
    $payoutId = (int)($_GET['payout_id'] ?? 0);
    if (!$payoutId) {
        http_response_code(400);
        echo json_encode(['message' => 'payout_id required.']);
        exit;
    }

    $check = $db->prepare("SELECT status FROM seller_payouts WHERE id=?");
    $check->execute([$payoutId]);
    $row = $check->fetch(PDO::FETCH_ASSOC);

    if (!$row) { http_response_code(404); echo json_encode(['message' => 'Not found.']); exit; }
    if ($row['status'] !== 'cancelled') {
        http_response_code(400);
        echo json_encode(['message' => 'Only cancelled payouts can be deleted.']);
        exit;
    }

    $db->prepare("DELETE FROM seller_payouts WHERE id=?")->execute([$payoutId]);
    log_activity($db, $payload['user_id'], 'delete_payout', 'payout', $payoutId, "Deleted cancelled payout #$payoutId");
    echo json_encode(['message' => 'Payout deleted.']);
    exit;
}

http_response_code(405);
echo json_encode(['message' => 'Method not allowed.']);
