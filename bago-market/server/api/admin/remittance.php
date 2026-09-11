<?php
/**
 * Admin remittance management
 * GET    — list all rider remittances + QR codes
 * POST   — add/update admin QR code
 * PUT    — verify or reject a remittance
 * DELETE — remove a QR code
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
    "CREATE TABLE IF NOT EXISTS remittance_qr_codes (
        id INT AUTO_INCREMENT PRIMARY KEY,
        label VARCHAR(100) NOT NULL,
        type ENUM('gcash','maya','bank','others') NOT NULL DEFAULT 'gcash',
        account_name VARCHAR(255) NOT NULL,
        account_number VARCHAR(100) NOT NULL,
        qr_code_image VARCHAR(500) NOT NULL DEFAULT '',
        is_active BOOLEAN DEFAULT TRUE,
        created_by INT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
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
] as $ddl) { try { $db->exec($ddl); } catch (Exception $e) {} }

function saveBase64($base64, $sub) {
    if (empty($base64) || strpos($base64, 'data:') !== 0) return null;
    $parts = explode(',', $base64, 2);
    $mime  = explode(';', explode(':', $parts[0])[1])[0];
    $extMap = ['image/jpeg'=>'jpg','image/png'=>'png','image/webp'=>'webp'];
    $ext = $extMap[$mime] ?? 'jpg';
    $dir = __DIR__ . '/../../uploads/' . $sub . '/';
    if (!is_dir($dir)) mkdir($dir, 0755, true);
    $fn = uniqid('',true).'_'.time().'.'.$ext;
    file_put_contents($dir.$fn, base64_decode($parts[1]));
    return '/uploads/'.$sub.'/'.$fn;
}

if ($method === 'GET') {
    $page   = isset($_GET['page']) ? (int)$_GET['page'] : 1;
    $status = $_GET['status'] ?? '';
    $limit  = 20; $offset = ($page-1)*$limit;

    $where = "1=1"; $params = [];
    if (!empty($status)) { $where .= " AND r.status=?"; $params[] = $status; }

    $stmt = $db->prepare(
        "SELECT r.*, u.full_name AS rider_name, u.contact_number AS rider_contact
         FROM rider_remittances r
         JOIN users u ON r.rider_id = u.id
         WHERE $where ORDER BY r.created_at DESC LIMIT $limit OFFSET $offset"
    );
    $stmt->execute($params);
    $remittances = $stmt->fetchAll(PDO::FETCH_ASSOC);

    $total = (int)$db->prepare("SELECT COUNT(*) FROM rider_remittances r WHERE $where")->execute($params) ? 0 : 0;
    $cStmt = $db->prepare("SELECT COUNT(*) FROM rider_remittances r WHERE $where");
    $cStmt->execute($params);
    $total = (int)$cStmt->fetchColumn();

    $qrStmt = $db->query("SELECT * FROM remittance_qr_codes ORDER BY id ASC");
    $qrCodes = $qrStmt->fetchAll(PDO::FETCH_ASSOC);

    $summaryStmt = $db->query(
        "SELECT
            COALESCE(SUM(CASE WHEN status='pending'  THEN amount END),0) AS pending,
            COALESCE(SUM(CASE WHEN status='verified' THEN amount END),0) AS verified,
            COUNT(CASE WHEN status='pending' THEN 1 END)                 AS pending_count
         FROM rider_remittances"
    );
    $summary = $summaryStmt->fetch(PDO::FETCH_ASSOC);

    // ── Per-remittance seller distributions ───────────────────────────────────
    // Join through rider_remittance_orders (junction table) so only the exact orders
    // snapshotted into this remittance are counted — not all orders in the date range.
    foreach ($remittances as &$rem) {
        $distStmt = $db->prepare(
            "SELECT
                sp.store_name,
                sp.user_id AS seller_id,
                COUNT(DISTINCT o.id)               AS order_count,
                COALESCE(SUM(oi.item_subtotal), 0) AS seller_subtotal,
                COALESCE(SUM(oi.item_total),    0) AS seller_total
             FROM rider_remittance_orders rro
             JOIN orders o       ON o.id  = rro.order_id
             JOIN order_items oi ON oi.order_id = o.id
             LEFT JOIN seller_profiles sp ON sp.user_id = oi.seller_id
             WHERE rro.remittance_id = ?
             GROUP BY oi.seller_id, sp.store_name
             ORDER BY seller_subtotal DESC"
        );
        $distStmt->execute([$rem['id']]);
        $rem['seller_distributions'] = $distStmt->fetchAll(PDO::FETCH_ASSOC);
    }
    unset($rem);

    // ── Overall seller distribution (across all remittances in current filter) ─
    $overallParams = $params; // same status filter
    $overallWhere  = str_replace('r.status', 'rr.status', $where); // alias for sub-query
    $overallStmt   = $db->prepare(
        "SELECT
            sp.store_name,
            sp.user_id AS seller_id,
            COUNT(DISTINCT o.id)               AS order_count,
            COALESCE(SUM(oi.item_subtotal), 0) AS seller_subtotal,
            COALESCE(SUM(oi.item_total),    0) AS seller_total
         FROM rider_remittances rr
         JOIN rider_remittance_orders rro ON rro.remittance_id = rr.id
         JOIN orders o       ON o.id  = rro.order_id
         JOIN order_items oi ON oi.order_id = o.id
         LEFT JOIN seller_profiles sp ON sp.user_id = oi.seller_id
         WHERE $overallWhere
         GROUP BY oi.seller_id, sp.store_name
         ORDER BY seller_subtotal DESC"
    );
    $overallStmt->execute($overallParams);
    $overallDistributions = $overallStmt->fetchAll(PDO::FETCH_ASSOC);

    echo json_encode([
        "remittances"          => $remittances,
        "total"                => $total,
        "total_pages"          => ceil($total / $limit),
        "qr_codes"             => $qrCodes,
        "summary"              => $summary,
        "overall_distributions"=> $overallDistributions,
    ]);
    exit;
}

if ($method === 'POST') {
    $data = json_decode(file_get_contents("php://input"));
    // Add / update QR code
    if (empty($data->label) || empty($data->account_name) || empty($data->account_number)) {
        http_response_code(400);
        echo json_encode(["message" => "label, account_name, and account_number are required."]);
        exit;
    }
    $qrPath = null;
    if (!empty($data->qr_code_image) && strpos($data->qr_code_image, 'data:') === 0) {
        $qrPath = saveBase64($data->qr_code_image, 'admin_qr_codes');
    }

    if (!empty($data->id)) {
        $stmt = $db->prepare("UPDATE remittance_qr_codes SET label=?,type=?,account_name=?,account_number=?,qr_code_image=COALESCE(?,qr_code_image),is_active=? WHERE id=?");
        $stmt->execute([$data->label,$data->type??'gcash',$data->account_name,$data->account_number,$qrPath,$data->is_active??1,$data->id]);
        log_activity($db, $payload['user_id'], 'update_qr_code', 'remittance', (int)$data->id, "Updated QR code: {$data->label}");
        echo json_encode(["message" => "QR code updated."]);
    } else {
        $stmt = $db->prepare("INSERT INTO remittance_qr_codes (label,type,account_name,account_number,qr_code_image,created_by) VALUES (?,?,?,?,?,?)");
        $stmt->execute([$data->label,$data->type??'gcash',$data->account_name,$data->account_number,$qrPath??'',$payload['user_id']]);
        $newQrId = (int)$db->lastInsertId();
        log_activity($db, $payload['user_id'], 'create_qr_code', 'remittance', $newQrId, "Added QR code: {$data->label} ({$data->type})");
        echo json_encode(["message" => "QR code added.", "id" => $newQrId]);
    }
    exit;
}

if ($method === 'PUT') {
    $data = json_decode(file_get_contents("php://input"));
    if (empty($data->remittance_id) || empty($data->action)) {
        http_response_code(400);
        echo json_encode(["message" => "remittance_id and action are required."]);
        exit;
    }
    if ($data->action === 'verify') {
        $stmt = $db->prepare("UPDATE rider_remittances SET status='verified',verified_by=?,verified_at=NOW() WHERE id=?");
        $stmt->execute([$payload['user_id'], $data->remittance_id]);
        $r = $db->prepare("SELECT rider_id, amount FROM rider_remittances WHERE id=?");
        $r->execute([$data->remittance_id]);
        $row = $r->fetch(PDO::FETCH_ASSOC);
        if ($row) {
            $n = $db->prepare("INSERT INTO notifications (user_id,title,message,type) VALUES (?,'Remittance Verified',?,'remittance')");
            $n->execute([$row['rider_id'], "Your remittance of ₱".number_format($row['amount'],2)." has been verified."]);
        }
        log_activity($db, $payload['user_id'], 'verify_remittance', 'remittance', (int)$data->remittance_id,
            "Verified rider remittance #" . (int)$data->remittance_id . " (₱" . number_format($row['amount'] ?? 0, 2) . ")");
        echo json_encode(["message" => "Remittance verified."]);
    } elseif ($data->action === 'reject') {
        $reason = $data->reason ?? 'Does not match expected amount.';
        $stmt = $db->prepare("UPDATE rider_remittances SET status='rejected',rejection_reason=?,verified_by=?,verified_at=NOW() WHERE id=?");
        $stmt->execute([$reason, $payload['user_id'], $data->remittance_id]);
        $r = $db->prepare("SELECT rider_id, amount FROM rider_remittances WHERE id=?");
        $r->execute([$data->remittance_id]);
        $row = $r->fetch(PDO::FETCH_ASSOC);
        if ($row) {
            $n = $db->prepare("INSERT INTO notifications (user_id,title,message,type) VALUES (?,'Remittance Rejected',?,'remittance')");
            $n->execute([$row['rider_id'], "Your remittance was rejected: $reason"]);
        }
        log_activity($db, $payload['user_id'], 'reject_remittance', 'remittance', (int)$data->remittance_id,
            "Rejected rider remittance #" . (int)$data->remittance_id . ". Reason: $reason");
        echo json_encode(["message" => "Remittance rejected."]);
    } else {
        http_response_code(400);
        echo json_encode(["message" => "Invalid action. Use verify or reject."]);
    }
    exit;
}

if ($method === 'DELETE') {
    $id = isset($_GET['qr_id']) ? (int)$_GET['qr_id'] : 0;
    if (!$id) { http_response_code(400); echo json_encode(["message" => "qr_id required."]); exit; }
    $db->prepare("DELETE FROM remittance_qr_codes WHERE id=?")->execute([$id]);
    log_activity($db, $payload['user_id'], 'delete_qr_code', 'remittance', $id, "Deleted QR code #$id");
    echo json_encode(["message" => "QR code removed."]);
    exit;
}

http_response_code(405);
echo json_encode(["message" => "Method not allowed."]);
