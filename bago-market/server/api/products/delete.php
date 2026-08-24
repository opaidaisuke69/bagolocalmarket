<?php
require_once '../config/cors.php';
require_once '../config/database.php';
require_once '../middleware/auth.php';

$database = new Database();
$db = $database->getConnection();
$auth = new AuthMiddleware($db);
$payload = $auth->requireRole(['seller', 'admin']);

$data = json_decode(file_get_contents("php://input"));

if (empty($data->id)) {
    http_response_code(400);
    echo json_encode(["message" => "Product ID is required."]);
    exit;
}

$where = "id = ? AND deleted_at IS NULL";
$params = [$data->id];

if ($payload['role'] === 'seller') {
    $where .= " AND seller_id = ?";
    $params[] = $payload['user_id'];
}

$stmt = $db->prepare("UPDATE products SET deleted_at = NOW() WHERE $where");
$stmt->execute($params);

if ($stmt->rowCount() === 0) {
    http_response_code(404);
    echo json_encode(["message" => "Product not found."]);
    exit;
}

echo json_encode(["message" => "Product deleted successfully."]);
