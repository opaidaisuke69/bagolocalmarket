<?php
require_once '../config/cors.php';
require_once '../config/database.php';
require_once '../middleware/auth.php';

$database = new Database();
$db = $database->getConnection();

$query = isset($_GET['q']) ? trim($_GET['q']) : '';
$limit = isset($_GET['limit']) ? (int)$_GET['limit'] : 10;

if (empty($query)) {
    echo json_encode(["suggestions" => [], "products" => []]);
    exit;
}

// Search products
$stmt = $db->prepare("SELECT p.id, p.name, p.price, p.slug, c.name as category_name,
    (SELECT image_url FROM product_images WHERE product_id = p.id AND is_primary = 1 LIMIT 1) as primary_image
    FROM products p
    LEFT JOIN categories c ON p.category_id = c.id
    WHERE (p.name LIKE ? OR p.description LIKE ? OR c.name LIKE ?)
    AND p.approval_status = 'approved' AND p.is_available = 1 AND p.deleted_at IS NULL
    ORDER BY p.sold_count DESC
    LIMIT ?");
$searchTerm = "%$query%";
$stmt->bindValue(1, $searchTerm);
$stmt->bindValue(2, $searchTerm);
$stmt->bindValue(3, $searchTerm);
$stmt->bindValue(4, $limit, PDO::PARAM_INT);
$stmt->execute();
$products = $stmt->fetchAll(PDO::FETCH_ASSOC);

// Get search suggestions (category names, popular searches)
$stmt = $db->prepare("SELECT DISTINCT name FROM categories WHERE name LIKE ? AND is_active = 1 LIMIT 5");
$stmt->execute([$searchTerm]);
$categorySuggestions = array_column($stmt->fetchAll(PDO::FETCH_ASSOC), 'name');

// Track search if user is authenticated
$auth = new AuthMiddleware($db);
$payload = $auth->validateToken();
if ($payload) {
    $stmt = $db->prepare("INSERT INTO search_history (user_id, query, results_count) VALUES (?, ?, ?)");
    $stmt->execute([$payload['user_id'], $query, count($products)]);
}

echo json_encode([
    "products" => $products,
    "suggestions" => $categorySuggestions,
    "total" => count($products)
]);
