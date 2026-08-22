<?php
require_once '../config/cors.php';
require_once '../config/database.php';
require_once '../middleware/auth.php';

$database = new Database();
$db = $database->getConnection();
$auth = new AuthMiddleware($db);
$payload = $auth->requireRole(['buyer']);

$data = json_decode(file_get_contents("php://input"));

if (empty($data->product_id)) {
    http_response_code(400);
    echo json_encode(["message" => "Product ID is required."]);
    exit;
}

$quantity = isset($data->quantity) ? (int)$data->quantity : 1;

// Verify product exists and is available
$stmt = $db->prepare("SELECT id, stock, is_available, approval_status FROM products WHERE id = ? AND deleted_at IS NULL");
$stmt->execute([$data->product_id]);

if ($stmt->rowCount() === 0) {
    http_response_code(404);
    echo json_encode(["message" => "Product not found."]);
    exit;
}

$product = $stmt->fetch(PDO::FETCH_ASSOC);

if (!$product['is_available'] || $product['approval_status'] !== 'approved') {
    http_response_code(400);
    echo json_encode(["message" => "Product is not available."]);
    exit;
}

if ($product['stock'] < $quantity) {
    http_response_code(400);
    echo json_encode(["message" => "Insufficient stock."]);
    exit;
}

// Get cart
$stmt = $db->prepare("SELECT id FROM carts WHERE user_id = ?");
$stmt->execute([$payload['user_id']]);

if ($stmt->rowCount() === 0) {
    $stmt = $db->prepare("INSERT INTO carts (user_id) VALUES (?)");
    $stmt->execute([$payload['user_id']]);
    $cartId = $db->lastInsertId();
} else {
    $cartId = $stmt->fetch(PDO::FETCH_ASSOC)['id'];
}

// Check if item already in cart
$variationId = isset($data->variation_id) ? $data->variation_id : null;
$stmt = $db->prepare("SELECT id, quantity FROM cart_items WHERE cart_id = ? AND product_id = ? AND (variation_id = ? OR (variation_id IS NULL AND ? IS NULL))");
$stmt->execute([$cartId, $data->product_id, $variationId, $variationId]);

if ($stmt->rowCount() > 0) {
    $item = $stmt->fetch(PDO::FETCH_ASSOC);
    $newQuantity = $item['quantity'] + $quantity;
    if ($newQuantity > $product['stock']) {
        http_response_code(400);
        echo json_encode(["message" => "Cannot add more than available stock."]);
        exit;
    }
    $stmt = $db->prepare("UPDATE cart_items SET quantity = ? WHERE id = ?");
    $stmt->execute([$newQuantity, $item['id']]);
} else {
    $stmt = $db->prepare("INSERT INTO cart_items (cart_id, product_id, quantity, variation_id) VALUES (?, ?, ?, ?)");
    $stmt->execute([$cartId, $data->product_id, $quantity, $variationId]);
}

// Track interaction
$stmt = $db->prepare("INSERT INTO product_interactions (user_id, product_id, interaction_type) VALUES (?, ?, 'add_to_cart')");
$stmt->execute([$payload['user_id'], $data->product_id]);

echo json_encode(["message" => "Product added to cart successfully."]);
