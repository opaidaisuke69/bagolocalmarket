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
    $role = isset($_GET['role']) ? $_GET['role'] : '';
    $status = isset($_GET['status']) ? $_GET['status'] : '';
    $search = isset($_GET['search']) ? $_GET['search'] : '';
    $page = isset($_GET['page']) ? (int)$_GET['page'] : 1;
    $limit = isset($_GET['limit']) ? (int)$_GET['limit'] : 20;
    $offset = ($page - 1) * $limit;

    $where = "WHERE u.deleted_at IS NULL";
    $params = [];

    if (!empty($role)) {
        $where .= " AND u.role = ?";
        $params[] = $role;
    }
    if (!empty($status)) {
        $where .= " AND u.status = ?";
        $params[] = $status;
    }
    if (!empty($search)) {
        $where .= " AND (u.full_name LIKE ? OR u.email LIKE ?)";
        $params[] = "%$search%";
        $params[] = "%$search%";
    }

    $stmt = $db->prepare("SELECT COUNT(*) as total FROM users u $where");
    $stmt->execute($params);
    $total = $stmt->fetch(PDO::FETCH_ASSOC)['total'];

    $query = "SELECT u.id, u.full_name, u.email, u.contact_number, u.role, u.status, u.profile_image, u.last_login_at, u.created_at
        FROM users u $where ORDER BY u.created_at DESC LIMIT $limit OFFSET $offset";

    $stmt = $db->prepare($query);
    $stmt->execute($params);
    $users = $stmt->fetchAll(PDO::FETCH_ASSOC);

    echo json_encode([
        "users" => $users,
        "total" => (int)$total,
        "page" => $page,
        "total_pages" => ceil($total / $limit)
    ]);

} elseif ($method === 'PUT') {
    $data = json_decode(file_get_contents("php://input"));

    if (empty($data->user_id) || empty($data->action)) {
        http_response_code(400);
        echo json_encode(["message" => "User ID and action are required."]);
        exit;
    }

    $validActions = ['warn', 'suspend', 'ban', 'reactivate'];
    if (!in_array($data->action, $validActions)) {
        http_response_code(400);
        echo json_encode(["message" => "Invalid action."]);
        exit;
    }

    $statusMap = [
        'warn' => 'warning',
        'suspend' => 'suspended',
        'ban' => 'banned',
        'reactivate' => 'active'
    ];

    $stmt = $db->prepare("UPDATE users SET status = ? WHERE id = ? AND id != ?");
    $stmt->execute([$statusMap[$data->action], $data->user_id, $payload['user_id']]);

    if ($data->action === 'warn') {
        $stmt = $db->prepare("INSERT INTO account_warnings (user_id, issued_by, reason, severity) VALUES (?, ?, ?, ?)");
        $stmt->execute([$data->user_id, $payload['user_id'], $data->reason ?? 'Policy violation', $data->severity ?? 'medium']);
    }

    // Log
    $stmt = $db->prepare("INSERT INTO admin_logs (admin_id, action, target_type, target_id, details, ip_address) VALUES (?, ?, 'user', ?, ?, ?)");
    $stmt->execute([$payload['user_id'], 'user_' . $data->action, $data->user_id, $data->reason ?? '', $_SERVER['REMOTE_ADDR'] ?? '']);

    echo json_encode(["message" => "User " . $data->action . " action completed."]);
}
