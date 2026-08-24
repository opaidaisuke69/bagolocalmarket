<?php
require_once '../config/cors.php';
require_once '../config/database.php';
require_once '../middleware/auth.php';

$database = new Database();
$db = $database->getConnection();
$auth = new AuthMiddleware($db);
$payload = $auth->requireAuth();

$data = json_decode(file_get_contents("php://input"));

if (empty($data->product_id) || empty($data->interaction_type)) {
    http_response_code(400);
    echo json_encode(["message" => "Product ID and interaction type are required."]);
    exit;
}

$validTypes = ['view', 'click', 'search', 'add_to_cart', 'remove_from_cart', 'add_to_wishlist', 'purchase', 'category_view'];
if (!in_array($data->interaction_type, $validTypes)) {
    http_response_code(400);
    echo json_encode(["message" => "Invalid interaction type."]);
    exit;
}

$metadata = isset($data->metadata) ? json_encode($data->metadata) : null;

$stmt = $db->prepare("INSERT INTO product_interactions (user_id, product_id, interaction_type, metadata) VALUES (?, ?, ?, ?)");
$stmt->execute([$payload['user_id'], $data->product_id, $data->interaction_type, $metadata]);

echo json_encode(["message" => "Interaction tracked."]);
