<?php
require_once '../config/cors.php';
require_once '../config/database.php';
require_once '../middleware/auth.php';

$database = new Database();
$db = $database->getConnection();
$auth = new AuthMiddleware($db);
$payload = $auth->requireRole(['admin']);

$stats = [];

// Total buyers
$stmt = $db->query("SELECT COUNT(*) as count FROM users WHERE role = 'buyer' AND deleted_at IS NULL");
$stats['total_buyers'] = $stmt->fetch(PDO::FETCH_ASSOC)['count'];

// Total sellers
$stmt = $db->query("SELECT COUNT(*) as count FROM users WHERE role = 'seller' AND deleted_at IS NULL");
$stats['total_sellers'] = $stmt->fetch(PDO::FETCH_ASSOC)['count'];

// Pending sellers
$stmt = $db->query("SELECT COUNT(*) as count FROM seller_profiles WHERE approval_status = 'pending'");
$stats['pending_sellers'] = $stmt->fetch(PDO::FETCH_ASSOC)['count'];

// Total products
$stmt = $db->query("SELECT COUNT(*) as count FROM products WHERE deleted_at IS NULL");
$stats['total_products'] = $stmt->fetch(PDO::FETCH_ASSOC)['count'];

// Pending products
$stmt = $db->query("SELECT COUNT(*) as count FROM products WHERE approval_status = 'pending' AND deleted_at IS NULL");
$stats['pending_products'] = $stmt->fetch(PDO::FETCH_ASSOC)['count'];

// Total orders
$stmt = $db->query("SELECT COUNT(*) as count FROM orders");
$stats['total_orders'] = $stmt->fetch(PDO::FETCH_ASSOC)['count'];

// Completed orders
$stmt = $db->query("SELECT COUNT(*) as count FROM orders WHERE status = 'delivered'");
$stats['completed_orders'] = $stmt->fetch(PDO::FETCH_ASSOC)['count'];

// Cancelled orders
$stmt = $db->query("SELECT COUNT(*) as count FROM orders WHERE status = 'cancelled'");
$stats['cancelled_orders'] = $stmt->fetch(PDO::FETCH_ASSOC)['count'];

// GMV
$stmt = $db->query("SELECT COALESCE(SUM(total_amount), 0) as total FROM orders WHERE status = 'delivered'");
$stats['total_gmv'] = $stmt->fetch(PDO::FETCH_ASSOC)['total'];

// Active accounts
$stmt = $db->query("SELECT COUNT(*) as count FROM users WHERE status = 'active' AND deleted_at IS NULL");
$stats['active_accounts'] = $stmt->fetch(PDO::FETCH_ASSOC)['count'];

// Banned accounts
$stmt = $db->query("SELECT COUNT(*) as count FROM users WHERE status = 'banned'");
$stats['banned_accounts'] = $stmt->fetch(PDO::FETCH_ASSOC)['count'];

// Orders chart data (last 30 days)
$stmt = $db->query("SELECT DATE(created_at) as date, COUNT(*) as count, SUM(total_amount) as revenue 
    FROM orders WHERE created_at > DATE_SUB(NOW(), INTERVAL 30 DAY) 
    GROUP BY DATE(created_at) ORDER BY date");
$stats['orders_chart'] = $stmt->fetchAll(PDO::FETCH_ASSOC);

// Seller growth (last 12 months)
$stmt = $db->query("SELECT DATE_FORMAT(created_at, '%Y-%m') as month, COUNT(*) as count 
    FROM users WHERE role = 'seller' AND created_at > DATE_SUB(NOW(), INTERVAL 12 MONTH)
    GROUP BY month ORDER BY month");
$stats['seller_growth'] = $stmt->fetchAll(PDO::FETCH_ASSOC);

// Buyer growth (last 12 months)
$stmt = $db->query("SELECT DATE_FORMAT(created_at, '%Y-%m') as month, COUNT(*) as count 
    FROM users WHERE role = 'buyer' AND created_at > DATE_SUB(NOW(), INTERVAL 12 MONTH)
    GROUP BY month ORDER BY month");
$stats['buyer_growth'] = $stmt->fetchAll(PDO::FETCH_ASSOC);

// Order status distribution
$stmt = $db->query("SELECT status, COUNT(*) as count FROM orders GROUP BY status");
$stats['order_status_distribution'] = $stmt->fetchAll(PDO::FETCH_ASSOC);

// Top categories
$stmt = $db->query("SELECT c.name, COUNT(p.id) as product_count, COALESCE(SUM(p.sold_count), 0) as total_sold
    FROM categories c LEFT JOIN products p ON c.id = p.category_id AND p.deleted_at IS NULL
    GROUP BY c.id ORDER BY total_sold DESC LIMIT 10");
$stats['top_categories'] = $stmt->fetchAll(PDO::FETCH_ASSOC);

echo json_encode(["stats" => $stats]);
