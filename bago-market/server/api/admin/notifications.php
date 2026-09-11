<?php
/**
 * Admin Notifications API
 *
 * GET  ?limit=20   — notifications for the admin user
 * PUT  { mark_all: true } | { id: N }   — mark read
 */

require_once '../config/cors.php';
require_once '../config/database.php';
require_once '../middleware/auth.php';

$database = new Database();
$db       = $database->getConnection();
$auth     = new AuthMiddleware($db);
$payload  = $auth->requireRole(['admin']);

$adminId = $payload['user_id'];
$method  = $_SERVER['REQUEST_METHOD'];

if ($method === 'GET') {
    $limit = max(1, min(100, (int)($_GET['limit'] ?? 20)));

    $stmt = $db->prepare(
        "SELECT id, title, message, type, is_read, created_at
         FROM notifications
         WHERE user_id = ?
         ORDER BY created_at DESC
         LIMIT $limit"
    );
    $stmt->execute([$adminId]);
    $notifications = $stmt->fetchAll(PDO::FETCH_ASSOC);

    foreach ($notifications as &$n) {
        $n['is_read'] = (bool)$n['is_read'];
    }

    echo json_encode(['notifications' => $notifications]);
    exit;
}

if ($method === 'PUT') {
    $data = json_decode(file_get_contents('php://input'));

    if (!empty($data->mark_all)) {
        $db->prepare('UPDATE notifications SET is_read = 1 WHERE user_id = ?')
           ->execute([$adminId]);
        echo json_encode(['message' => 'All notifications marked as read.']);
    } elseif (!empty($data->id)) {
        $db->prepare('UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?')
           ->execute([(int)$data->id, $adminId]);
        echo json_encode(['message' => 'Notification marked as read.']);
    } else {
        http_response_code(400);
        echo json_encode(['message' => 'Provide mark_all or id.']);
    }
    exit;
}

http_response_code(405);
echo json_encode(['message' => 'Method not allowed.']);
