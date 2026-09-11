<?php
require_once '../config/cors.php';
require_once '../config/database.php';
require_once '../middleware/auth.php';

$database = new Database();
$db = $database->getConnection();

$id = isset($_GET['id']) ? (int)$_GET['id'] : 0;

if ($id === 0) {
    http_response_code(400);
    echo json_encode(["message" => "Product ID is required."]);
    exit;
}

$stmt = $db->prepare("SELECT p.*, c.name as category_name, c.slug as category_slug,
    b.name as barangay_name, u.full_name as seller_name, u.profile_image as seller_image,
    sp.store_name, sp.store_description, sp.total_sales as seller_total_sales,
    sb.name as seller_barangay,
    COALESCE(
        (SELECT AVG(p2.rating) FROM products p2 WHERE p2.seller_id = p.seller_id AND p2.rating > 0 AND p2.deleted_at IS NULL),
        0
    ) as seller_rating,
    (SELECT MIN(p.price + pv.price_adjustment) FROM product_variations pv WHERE pv.product_id = p.id) as min_variant_price,
    (SELECT MAX(p.price + pv.price_adjustment) FROM product_variations pv WHERE pv.product_id = p.id) as max_variant_price,
    (SELECT COUNT(*) FROM product_variations pv WHERE pv.product_id = p.id) as variant_count
    FROM products p
    LEFT JOIN categories c ON p.category_id = c.id
    LEFT JOIN barangays b ON p.barangay_id = b.id
    LEFT JOIN users u ON p.seller_id = u.id
    LEFT JOIN seller_profiles sp ON p.seller_id = sp.user_id
    LEFT JOIN barangays sb ON sp.barangay_id = sb.id
    WHERE p.id = ? AND p.deleted_at IS NULL");
$stmt->execute([$id]);

if ($stmt->rowCount() === 0) {
    http_response_code(404);
    echo json_encode(["message" => "Product not found."]);
    exit;
}

$product = $stmt->fetch(PDO::FETCH_ASSOC);

// Get images
$stmt = $db->prepare("SELECT * FROM product_images WHERE product_id = ? ORDER BY sort_order ASC");
$stmt->execute([$id]);
$product['images'] = $stmt->fetchAll(PDO::FETCH_ASSOC);

// Get variations
$stmt = $db->prepare("SELECT * FROM product_variations WHERE product_id = ?");
$stmt->execute([$id]);
$product['variations'] = $stmt->fetchAll(PDO::FETCH_ASSOC);

// Get reviews
$stmt = $db->prepare("SELECT pr.*, u.full_name, u.profile_image FROM product_reviews pr LEFT JOIN users u ON pr.user_id = u.id WHERE pr.product_id = ? ORDER BY pr.created_at DESC LIMIT 10");
$stmt->execute([$id]);
$product['reviews'] = $stmt->fetchAll(PDO::FETCH_ASSOC);

// Increment view count
$stmt = $db->prepare("UPDATE products SET view_count = view_count + 1 WHERE id = ?");
$stmt->execute([$id]);

// Track interaction if user is logged in
$auth = new AuthMiddleware($db);
$payload = $auth->validateToken();
if ($payload) {
    $stmt = $db->prepare("INSERT INTO product_interactions (user_id, product_id, interaction_type) VALUES (?, ?, 'view')");
    $stmt->execute([$payload['user_id'], $id]);
}

echo json_encode(["product" => $product]);
