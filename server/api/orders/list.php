<?php
require_once '../config/cors.php';
require_once '../config/database.php';
require_once '../middleware/auth.php';

$database = new Database();
$db = $database->getConnection();
$auth = new AuthMiddleware($db);
$payload = $auth->requireAuth();

$page = isset($_GET['page']) ? (int)$_GET['page'] : 1;
$limit = isset($_GET['limit']) ? (int)$_GET['limit'] : 10;
$offset = ($page - 1) * $limit;
$status = isset($_GET['status']) ? $_GET['status'] : '';

$where = "";
$params = [];

if ($payload['role'] === 'buyer') {
    $where = "WHERE o.buyer_id = ?";
    $params[] = $payload['user_id'];
} elseif ($payload['role'] === 'seller') {
    $where = "WHERE oi.seller_id = ?";
    $params[] = $payload['user_id'];
} else {
    $where = "WHERE 1=1";
}

if (!empty($status)) {
    // Support grouped tab filters (Shopee-style)
    if ($status === 'to_pay') {
        $where .= " AND o.status IN ('pending', 'confirmed')";
    } elseif ($status === 'to_ship') {
        $where .= " AND o.status IN ('preparing', 'ready_to_ship')";
    } elseif ($status === 'to_receive') {
        $where .= " AND o.status IN ('shipped', 'out_for_delivery')";
    } else {
        $where .= " AND o.status = ?";
        $params[] = $status;
    }
}

// Count
$countQuery = "SELECT COUNT(DISTINCT o.id) as total FROM orders o 
    LEFT JOIN order_items oi ON o.id = oi.order_id $where";
$stmt = $db->prepare($countQuery);
$stmt->execute($params);
$total = $stmt->fetch(PDO::FETCH_ASSOC)['total'];

// Get orders
$query = "SELECT DISTINCT o.*, a.recipient_name, a.contact_number as delivery_contact,
    a.street_address, b.name as barangay_name, u.full_name as buyer_name
    FROM orders o
    LEFT JOIN order_items oi ON o.id = oi.order_id
    LEFT JOIN addresses a ON o.address_id = a.id
    LEFT JOIN barangays b ON a.barangay_id = b.id
    LEFT JOIN users u ON o.buyer_id = u.id
    $where
    ORDER BY o.created_at DESC
    LIMIT $limit OFFSET $offset";

$stmt = $db->prepare($query);
$stmt->execute($params);
$orders = $stmt->fetchAll(PDO::FETCH_ASSOC);

// Get items for each order
foreach ($orders as &$order) {
    $itemQuery = "SELECT oi.*, p.name as product_name, 
        (SELECT image_url FROM product_images WHERE product_id = p.id AND is_primary = 1 LIMIT 1) as product_image,
        u.full_name as seller_name, sp.store_name
        FROM order_items oi
        JOIN products p ON oi.product_id = p.id
        JOIN users u ON oi.seller_id = u.id
        LEFT JOIN seller_profiles sp ON oi.seller_id = sp.user_id
        WHERE oi.order_id = ?";
    
    if ($payload['role'] === 'seller') {
        $itemQuery .= " AND oi.seller_id = ?";
        $stmtItems = $db->prepare($itemQuery);
        $stmtItems->execute([$order['id'], $payload['user_id']]);
    } else {
        $stmtItems = $db->prepare($itemQuery);
        $stmtItems->execute([$order['id']]);
    }
    
    $order['items'] = $stmtItems->fetchAll(PDO::FETCH_ASSOC);
    
    // Check if order has been rated
    $stmtRated = $db->prepare("SELECT COUNT(*) as cnt FROM product_reviews WHERE order_id = ? AND user_id = ?");
    $stmtRated->execute([$order['id'], $payload['user_id']]);
    $ratedCount = $stmtRated->fetch(PDO::FETCH_ASSOC)['cnt'];
    $order['is_rated'] = $ratedCount > 0 ? true : false;
}

echo json_encode([
    "orders" => $orders,
    "total" => (int)$total,
    "page" => $page,
    "total_pages" => ceil($total / $limit)
]);
