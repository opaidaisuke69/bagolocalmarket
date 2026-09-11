<?php
/**
 * GET /products/my-reviews.php?order_id=X
 * Returns the current user's reviews for all products in a given order.
 * Requires auth.
 */
require_once '../config/cors.php';
require_once '../config/database.php';
require_once '../middleware/auth.php';

$database = new Database();
$db       = $database->getConnection();
$auth     = new AuthMiddleware($db);
$payload  = $auth->requireAuth();

$user_id  = $payload['user_id'];
$order_id = isset($_GET['order_id']) ? (int)$_GET['order_id'] : 0;

if ($order_id === 0) {
    http_response_code(400);
    echo json_encode(['message' => 'order_id is required.']);
    exit;
}

$stmt = $db->prepare(
    "SELECT pr.id, pr.product_id, pr.order_id, pr.rating, pr.review,
            pr.created_at, pr.updated_at
     FROM product_reviews pr
     WHERE pr.user_id = ? AND pr.order_id = ?"
);
$stmt->execute([$user_id, $order_id]);
$reviews = $stmt->fetchAll(PDO::FETCH_ASSOC);

// Key by product_id for easy lookup
$byProduct = [];
foreach ($reviews as $r) {
    $byProduct[(int)$r['product_id']] = $r;
}

echo json_encode([
    'reviews'    => $reviews,
    'by_product' => $byProduct,
]);
