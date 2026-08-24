<?php
require_once '../config/cors.php';
require_once '../config/database.php';
require_once '../middleware/auth.php';

$database = new Database();
$db = $database->getConnection();
$auth = new AuthMiddleware($db);

$payload = $auth->validateToken();
$type = isset($_GET['type']) ? $_GET['type'] : 'general';
$limit = isset($_GET['limit']) ? (int)$_GET['limit'] : 12;
$productId = isset($_GET['product_id']) ? (int)$_GET['product_id'] : 0;

$recommendations = [];

if ($payload) {
    $userId = $payload['user_id'];

    switch ($type) {
        case 'for_you':
            // Content + Behavior based recommendations
            $recommendations = getPersonalizedRecommendations($db, $userId, $limit);
            break;
        case 'because_viewed':
            $recommendations = getBecauseViewedRecommendations($db, $userId, $limit);
            break;
        case 'similar':
            if ($productId > 0) {
                $recommendations = getSimilarProducts($db, $productId, $limit);
            }
            break;
        case 'trending_barangay':
            $recommendations = getTrendingInBarangay($db, $userId, $limit);
            break;
        default:
            $recommendations = getPopularRecommendations($db, $limit);
    }
} else {
    // For non-authenticated users, show popular/trending
    $recommendations = getPopularRecommendations($db, $limit);
}

echo json_encode([
    "recommendations" => $recommendations,
    "type" => $type
]);

// --- Recommendation Functions ---

function getPersonalizedRecommendations($db, $userId, $limit) {
    // Get user's interaction categories
    $stmt = $db->prepare("SELECT DISTINCT p.category_id, COUNT(*) as weight 
        FROM product_interactions pi 
        JOIN products p ON pi.product_id = p.id 
        WHERE pi.user_id = ? AND pi.created_at > DATE_SUB(NOW(), INTERVAL 30 DAY)
        GROUP BY p.category_id ORDER BY weight DESC LIMIT 5");
    $stmt->execute([$userId]);
    $categories = $stmt->fetchAll(PDO::FETCH_ASSOC);

    if (empty($categories)) {
        return getPopularRecommendations($db, $limit);
    }

    $categoryIds = array_column($categories, 'category_id');
    $placeholders = implode(',', array_fill(0, count($categoryIds), '?'));

    // Get viewed product IDs to exclude
    $stmt = $db->prepare("SELECT DISTINCT product_id FROM product_interactions WHERE user_id = ? AND interaction_type = 'purchase'");
    $stmt->execute([$userId]);
    $purchasedIds = array_column($stmt->fetchAll(PDO::FETCH_ASSOC), 'product_id');
    $excludeClause = !empty($purchasedIds) ? "AND p.id NOT IN (" . implode(',', array_fill(0, count($purchasedIds), '?')) . ")" : "";

    $params = array_merge($categoryIds, $purchasedIds);

    $query = "SELECT p.*, c.name as category_name, 
        (SELECT image_url FROM product_images WHERE product_id = p.id AND is_primary = 1 LIMIT 1) as primary_image,
        sp.store_name, u.full_name as seller_name, b.name as barangay_name
        FROM products p
        LEFT JOIN categories c ON p.category_id = c.id
        LEFT JOIN users u ON p.seller_id = u.id
        LEFT JOIN seller_profiles sp ON p.seller_id = sp.user_id
        LEFT JOIN barangays b ON p.barangay_id = b.id
        WHERE p.category_id IN ($placeholders) 
        AND p.approval_status = 'approved' AND p.is_available = 1 AND p.deleted_at IS NULL
        $excludeClause
        ORDER BY p.rating DESC, p.sold_count DESC
        LIMIT $limit";

    $stmt = $db->prepare($query);
    $stmt->execute($params);
    $results = $stmt->fetchAll(PDO::FETCH_ASSOC);

    // Log recommendations
    foreach ($results as $r) {
        $logStmt = $db->prepare("INSERT INTO recommendation_logs (user_id, product_id, recommendation_type, score) VALUES (?, ?, 'content_based', ?)");
        $logStmt->execute([$userId, $r['id'], $r['rating'] ?? 0]);
    }

    return $results;
}

function getBecauseViewedRecommendations($db, $userId, $limit) {
    // Get recently viewed products' categories
    $stmt = $db->prepare("SELECT DISTINCT p.category_id, p.id as viewed_id
        FROM product_interactions pi 
        JOIN products p ON pi.product_id = p.id 
        WHERE pi.user_id = ? AND pi.interaction_type = 'view'
        ORDER BY pi.created_at DESC LIMIT 5");
    $stmt->execute([$userId]);
    $viewed = $stmt->fetchAll(PDO::FETCH_ASSOC);

    if (empty($viewed)) {
        return getPopularRecommendations($db, $limit);
    }

    $viewedIds = array_column($viewed, 'viewed_id');
    $categoryIds = array_unique(array_column($viewed, 'category_id'));
    $catPlaceholders = implode(',', array_fill(0, count($categoryIds), '?'));
    $excludePlaceholders = implode(',', array_fill(0, count($viewedIds), '?'));

    $params = array_merge($categoryIds, $viewedIds);

    $query = "SELECT p.*, c.name as category_name,
        (SELECT image_url FROM product_images WHERE product_id = p.id AND is_primary = 1 LIMIT 1) as primary_image,
        sp.store_name, u.full_name as seller_name, b.name as barangay_name
        FROM products p
        LEFT JOIN categories c ON p.category_id = c.id
        LEFT JOIN users u ON p.seller_id = u.id
        LEFT JOIN seller_profiles sp ON p.seller_id = sp.user_id
        LEFT JOIN barangays b ON p.barangay_id = b.id
        WHERE p.category_id IN ($catPlaceholders)
        AND p.id NOT IN ($excludePlaceholders)
        AND p.approval_status = 'approved' AND p.is_available = 1 AND p.deleted_at IS NULL
        ORDER BY p.sold_count DESC, p.rating DESC
        LIMIT $limit";

    $stmt = $db->prepare($query);
    $stmt->execute($params);
    return $stmt->fetchAll(PDO::FETCH_ASSOC);
}

function getSimilarProducts($db, $productId, $limit) {
    // Get product details
    $stmt = $db->prepare("SELECT category_id, price, barangay_id FROM products WHERE id = ?");
    $stmt->execute([$productId]);
    $product = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$product) return [];

    $priceRange = $product['price'] * 0.5;

    $query = "SELECT p.*, c.name as category_name,
        (SELECT image_url FROM product_images WHERE product_id = p.id AND is_primary = 1 LIMIT 1) as primary_image,
        sp.store_name, u.full_name as seller_name, b.name as barangay_name
        FROM products p
        LEFT JOIN categories c ON p.category_id = c.id
        LEFT JOIN users u ON p.seller_id = u.id
        LEFT JOIN seller_profiles sp ON p.seller_id = sp.user_id
        LEFT JOIN barangays b ON p.barangay_id = b.id
        WHERE p.id != ? AND p.category_id = ?
        AND p.price BETWEEN ? AND ?
        AND p.approval_status = 'approved' AND p.is_available = 1 AND p.deleted_at IS NULL
        ORDER BY p.rating DESC, p.sold_count DESC
        LIMIT $limit";

    $stmt = $db->prepare($query);
    $stmt->execute([$productId, $product['category_id'], $product['price'] - $priceRange, $product['price'] + $priceRange]);
    return $stmt->fetchAll(PDO::FETCH_ASSOC);
}

function getTrendingInBarangay($db, $userId, $limit) {
    // Get user's barangay
    $stmt = $db->prepare("SELECT barangay_id FROM buyer_profiles WHERE user_id = ?");
    $stmt->execute([$userId]);
    $profile = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$profile || !$profile['barangay_id']) {
        return getPopularRecommendations($db, $limit);
    }

    $query = "SELECT p.*, c.name as category_name,
        (SELECT image_url FROM product_images WHERE product_id = p.id AND is_primary = 1 LIMIT 1) as primary_image,
        sp.store_name, u.full_name as seller_name, b.name as barangay_name
        FROM products p
        LEFT JOIN categories c ON p.category_id = c.id
        LEFT JOIN users u ON p.seller_id = u.id
        LEFT JOIN seller_profiles sp ON p.seller_id = sp.user_id
        LEFT JOIN barangays b ON p.barangay_id = b.id
        WHERE p.barangay_id = ? 
        AND p.approval_status = 'approved' AND p.is_available = 1 AND p.deleted_at IS NULL
        ORDER BY p.sold_count DESC, p.created_at DESC
        LIMIT $limit";

    $stmt = $db->prepare($query);
    $stmt->execute([$profile['barangay_id']]);
    return $stmt->fetchAll(PDO::FETCH_ASSOC);
}

function getPopularRecommendations($db, $limit) {
    $query = "SELECT p.*, c.name as category_name,
        (SELECT image_url FROM product_images WHERE product_id = p.id AND is_primary = 1 LIMIT 1) as primary_image,
        sp.store_name, u.full_name as seller_name, b.name as barangay_name
        FROM products p
        LEFT JOIN categories c ON p.category_id = c.id
        LEFT JOIN users u ON p.seller_id = u.id
        LEFT JOIN seller_profiles sp ON p.seller_id = sp.user_id
        LEFT JOIN barangays b ON p.barangay_id = b.id
        WHERE p.approval_status = 'approved' AND p.is_available = 1 AND p.deleted_at IS NULL
        ORDER BY p.sold_count DESC, p.view_count DESC, p.rating DESC
        LIMIT $limit";

    $stmt = $db->prepare($query);
    $stmt->execute();
    return $stmt->fetchAll(PDO::FETCH_ASSOC);
}
