<?php
/**
 * GET /products/reviews.php?product_id=X[&rating=5][&page=1][&limit=20]
 * Returns paginated reviews for a product, optionally filtered by star rating.
 */
require_once '../config/cors.php';
require_once '../config/database.php';

$database = new Database();
$db       = $database->getConnection();

$productId = isset($_GET['product_id']) ? (int)$_GET['product_id'] : 0;
if ($productId === 0) {
    http_response_code(400);
    echo json_encode(['message' => 'product_id is required.']);
    exit;
}

$rating = isset($_GET['rating']) ? (int)$_GET['rating'] : 0; // 0 = all
$page   = isset($_GET['page'])   ? max(1, (int)$_GET['page'])  : 1;
$limit  = isset($_GET['limit'])  ? min(50, (int)$_GET['limit']) : 20;
$offset = ($page - 1) * $limit;

// ── Rating counts per star (for filter tabs) ──────────────────────────────
$countStmt = $db->prepare(
    "SELECT rating, COUNT(*) AS cnt
     FROM product_reviews
     WHERE product_id = ?
     GROUP BY rating"
);
$countStmt->execute([$productId]);
$countRows  = $countStmt->fetchAll(PDO::FETCH_ASSOC);
$starCounts = [1 => 0, 2 => 0, 3 => 0, 4 => 0, 5 => 0];
$totalCount = 0;
foreach ($countRows as $row) {
    $starCounts[(int)$row['rating']] = (int)$row['cnt'];
    $totalCount += (int)$row['cnt'];
}

// ── Reviews query ─────────────────────────────────────────────────────────
$where  = 'pr.product_id = ?';
$params = [$productId];
if ($rating >= 1 && $rating <= 5) {
    $where  .= ' AND pr.rating = ?';
    $params[] = $rating;
}

$filteredTotal = $rating >= 1 && $rating <= 5
    ? ($starCounts[$rating] ?? 0)
    : $totalCount;

$stmt = $db->prepare(
    "SELECT pr.id, pr.rating, pr.review, pr.created_at,
            u.full_name, u.profile_image
     FROM product_reviews pr
     LEFT JOIN users u ON pr.user_id = u.id
     WHERE $where
     ORDER BY pr.created_at DESC
     LIMIT $limit OFFSET $offset"
);
$stmt->execute($params);
$reviews = $stmt->fetchAll(PDO::FETCH_ASSOC);

echo json_encode([
    'reviews'        => $reviews,
    'total'          => $filteredTotal,
    'total_all'      => $totalCount,
    'page'           => $page,
    'limit'          => $limit,
    'total_pages'    => $filteredTotal > 0 ? (int)ceil($filteredTotal / $limit) : 1,
    'filter_rating'  => $rating,
    'star_counts'    => $starCounts,
]);
