<?php
require_once '../config/cors.php';
require_once '../config/database.php';
require_once '../middleware/auth.php';

$database = new Database();
$db = $database->getConnection();
$auth = new AuthMiddleware($db);
$payload = $auth->requireRole(['seller']);

$page = isset($_GET['page']) ? (int)$_GET['page'] : 1;
$limit = isset($_GET['limit']) ? (int)$_GET['limit'] : 20;
$offset = ($page - 1) * $limit;
$status = isset($_GET['status']) ? $_GET['status'] : '';
$search = isset($_GET['search']) ? $_GET['search'] : '';

$where = "WHERE p.seller_id = ? AND p.deleted_at IS NULL";
$params = [$payload['user_id']];

if (!empty($status)) {
    $where .= " AND p.approval_status = ?";
    $params[] = $status;
}

if (!empty($search)) {
    $where .= " AND p.name LIKE ?";
    $params[] = "%$search%";
}

$stmt = $db->prepare("SELECT COUNT(*) as total FROM products p $where");
$stmt->execute($params);
$total = $stmt->fetch(PDO::FETCH_ASSOC)['total'];

$query = "SELECT p.*, c.name as category_name,
    (SELECT image_url FROM product_images WHERE product_id = p.id AND is_primary = 1 LIMIT 1) as primary_image
    FROM products p
    LEFT JOIN categories c ON p.category_id = c.id
    $where
    ORDER BY p.created_at DESC
    LIMIT $limit OFFSET $offset";

$stmt = $db->prepare($query);
$stmt->execute($params);
$products = $stmt->fetchAll(PDO::FETCH_ASSOC);

echo json_encode([
    "products" => $products,
    "total" => (int)$total,
    "page" => $page,
    "total_pages" => ceil($total / $limit)
]);
