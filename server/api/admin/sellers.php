<?php
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
    $page = isset($_GET['page']) ? (int)$_GET['page'] : 1;
    $limit = isset($_GET['limit']) ? (int)$_GET['limit'] : 20;
    $offset = ($page - 1) * $limit;

    $where = "WHERE u.role = 'seller' AND u.deleted_at IS NULL";
    $params = [];

    if (!empty($status)) {
        $where .= " AND sp.approval_status = ?";
        $params[] = $status;
    }

    $stmt = $db->prepare("SELECT COUNT(*) as total FROM users u JOIN seller_profiles sp ON u.id = sp.user_id $where");
    $stmt->execute($params);
    $total = $stmt->fetch(PDO::FETCH_ASSOC)['total'];

    $query = "SELECT u.id, u.full_name, u.email, u.contact_number, u.status as account_status, u.created_at,
        sp.store_name, sp.store_description, sp.approval_status, sp.verification_document, sp.total_sales, sp.total_orders, sp.rating,
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

    echo json_encode([
        "sellers" => $sellers,
        "total" => (int)$total,
        "page" => $page,
        "total_pages" => ceil($total / $limit)
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

    try {
        $db->beginTransaction();

        switch ($data->action) {
            case 'approve':
                $stmt = $db->prepare("UPDATE seller_profiles SET approval_status = 'approved', approved_at = NOW(), approved_by = ? WHERE user_id = ?");
                $stmt->execute([$payload['user_id'], $data->seller_id]);
                $message = "Seller approved successfully.";
                break;
            case 'reject':
                $reason = $data->reason ?? 'Application does not meet requirements.';
                $stmt = $db->prepare("UPDATE seller_profiles SET approval_status = 'rejected', rejection_reason = ? WHERE user_id = ?");
                $stmt->execute([$reason, $data->seller_id]);
                $message = "Seller rejected.";
                break;
            case 'warn':
                $stmt = $db->prepare("UPDATE users SET status = 'warning' WHERE id = ?");
                $stmt->execute([$data->seller_id]);
                $stmt = $db->prepare("INSERT INTO account_warnings (user_id, issued_by, reason, severity) VALUES (?, ?, ?, ?)");
                $stmt->execute([$data->seller_id, $payload['user_id'], $data->reason ?? 'Violation of marketplace policies', $data->severity ?? 'medium']);
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

        // Log admin action
        $stmt = $db->prepare("INSERT INTO admin_logs (admin_id, action, target_type, target_id, details, ip_address) VALUES (?, ?, 'seller', ?, ?, ?)");
        $stmt->execute([$payload['user_id'], $data->action, $data->seller_id, $data->reason ?? '', $_SERVER['REMOTE_ADDR'] ?? '']);

        // Notify seller
        $stmt = $db->prepare("INSERT INTO notifications (user_id, title, message, type) VALUES (?, ?, ?, 'account')");
        $stmt->execute([$data->seller_id, 'Account Update', $message]);

        $db->commit();
        echo json_encode(["message" => $message]);
    } catch (Exception $e) {
        $db->rollBack();
        http_response_code(500);
        echo json_encode(["message" => "Action failed."]);
    }
}
