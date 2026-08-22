<?php
require_once '../config/cors.php';
require_once '../config/database.php';
require_once '../middleware/auth.php';

$database = new Database();
$db = $database->getConnection();
$auth = new AuthMiddleware($db);
$payload = $auth->requireRole(['buyer']);

$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'GET') {
    $stmt = $db->prepare("SELECT w.*, p.name as product_name, p.price, p.stock, p.is_available,
        (SELECT image_url FROM product_images WHERE product_id = p.id AND is_primary = 1 LIMIT 1) as product_image,
        c.name as category_name, sp.store_name, u.full_name as seller_name
        FROM wishlists w
        JOIN products p ON w.product_id = p.id
        LEFT JOIN categories c ON p.category_id = c.id
        LEFT JOIN users u ON p.seller_id = u.id
        LEFT JOIN seller_profiles sp ON p.seller_id = sp.user_id
        WHERE w.user_id = ? AND p.deleted_at IS NULL
        ORDER BY w.created_at DESC");
    $stmt->execute([$payload['user_id']]);
    $items = $stmt->fetchAll(PDO::FETCH_ASSOC);

    echo json_encode(["wishlist" => $items]);

} elseif ($method === 'POST') {
    $data = json_decode(file_get_contents("php://input"));

    if (empty($data->product_id)) {
        http_response_code(400);
        echo json_encode(["message" => "Product ID is required."]);
        exit;
    }

    // Toggle wishlist
    $stmt = $db->prepare("SELECT id FROM wishlists WHERE user_id = ? AND product_id = ?");
    $stmt->execute([$payload['user_id'], $data->product_id]);

    if ($stmt->rowCount() > 0) {
        $stmt = $db->prepare("DELETE FROM wishlists WHERE user_id = ? AND product_id = ?");
        $stmt->execute([$payload['user_id'], $data->product_id]);
        echo json_encode(["message" => "Removed from wishlist.", "action" => "removed"]);
    } else {
        $stmt = $db->prepare("INSERT INTO wishlists (user_id, product_id) VALUES (?, ?)");
        $stmt->execute([$payload['user_id'], $data->product_id]);

        // Track interaction
        $stmt = $db->prepare("INSERT INTO product_interactions (user_id, product_id, interaction_type) VALUES (?, ?, 'add_to_wishlist')");
        $stmt->execute([$payload['user_id'], $data->product_id]);

        echo json_encode(["message" => "Added to wishlist.", "action" => "added"]);
    }
}
