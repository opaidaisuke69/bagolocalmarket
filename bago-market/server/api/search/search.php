<?php
require_once '../config/cors.php';
require_once '../config/database.php';
require_once '../middleware/auth.php';

$database = new Database();
$db = $database->getConnection();

$query    = isset($_GET['q'])        ? trim($_GET['q'])        : '';
$category = isset($_GET['category']) ? trim($_GET['category']) : '';
$limit    = isset($_GET['limit'])    ? (int)$_GET['limit']     : 20;
$page     = isset($_GET['page'])     ? max(1, (int)$_GET['page']) : 1;
$offset   = ($page - 1) * $limit;

if (empty($query)) {
    echo json_encode(["suggestions" => [], "products" => [], "total" => 0]);
    exit;
}

$searchTerm = "%$query%";

// Build WHERE clause — always filter by query, optionally by category slug
$where  = "WHERE (p.name LIKE ? OR p.description LIKE ? OR c.name LIKE ?)
           AND p.approval_status = 'approved' AND p.is_available = 1 AND p.deleted_at IS NULL";
$params = [$searchTerm, $searchTerm, $searchTerm];

if (!empty($category)) {
    $where   .= " AND c.slug = ?";
    $params[] = $category;
}

// Count total for pagination
$countStmt = $db->prepare(
    "SELECT COUNT(*) as total FROM products p
     LEFT JOIN categories c ON p.category_id = c.id
     $where"
);
$countStmt->execute($params);
$total = (int)$countStmt->fetch(PDO::FETCH_ASSOC)['total'];

// Fetch products
$sql = "SELECT p.id, p.name, p.price, p.slug, p.sold_count, p.rating, p.stock,
        c.name as category_name, c.slug as category_slug,
        b.name as barangay_name,
        sp.store_name,
        (SELECT image_url FROM product_images WHERE product_id = p.id AND is_primary = 1 LIMIT 1) as primary_image
        FROM products p
        LEFT JOIN categories c ON p.category_id = c.id
        LEFT JOIN barangays b ON p.barangay_id = b.id
        LEFT JOIN seller_profiles sp ON p.seller_id = sp.user_id
        $where
        ORDER BY p.sold_count DESC, p.rating DESC
        LIMIT ? OFFSET ?";

$searchParams   = array_merge($params, [$limit, $offset]);
$stmt = $db->prepare($sql);

// Bind everything (PDO doesn't infer PARAM_INT for LIMIT/OFFSET via execute())
$i = 1;
foreach ($params as $p_val) {
    $stmt->bindValue($i++, $p_val);
}
$stmt->bindValue($i++, $limit,  PDO::PARAM_INT);
$stmt->bindValue($i,   $offset, PDO::PARAM_INT);
$stmt->execute();
$products = $stmt->fetchAll(PDO::FETCH_ASSOC);

// Category suggestions (names that match the query)
$catStmt = $db->prepare(
    "SELECT DISTINCT c.id, c.name, c.slug,
     (SELECT COUNT(*) FROM products p2 WHERE p2.category_id = c.id
      AND p2.approval_status = 'approved' AND p2.is_available = 1 AND p2.deleted_at IS NULL) as product_count
     FROM categories c WHERE c.name LIKE ? AND c.is_active = 1 LIMIT 5"
);
$catStmt->execute([$searchTerm]);
$categorySuggestions = $catStmt->fetchAll(PDO::FETCH_ASSOC);

// Track search if user is authenticated (deduplicate within 1 minute)
$auth    = new AuthMiddleware($db);
$payload = $auth->validateToken();
if ($payload) {
    $dupStmt = $db->prepare(
        "SELECT id FROM search_history WHERE user_id = ? AND query = ?
         AND created_at > DATE_SUB(NOW(), INTERVAL 1 MINUTE) LIMIT 1"
    );
    $dupStmt->execute([$payload['user_id'], $query]);
    if (!$dupStmt->fetch()) {
        $insStmt = $db->prepare(
            "INSERT INTO search_history (user_id, query, results_count) VALUES (?, ?, ?)"
        );
        $insStmt->execute([$payload['user_id'], $query, $total]);
    }
}

echo json_encode([
    "products"    => $products,
    "suggestions" => $categorySuggestions,
    "total"       => $total,
    "page"        => $page,
    "total_pages" => $limit > 0 ? (int)ceil($total / $limit) : 1,
]);
