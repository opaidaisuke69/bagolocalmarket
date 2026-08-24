<?php
require_once '../config/cors.php';
require_once '../config/database.php';
require_once '../middleware/auth.php';

$database = new Database();
$db = $database->getConnection();
$auth = new AuthMiddleware($db);
$payload = $auth->requireAuth();

$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'GET') {
    $stmt = $db->prepare("SELECT a.*, b.name as barangay_name FROM addresses a 
        LEFT JOIN barangays b ON a.barangay_id = b.id 
        WHERE a.user_id = ? AND a.deleted_at IS NULL 
        ORDER BY a.is_default DESC, a.created_at DESC");
    $stmt->execute([$payload['user_id']]);
    $addresses = $stmt->fetchAll(PDO::FETCH_ASSOC);

    echo json_encode(["addresses" => $addresses]);
}
