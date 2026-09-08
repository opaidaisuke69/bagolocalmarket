<?php
/**
 * GET  /rider/remittance.php             — list rider's remittances + admin QR codes
 * POST /rider/remittance.php             — submit a new remittance receipt
 * GET  /rider/remittance.php?accounts=1  — list rider's payment accounts
 * POST /rider/remittance.php (action=save_account) — save/update a payment account
 * DELETE /rider/remittance.php?account_id=X       — delete a payment account
 */
require_once '../config/cors.php';
require_once '../config/database.php';
require_once '../middleware/auth.php';

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
] as $ddl) {
    try { $db->exec($ddl); } catch (Exception $e) {}
}

// ── Image save helper ─────────────────────────────────────────────────────────
function saveBase64Image($base64, $subfolder) {
    if (empty($base64) || strpos($base64, 'data:') !== 0) return null;
    $parts = explode(',', $base64, 2);
    if (count($parts) < 2) return null;
    $mime = explode(';', explode(':', $parts[0])[1])[0];
    $extMap = ['image/jpeg' => 'jpg', 'image/png' => 'png', 'image/webp' => 'webp', 'image/gif' => 'gif'];
    $ext = isset($extMap[$mime]) ? $extMap[$mime] : 'jpg';
    $dir = __DIR__ . '/../../uploads/' . $subfolder . '/';
    if (!is_dir($dir)) mkdir($dir, 0755, true);
    $filename = uniqid('', true) . '_' . time() . '.' . $ext;
    file_put_contents($dir . $filename, base64_decode($parts[1]));
    return '/uploads/' . $subfolder . '/' . $filename;
}

// ── Payment accounts list ─────────────────────────────────────────────────────
if ($method === 'GET' && isset($_GET['accounts'])) {
    $stmt = $db->prepare("SELECT * FROM rider_payment_accounts WHERE rider_id = ? ORDER BY is_primary DESC, created_at ASC");
    $stmt->execute([$riderId]);
    $accounts = $stmt->fetchAll(PDO::FETCH_ASSOC);
    echo json_encode(["accounts" => $accounts]);
    exit;
}

// ── GET: remittances + admin QR codes ────────────────────────────────────────
if ($method === 'GET') {
    $page   = isset($_GET['page']) ? (int)$_GET['page'] : 1;
    $limit  = 20;
    $offset = ($page - 1) * $limit;

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

    // Admin QR codes (active only)
    $qrStmt = $db->query("SELECT * FROM remittance_qr_codes WHERE is_active = 1 ORDER BY id ASC");
    $qrCodes = $qrStmt->fetchAll(PDO::FETCH_ASSOC);

    // Pending amount (earnings not yet remitted)
    $pendingStmt = $db->prepare(
        "SELECT COALESCE(SUM(o.rider_earning), 0) AS total_pending
         FROM orders o
         JOIN deliveries d ON d.order_id = o.id
         WHERE d.rider_id = ? AND o.status = 'delivered'
           AND o.id NOT IN (
               SELECT DISTINCT ord.id
               FROM rider_remittances rem
               JOIN orders ord ON DATE(ord.updated_at) BETWEEN rem.period_start AND rem.period_end
               WHERE rem.rider_id = ? AND rem.status IN ('pending', 'verified')
           )"
    );
    $pendingStmt->execute([$riderId, $riderId]);
    $pendingAmount = (float)$pendingStmt->fetchColumn();

    echo json_encode([
        "remittances"    => $remittances,
        "total"          => $total,
        "total_pages"    => ceil($total / $limit),
        "qr_codes"       => $qrCodes,
        "pending_amount" => $pendingAmount,
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
    echo json_encode(["message" => "Account removed."]);
    exit;
}

// ── POST ──────────────────────────────────────────────────────────────────────
if ($method === 'POST') {
    $data = json_decode(file_get_contents("php://input"));
    $action = isset($data->action) ? $data->action : 'submit_remittance';

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
            $qrPath = $data->qr_code_image; // already saved path
        }

        $isPrimary = !empty($data->is_primary) ? 1 : 0;

        if ($isPrimary) {
            // Clear existing primary
            $db->prepare("UPDATE rider_payment_accounts SET is_primary=0 WHERE rider_id=?")->execute([$riderId]);
        }

        if (!empty($data->account_id)) {
            // Update existing
            $stmt = $db->prepare(
                "UPDATE rider_payment_accounts
                 SET type=?, label=?, account_name=?, account_number=?,
                     qr_code_image=COALESCE(?, qr_code_image), is_primary=?, updated_at=NOW()
                 WHERE id=? AND rider_id=?"
            );
            $stmt->execute([
                $data->type, $data->label, $data->account_name, $data->account_number,
                $qrPath, $isPrimary, $data->account_id, $riderId
            ]);
            echo json_encode(["message" => "Account updated."]);
        } else {
            $stmt = $db->prepare(
                "INSERT INTO rider_payment_accounts (rider_id, type, label, account_name, account_number, qr_code_image, is_primary)
                 VALUES (?, ?, ?, ?, ?, ?, ?)"
            );
            $stmt->execute([
                $riderId, $data->type, $data->label,
                $data->account_name, $data->account_number, $qrPath, $isPrimary
            ]);
            echo json_encode(["message" => "Account saved.", "id" => (int)$db->lastInsertId()]);
        }
        exit;
    }

    // ── Submit remittance ─────────────────────────────────────────────────────
    if (empty($data->amount) || empty($data->period_start) || empty($data->period_end) || empty($data->receipt_image)) {
        http_response_code(400);
        echo json_encode(["message" => "amount, period_start, period_end, and receipt_image are required."]);
        exit;
    }

    $receiptPath = saveBase64Image($data->receipt_image, 'remittance_receipts');
    if (!$receiptPath) {
        http_response_code(422);
        echo json_encode(["message" => "Failed to save receipt image."]);
        exit;
    }

    $stmt = $db->prepare(
        "INSERT INTO rider_remittances
            (rider_id, amount, period_start, period_end, receipt_image, reference_number, payment_method, notes)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
    );
    $stmt->execute([
        $riderId,
        (float)$data->amount,
        $data->period_start,
        $data->period_end,
        $receiptPath,
        $data->reference_number ?? null,
        $data->payment_method   ?? null,
        $data->notes            ?? null,
    ]);

    // Notify admin
    $adminStmt = $db->query("SELECT id FROM users WHERE role='admin' LIMIT 1");
    $admin = $adminStmt->fetch(PDO::FETCH_ASSOC);
    if ($admin) {
        $riderStmt = $db->prepare("SELECT full_name FROM users WHERE id=?");
        $riderStmt->execute([$riderId]);
        $riderName = $riderStmt->fetchColumn();
        $notif = $db->prepare("INSERT INTO notifications (user_id, title, message, type) VALUES (?,?,?,'remittance')");
        $notif->execute([$admin['id'], 'Remittance Submitted', "Rider $riderName submitted a remittance of ₱" . number_format($data->amount, 2)]);
    }

    http_response_code(201);
    echo json_encode(["message" => "Remittance submitted successfully. Awaiting admin verification."]);
    exit;
}

http_response_code(405);
echo json_encode(["message" => "Method not allowed."]);
