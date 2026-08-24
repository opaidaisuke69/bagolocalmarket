<?php
require_once '../config/cors.php';
require_once '../config/database.php';
require_once '../middleware/auth.php';

$database = new Database();
$db = $database->getConnection();
$auth = new AuthMiddleware($db);
$payload = $auth->requireRole(['buyer']);

$data = json_decode(file_get_contents("php://input"));

if (empty($data->item_id) || !isset($data->quantity)) {
    http_response_code(400);
    echo json_encode(["message" => "Item ID and quantity are required."]);
    exit;
}

// Verify ownership
$stmt = $db->prepare("SELECT ci.id, ci.product_id, p.stock FROM cart_items ci 
    JOIN carts c ON ci.cart_id = c.id 
    JOIN products p ON ci.product_id = p.id
    WHERE ci.id = ? AND c.user_id = ?");
$stmt->execute([$data->item_id, $payload['user_id']]);

if ($stmt->rowCount() === 0) {
    http_response_code(404);
    echo json_encode(["message" => "Cart item not found."]);
    exit;
}

$item = $stmt->fetch(PDO::FETCH_ASSOC);

if ($data->quantity > $item['stock']) {
    http_response_code(400);
    echo json_encode(["message" => "Quantity exceeds available stock."]);
    exit;
}

if ($data->quantity <= 0) {
    $stmt = $db->prepare("DELETE FROM cart_items WHERE id = ?");
    $stmt->execute([$data->item_id]);
    echo json_encode(["message" => "Item removed from cart."]);
} else {
    $stmt = $db->prepare("UPDATE cart_items SET quantity = ? WHERE id = ?");
    $stmt->execute([$data->quantity, $data->item_id]);
    echo json_encode(["message" => "Cart updated successfully."]);
}
