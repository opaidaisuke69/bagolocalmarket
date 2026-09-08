<?php
error_reporting(E_ALL);
ini_set('display_errors', 0);
ini_set('log_errors', 1);

require_once '../config/cors.php';
require_once '../config/database.php';
require_once '../middleware/auth.php';

$database = new Database();
$db = $database->getConnection();
$auth = new AuthMiddleware($db);
$payload = $auth->requireRole(['admin']);

$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'GET') {
    $status = isset($_GET['status']) ? $_GET['status'] : '';
    $search = isset($_GET['search']) ? $_GET['search'] : '';
    $page = isset($_GET['page']) ? (int)$_GET['page'] : 1;
    $limit = isset($_GET['limit']) ? (int)$_GET['limit'] : 20;
    $offset = ($page - 1) * $limit;

    $where = "WHERE u.role = 'seller' AND u.deleted_at IS NULL";
    $params = [];

    if (!empty($status)) {
        $where .= " AND sp.approval_status = ?";
        $params[] = $status;
    }
    if (!empty($search)) {
        $where .= " AND (u.full_name LIKE ? OR u.email LIKE ? OR sp.store_name LIKE ?)";
        $params[] = "%$search%";
        $params[] = "%$search%";
        $params[] = "%$search%";
    }

    $stmt = $db->prepare("SELECT COUNT(*) as total FROM users u JOIN seller_profiles sp ON u.id = sp.user_id $where");
    $stmt->execute($params);
    $total = $stmt->fetch(PDO::FETCH_ASSOC)['total'];

    $query = "SELECT u.id, u.full_name, u.email, u.contact_number,
        u.status as account_status, u.created_at,
        sp.store_name, sp.store_description, sp.approval_status,
        sp.verification_document, sp.valid_id_type, sp.valid_id_image,
        sp.total_sales, sp.total_orders, sp.rating,
        b.name as barangay_name
        FROM users u
        JOIN seller_profiles sp ON u.id = sp.user_id
        LEFT JOIN barangays b ON sp.barangay_id = b.id
        $where
        ORDER BY u.created_at DESC
        LIMIT $limit OFFSET $offset";

    $stmt = $db->prepare($query);
    $stmt->execute($params);
    $sellers = $stmt->fetchAll(PDO::FETCH_ASSOC);

    // Attach sample product images per seller
    foreach ($sellers as &$seller) {
        $seller['sample_products'] = [];
        try {
            $spStmt = $db->prepare(
                "SELECT ssp.image_path FROM seller_sample_products ssp
                 JOIN seller_profiles sp2 ON ssp.seller_id = sp2.id
                 WHERE sp2.user_id = ? LIMIT 10"
            );
            $spStmt->execute([$seller['id']]);
            $seller['sample_products'] = array_column($spStmt->fetchAll(PDO::FETCH_ASSOC), 'image_path');
        } catch (Exception $e) { /* table may not exist */ }
    }

    echo json_encode([
        "sellers"     => $sellers,
        "total"       => (int)$total,
        "page"        => $page,
        "total_pages" => ceil($total / max(1, $limit))
    ]);

} elseif ($method === 'PUT') {
    $data = json_decode(file_get_contents("php://input"));

    if (empty($data->seller_id) || empty($data->action)) {
        http_response_code(400);
        echo json_encode(["message" => "Seller ID and action are required."]);
        exit;
    }

    $validActions = ['approve', 'reject', 'warn', 'suspend', 'ban', 'reactivate'];
    if (!in_array($data->action, $validActions)) {
        http_response_code(400);
        echo json_encode(["message" => "Invalid action."]);
        exit;
    }

    $reason = isset($data->reason) ? $data->reason : '';
    $severity = isset($data->severity) ? $data->severity : 'medium';

    try {
        $db->beginTransaction();

        switch ($data->action) {
            case 'approve':
                // Ensure approved_by column exists (graceful for older schemas)
                try {
                    $db->exec("ALTER TABLE seller_profiles ADD COLUMN IF NOT EXISTS approved_by INT NULL");
                    $db->exec("ALTER TABLE seller_profiles ADD COLUMN IF NOT EXISTS approved_at TIMESTAMP NULL");
                } catch (Exception $e) {}
                $stmt = $db->prepare("UPDATE seller_profiles SET approval_status = 'approved', approved_at = NOW(), approved_by = ? WHERE user_id = ?");
                $stmt->execute([$payload['user_id'], $data->seller_id]);
                // Also set account to active so seller can log in
                $stmt = $db->prepare("UPDATE users SET status = 'active' WHERE id = ? AND status != 'banned'");
                $stmt->execute([$data->seller_id]);
                $message = "Seller approved successfully.";
                break;
            case 'reject':
                if (empty($reason)) $reason = 'Application does not meet requirements.';
                $stmt = $db->prepare("UPDATE seller_profiles SET approval_status = 'rejected', rejection_reason = ? WHERE user_id = ?");
                $stmt->execute([$reason, $data->seller_id]);
                $message = "Seller rejected.";
                break;
            case 'warn':
                $stmt = $db->prepare("UPDATE users SET status = 'warning' WHERE id = ?");
                $stmt->execute([$data->seller_id]);
                if (empty($reason)) $reason = 'Violation of marketplace policies';
                $stmt = $db->prepare("INSERT INTO account_warnings (user_id, issued_by, reason, severity) VALUES (?, ?, ?, ?)");
                $stmt->execute([$data->seller_id, $payload['user_id'], $reason, $severity]);
                $message = "Warning issued.";
                break;
            case 'suspend':
                $stmt = $db->prepare("UPDATE users SET status = 'suspended' WHERE id = ?");
                $stmt->execute([$data->seller_id]);
                $message = "Seller suspended.";
                break;
            case 'ban':
                $stmt = $db->prepare("UPDATE users SET status = 'banned' WHERE id = ?");
                $stmt->execute([$data->seller_id]);
                $message = "Seller banned.";
                break;
            case 'reactivate':
                $stmt = $db->prepare("UPDATE users SET status = 'active' WHERE id = ?");
                $stmt->execute([$data->seller_id]);
                $message = "Seller reactivated.";
                break;
        }

        // Log admin action — non-fatal
        try {
            $stmt = $db->prepare("INSERT INTO admin_logs (admin_id, action, target_type, target_id, details, ip_address) VALUES (?, ?, 'seller', ?, ?, ?)");
            $ipAddress = isset($_SERVER['REMOTE_ADDR']) ? $_SERVER['REMOTE_ADDR'] : '';
            $stmt->execute([$payload['user_id'], $data->action, $data->seller_id, $reason, $ipAddress]);
        } catch (Exception $logEx) { /* log table may differ */ }

        // Notify seller — non-fatal
        try {
            $stmt = $db->prepare("INSERT INTO notifications (user_id, title, message, type) VALUES (?, ?, ?, 'account')");
            $stmt->execute([$data->seller_id, 'Account Update', $message]);
        } catch (Exception $notifEx) { /* notifications table may differ */ }

        $db->commit();
        echo json_encode(["message" => $message]);
    } catch (Exception $e) {
        $db->rollBack();
        http_response_code(500);
        echo json_encode(["message" => "Action failed: " . $e->getMessage()]);
    }
}
