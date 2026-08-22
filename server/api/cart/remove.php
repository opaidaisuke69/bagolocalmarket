<?php
require_once '../config/cors.php';
require_once '../config/database.php';
require_once '../middleware/auth.php';

$database = new Database();
$db = $database->getConnection();
$auth = new AuthMiddleware($db);
$payload = $auth->requireRole(['buyer']);

$data = json_decode(file_get_contents("php://input"));

if (empty($data->item_id)) {
    http_response_code(400);
    echo json_encode(["message" => "Item ID is required."]);
    exit;
}

$stmt = $db->prepare("DELETE ci FROM cart_items ci JOIN carts c ON ci.cart_id = c.id WHERE ci.id = ? AND c.user_id = ?");
$stmt->execute([$data->item_id, $payload['user_id']]);

if ($stmt->rowCount() === 0) {
    http_response_code(404);
    echo json_encode(["message" => "Cart item not found."]);
    exit;
}

echo json_encode(["message" => "Item removed from cart."]);
