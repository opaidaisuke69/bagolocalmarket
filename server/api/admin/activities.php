<?php
require_once '../config/cors.php';
require_once '../config/database.php';
require_once '../middleware/auth.php';

$database = new Database();
$db = $database->getConnection();
$auth = new AuthMiddleware($db);
$payload = $auth->requireRole(['admin']);

$page = isset($_GET['page']) ? (int)$_GET['page'] : 1;
$limit = isset($_GET['limit']) ? (int)$_GET['limit'] : 50;
$offset = ($page - 1) * $limit;

$stmt = $db->prepare("SELECT COUNT(*) as total FROM admin_logs");
$stmt->execute();
$total = $stmt->fetch(PDO::FETCH_ASSOC)['total'];

$stmt = $db->prepare("SELECT al.*, u.full_name, u.role 
    FROM admin_logs al 
    LEFT JOIN users u ON al.admin_id = u.id 
    ORDER BY al.created_at DESC 
    LIMIT $limit OFFSET $offset");
$stmt->execute();
$activities = $stmt->fetchAll(PDO::FETCH_ASSOC);

echo json_encode([
    "activities" => $activities,
    "total" => (int)$total,
    "page" => $page,
    "total_pages" => ceil($total / $limit)
]);
