<?php
require_once '../config/cors.php';
require_once '../config/database.php';
require_once '../middleware/auth.php';

$database = new Database();
$db = $database->getConnection();
$auth = new AuthMiddleware($db);
$payload = $auth->requireAuth();

if ($_SERVER['REQUEST_METHOD'] !== 'POST' && $_SERVER['REQUEST_METHOD'] !== 'PUT') {
    http_response_code(405);
    echo json_encode(["message" => "Method not allowed."]);
    exit;
}

$data = json_decode(file_get_contents("php://input"));

if (empty($data->product_id) || empty($data->rating)) {
    http_response_code(400);
    echo json_encode(["message" => "Product ID and rating are required."]);
    exit;
}

$product_id = (int)$data->product_id;
$order_id = isset($data->order_id) ? (int)$data->order_id : null;
$rating = max(1, min(5, (int)$data->rating));
$comment = isset($data->comment) ? trim($data->comment) : '';
$user_id = $payload['user_id'];
$review_id = isset($data->review_id) ? (int)$data->review_id : null;

// UPDATE existing review
if ($_SERVER['REQUEST_METHOD'] === 'PUT' || $review_id) {
    if ($review_id) {
        // Verify ownership
        $stmt = $db->prepare("SELECT id FROM product_reviews WHERE id = ? AND user_id = ?");
        $stmt->execute([$review_id, $user_id]);
        if ($stmt->rowCount() === 0) {
            http_response_code(404);
            echo json_encode(["message" => "Review not found."]);
            exit;
        }
        $stmt = $db->prepare("UPDATE product_reviews SET rating = ?, review = ?, updated_at = NOW() WHERE id = ?");
        $stmt->execute([$rating, $comment, $review_id]);
    } else {
        // Find by user + product + order
        $stmt = $db->prepare("SELECT id FROM product_reviews WHERE user_id = ? AND product_id = ? AND order_id = ?");
        $stmt->execute([$user_id, $product_id, $order_id]);
        if ($stmt->rowCount() > 0) {
            $existingId = $stmt->fetch(PDO::FETCH_ASSOC)['id'];
            $stmt = $db->prepare("UPDATE product_reviews SET rating = ?, review = ?, updated_at = NOW() WHERE id = ?");
            $stmt->execute([$rating, $comment, $existingId]);
        } else {
            http_response_code(404);
            echo json_encode(["message" => "Review not found to update."]);
            exit;
        }
    }
} else {
    // CREATE new review
    // Check if user already reviewed this product for this order
    if ($order_id) {
        $stmt = $db->prepare("SELECT id FROM product_reviews WHERE user_id = ? AND product_id = ? AND order_id = ?");
        $stmt->execute([$user_id, $product_id, $order_id]);
        if ($stmt->rowCount() > 0) {
            http_response_code(409);
            echo json_encode(["message" => "You already reviewed this product for this order."]);
            exit;
        }
    }

    // Insert review
    $stmt = $db->prepare("INSERT INTO product_reviews (user_id, product_id, order_id, rating, review, created_at) VALUES (?, ?, ?, ?, ?, NOW())");
    $stmt->execute([$user_id, $product_id, $order_id, $rating, $comment]);
}

// Update product average rating
$stmt = $db->prepare("SELECT AVG(rating) as avg_rating, COUNT(*) as total FROM product_reviews WHERE product_id = ?");
$stmt->execute([$product_id]);
$result = $stmt->fetch(PDO::FETCH_ASSOC);

$avg_rating = round($result['avg_rating'], 2);
$rating_count = (int)$result['total'];

$stmt = $db->prepare("UPDATE products SET rating = ?, rating_count = ? WHERE id = ?");
$stmt->execute([$avg_rating, $rating_count, $product_id]);

// Update seller's overall rating (average of all their product ratings)
$stmt = $db->prepare("SELECT p.seller_id FROM products p WHERE p.id = ?");
$stmt->execute([$product_id]);
$seller = $stmt->fetch(PDO::FETCH_ASSOC);

if ($seller) {
    $stmt = $db->prepare("SELECT AVG(pr.rating) as avg FROM product_reviews pr JOIN products p ON pr.product_id = p.id WHERE p.seller_id = ?");
    $stmt->execute([$seller['seller_id']]);
    $sellerAvg = $stmt->fetch(PDO::FETCH_ASSOC);
    $sellerRating = round($sellerAvg['avg'] ?? 0, 2);
    
    $stmt = $db->prepare("UPDATE seller_profiles SET rating = ? WHERE user_id = ?");
    $stmt->execute([$sellerRating, $seller['seller_id']]);
}

echo json_encode([
    "message" => "Review submitted successfully.",
    "review_id" => $db->lastInsertId(),
    "avg_rating" => $avg_rating,
    "rating_count" => $rating_count
]);
