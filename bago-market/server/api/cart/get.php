<?php
require_once '../config/cors.php';
require_once '../config/database.php';
require_once '../middleware/auth.php';

$database = new Database();
$db = $database->getConnection();
$auth = new AuthMiddleware($db);
$payload = $auth->requireRole(['buyer']);

$userId = $payload['user_id'];

// Get or create cart
$stmt = $db->prepare("SELECT id FROM carts WHERE user_id = ?");
$stmt->execute([$userId]);

if ($stmt->rowCount() === 0) {
    $stmt = $db->prepare("INSERT INTO carts (user_id) VALUES (?)");
    $stmt->execute([$userId]);
    $cartId = $db->lastInsertId();
} else {
    $cartId = $stmt->fetch(PDO::FETCH_ASSOC)['id'];
}

// Get cart items
$stmt = $db->prepare("SELECT ci.*, p.name as product_name, p.price, p.stock, p.is_available,
    p.seller_id, u.full_name as seller_name, sp.store_name,
    (SELECT image_url FROM product_images WHERE product_id = p.id AND is_primary = 1 LIMIT 1) as product_image,
    b.name as seller_barangay
    FROM cart_items ci
    JOIN products p ON ci.product_id = p.id
    JOIN users u ON p.seller_id = u.id
    LEFT JOIN seller_profiles sp ON p.seller_id = sp.user_id
    LEFT JOIN barangays b ON p.barangay_id = b.id
    WHERE ci.cart_id = ? AND p.deleted_at IS NULL
    ORDER BY ci.created_at DESC");
$stmt->execute([$cartId]);
$items = $stmt->fetchAll(PDO::FETCH_ASSOC);

$subtotal = 0;
foreach ($items as &$item) {
    $item['total'] = $item['price'] * $item['quantity'];
    $subtotal += $item['total'];
}

echo json_encode([
    "cart_id" => $cartId,
    "items" => $items,
    "item_count" => count($items),
    "subtotal" => $subtotal
]);
