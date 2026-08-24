<?php
require_once '../config/cors.php';
require_once '../config/database.php';
require_once '../middleware/auth.php';

$database = new Database();
$db = $database->getConnection();
$auth = new AuthMiddleware($db);
$payload = $auth->requireRole(['seller']);

$sellerId = $payload['user_id'];
$stats = [];

// Total sales
$stmt = $db->prepare("SELECT COALESCE(SUM(oi.price * oi.quantity), 0) as total FROM order_items oi JOIN orders o ON oi.order_id = o.id WHERE oi.seller_id = ? AND o.status = 'delivered'");
$stmt->execute([$sellerId]);
$stats['total_sales'] = $stmt->fetch(PDO::FETCH_ASSOC)['total'];

// Total orders
$stmt = $db->prepare("SELECT COUNT(DISTINCT oi.order_id) as count FROM order_items oi WHERE oi.seller_id = ?");
$stmt->execute([$sellerId]);
$stats['total_orders'] = $stmt->fetch(PDO::FETCH_ASSOC)['count'];

// Pending orders
$stmt = $db->prepare("SELECT COUNT(DISTINCT oi.order_id) as count FROM order_items oi JOIN orders o ON oi.order_id = o.id WHERE oi.seller_id = ? AND o.status = 'pending'");
$stmt->execute([$sellerId]);
$stats['pending_orders'] = $stmt->fetch(PDO::FETCH_ASSOC)['count'];

// Total products
$stmt = $db->prepare("SELECT COUNT(*) as count FROM products WHERE seller_id = ? AND deleted_at IS NULL");
$stmt->execute([$sellerId]);
$stats['total_products'] = $stmt->fetch(PDO::FETCH_ASSOC)['count'];

// Low stock products
$stmt = $db->prepare("SELECT COUNT(*) as count FROM products WHERE seller_id = ? AND stock <= 5 AND stock > 0 AND deleted_at IS NULL");
$stmt->execute([$sellerId]);
$stats['low_stock'] = $stmt->fetch(PDO::FETCH_ASSOC)['count'];

// Completed orders
$stmt = $db->prepare("SELECT COUNT(DISTINCT oi.order_id) as count FROM order_items oi JOIN orders o ON oi.order_id = o.id WHERE oi.seller_id = ? AND o.status = 'delivered'");
$stmt->execute([$sellerId]);
$stats['completed_orders'] = $stmt->fetch(PDO::FETCH_ASSOC)['count'];

// Cancelled orders
$stmt = $db->prepare("SELECT COUNT(DISTINCT oi.order_id) as count FROM order_items oi JOIN orders o ON oi.order_id = o.id WHERE oi.seller_id = ? AND o.status = 'cancelled'");
$stmt->execute([$sellerId]);
$stats['cancelled_orders'] = $stmt->fetch(PDO::FETCH_ASSOC)['count'];

// Daily sales (last 30 days)
$stmt = $db->prepare("SELECT DATE(o.created_at) as date, COALESCE(SUM(oi.price * oi.quantity), 0) as sales, COUNT(DISTINCT oi.order_id) as orders
    FROM order_items oi JOIN orders o ON oi.order_id = o.id 
    WHERE oi.seller_id = ? AND o.created_at > DATE_SUB(NOW(), INTERVAL 30 DAY) AND o.status != 'cancelled'
    GROUP BY DATE(o.created_at) ORDER BY date");
$stmt->execute([$sellerId]);
$stats['daily_sales'] = $stmt->fetchAll(PDO::FETCH_ASSOC);

// Top selling products
$stmt = $db->prepare("SELECT p.name, p.sold_count, p.price,
    (SELECT image_url FROM product_images WHERE product_id = p.id AND is_primary = 1 LIMIT 1) as image
    FROM products p WHERE p.seller_id = ? AND p.deleted_at IS NULL ORDER BY p.sold_count DESC LIMIT 5");
$stmt->execute([$sellerId]);
$stats['top_products'] = $stmt->fetchAll(PDO::FETCH_ASSOC);

// Products by category
$stmt = $db->prepare("SELECT c.name, COUNT(p.id) as count FROM products p JOIN categories c ON p.category_id = c.id WHERE p.seller_id = ? AND p.deleted_at IS NULL GROUP BY c.id ORDER BY count DESC");
$stmt->execute([$sellerId]);
$stats['products_by_category'] = $stmt->fetchAll(PDO::FETCH_ASSOC);

echo json_encode(["stats" => $stats]);
