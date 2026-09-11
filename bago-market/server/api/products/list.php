<?php
require_once '../config/cors.php';
require_once '../config/database.php';
require_once '../middleware/auth.php';

$database = new Database();
$db = $database->getConnection();

$page = isset($_GET['page']) ? (int)$_GET['page'] : 1;
$limit = isset($_GET['limit']) ? (int)$_GET['limit'] : 20;
$offset = ($page - 1) * $limit;

$category = isset($_GET['category']) ? $_GET['category'] : '';
$search = isset($_GET['search']) ? $_GET['search'] : '';
$barangay = isset($_GET['barangay']) ? $_GET['barangay'] : '';
$min_price = isset($_GET['min_price']) ? (float)$_GET['min_price'] : 0;
$max_price = isset($_GET['max_price']) ? (float)$_GET['max_price'] : 0;
$sort = isset($_GET['sort']) ? $_GET['sort'] : 'newest';
$seller_id = isset($_GET['seller_id']) ? (int)$_GET['seller_id'] : 0;
$rating = isset($_GET['rating']) ? (int)$_GET['rating'] : 0;

$where = "WHERE p.approval_status = 'approved' AND p.is_available = 1 AND p.deleted_at IS NULL";
$params = [];

if (!empty($search)) {
    $where .= " AND (p.name LIKE ? OR p.description LIKE ?)";
    $params[] = "%$search%";
    $params[] = "%$search%";
}

if (!empty($category)) {
    $where .= " AND c.slug = ?";
    $params[] = $category;
}

if (!empty($barangay)) {
    $where .= " AND b.name = ?";
    $params[] = $barangay;
}

if ($min_price > 0) {
    $where .= " AND p.price >= ?";
    $params[] = $min_price;
}

if ($max_price > 0) {
    $where .= " AND p.price <= ?";
    $params[] = $max_price;
}

if ($seller_id > 0) {
    $where .= " AND p.seller_id = ?";
    $params[] = $seller_id;
}

if ($rating > 0) {
    $where .= " AND p.rating >= ?";
    $params[] = $rating;
}

$orderBy = 'p.created_at DESC';
switch($sort) {
    case 'price_low': $orderBy = 'p.price ASC'; break;
    case 'price_high': $orderBy = 'p.price DESC'; break;
    case 'popular': $orderBy = 'p.sold_count DESC'; break;
    case 'rating': $orderBy = 'p.rating DESC'; break;
    case 'best_selling': $orderBy = 'p.sold_count DESC'; break;
    default: $orderBy = 'p.created_at DESC'; break;
}


// Count total
$countQuery = "SELECT COUNT(*) as total FROM products p 
    LEFT JOIN categories c ON p.category_id = c.id 
    LEFT JOIN barangays b ON p.barangay_id = b.id 
    $where";
$stmt = $db->prepare($countQuery);
$stmt->execute($params);
$total = $stmt->fetch(PDO::FETCH_ASSOC)['total'];

// Get products
$query = "SELECT p.*, c.name as category_name, c.slug as category_slug, 
    b.name as barangay_name, u.full_name as seller_name,
    sp.store_name,
    COALESCE((SELECT AVG(p2.rating) FROM products p2 WHERE p2.seller_id = p.seller_id AND p2.rating > 0 AND p2.deleted_at IS NULL), 0) as seller_rating,
    (SELECT image_url FROM product_images WHERE product_id = p.id AND is_primary = 1 LIMIT 1) as primary_image,
    (SELECT MIN(p.price + pv.price_adjustment) FROM product_variations pv WHERE pv.product_id = p.id) as min_variant_price,
    (SELECT MAX(p.price + pv.price_adjustment) FROM product_variations pv WHERE pv.product_id = p.id) as max_variant_price,
    (SELECT COUNT(*) FROM product_variations pv WHERE pv.product_id = p.id) as variant_count
    FROM products p
    LEFT JOIN categories c ON p.category_id = c.id
    LEFT JOIN barangays b ON p.barangay_id = b.id
    LEFT JOIN users u ON p.seller_id = u.id
    LEFT JOIN seller_profiles sp ON p.seller_id = sp.user_id
    $where
    ORDER BY $orderBy
    LIMIT $limit OFFSET $offset";

$stmt = $db->prepare($query);
$stmt->execute($params);
$products = $stmt->fetchAll(PDO::FETCH_ASSOC);

echo json_encode([
    "products" => $products,
    "total" => (int)$total,
    "page" => $page,
    "limit" => $limit,
    "total_pages" => ceil($total / $limit)
]);
