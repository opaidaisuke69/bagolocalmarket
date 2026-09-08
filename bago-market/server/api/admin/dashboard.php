<?php
require_once '../config/cors.php';
require_once '../config/database.php';
require_once '../middleware/auth.php';

$database = new Database();
$db = $database->getConnection();
$auth = new AuthMiddleware($db);
$payload = $auth->requireRole(['admin']);

$stats = [];

// ── Basic counts ──────────────────────────────────────────────────────────────
$stmt = $db->query("SELECT COUNT(*) as count FROM users WHERE role='buyer'  AND deleted_at IS NULL");
$stats['total_buyers'] = (int)$stmt->fetch(PDO::FETCH_ASSOC)['count'];

$stmt = $db->query("SELECT COUNT(*) as count FROM users WHERE role='seller' AND deleted_at IS NULL");
$stats['total_sellers'] = (int)$stmt->fetch(PDO::FETCH_ASSOC)['count'];

$stmt = $db->query("SELECT COUNT(*) as count FROM users WHERE role='rider'  AND deleted_at IS NULL");
$stats['total_riders'] = (int)$stmt->fetch(PDO::FETCH_ASSOC)['count'];

$stmt = $db->query("SELECT COUNT(*) as count FROM seller_profiles WHERE approval_status='pending'");
$stats['pending_sellers'] = (int)$stmt->fetch(PDO::FETCH_ASSOC)['count'];

// Pending rider approvals
$stats['pending_riders'] = 0;
try {
    $stmt = $db->query("SELECT COUNT(*) as count FROM rider_profiles WHERE approval_status='pending'");
    $stats['pending_riders'] = (int)$stmt->fetch(PDO::FETCH_ASSOC)['count'];
} catch (Exception $e) {}

$stmt = $db->query("SELECT COUNT(*) as count FROM products WHERE deleted_at IS NULL");
$stats['total_products'] = (int)$stmt->fetch(PDO::FETCH_ASSOC)['count'];

$stmt = $db->query("SELECT COUNT(*) as count FROM products WHERE approval_status='pending' AND deleted_at IS NULL");
$stats['pending_products'] = (int)$stmt->fetch(PDO::FETCH_ASSOC)['count'];

$stmt = $db->query("SELECT COUNT(*) as count FROM orders");
$stats['total_orders'] = (int)$stmt->fetch(PDO::FETCH_ASSOC)['count'];

$stmt = $db->query("SELECT COUNT(*) as count FROM orders WHERE status='delivered'");
$stats['completed_orders'] = (int)$stmt->fetch(PDO::FETCH_ASSOC)['count'];

$stmt = $db->query("SELECT COUNT(*) as count FROM orders WHERE status='cancelled'");
$stats['cancelled_orders'] = (int)$stmt->fetch(PDO::FETCH_ASSOC)['count'];

$stmt = $db->query("SELECT COUNT(*) as count FROM users WHERE status='active'  AND deleted_at IS NULL");
$stats['active_accounts'] = (int)$stmt->fetch(PDO::FETCH_ASSOC)['count'];

$stmt = $db->query("SELECT COUNT(*) as count FROM users WHERE status='banned'");
$stats['banned_accounts'] = (int)$stmt->fetch(PDO::FETCH_ASSOC)['count'];

// ── GMV & commission ──────────────────────────────────────────────────────────
$stmt = $db->query("SELECT COALESCE(SUM(total_amount),0) as total FROM orders WHERE status='delivered'");
$stats['total_gmv'] = (float)$stmt->fetch(PDO::FETCH_ASSOC)['total'];

$stats['total_commission']     = 0.0;
$stats['total_rider_earnings'] = 0.0;
try {
    $stmt = $db->query("SELECT COALESCE(SUM(commission_amount),0) as comm,
                               COALESCE(SUM(rider_earning),0)     as rider
                        FROM orders WHERE status='delivered'");
    $row = $stmt->fetch(PDO::FETCH_ASSOC);
    $stats['total_commission']     = (float)$row['comm'];
    $stats['total_rider_earnings'] = (float)$row['rider'];
} catch (Exception $e) {}

// ── Most buyable products (top 10 by sold_count) ──────────────────────────────
$stmt = $db->query(
    "SELECT p.id, p.name, p.price, p.sold_count, p.stock,
            sp.store_name, u.full_name AS seller_name,
            (SELECT image_url FROM product_images WHERE product_id=p.id AND is_primary=1 LIMIT 1) AS image
     FROM products p
     JOIN users u ON p.seller_id = u.id
     LEFT JOIN seller_profiles sp ON p.seller_id = sp.user_id
     WHERE p.deleted_at IS NULL AND p.approval_status='approved'
     ORDER BY p.sold_count DESC LIMIT 10"
);
$stats['top_products'] = $stmt->fetchAll(PDO::FETCH_ASSOC);

// ── Sellers with most products ────────────────────────────────────────────────
$stmt = $db->query(
    "SELECT u.id, u.full_name, sp.store_name,
            COUNT(p.id) AS product_count,
            COALESCE(SUM(p.sold_count),0) AS total_sold
     FROM users u
     JOIN seller_profiles sp ON u.id = sp.user_id
     LEFT JOIN products p ON p.seller_id = u.id AND p.deleted_at IS NULL
     WHERE u.role='seller'
     GROUP BY u.id
     ORDER BY product_count DESC LIMIT 10"
);
$stats['sellers_most_products'] = $stmt->fetchAll(PDO::FETCH_ASSOC);

// ── Sellers with most sales ───────────────────────────────────────────────────
$stmt = $db->query(
    "SELECT u.id, u.full_name, sp.store_name,
            COALESCE(SUM(oi.item_subtotal),0) AS total_sales,
            COUNT(DISTINCT oi.order_id) AS orders_count
     FROM users u
     JOIN seller_profiles sp ON u.id = sp.user_id
     LEFT JOIN order_items oi ON oi.seller_id = u.id
     LEFT JOIN orders o ON oi.order_id = o.id AND o.status='delivered'
     WHERE u.role='seller'
     GROUP BY u.id
     ORDER BY total_sales DESC LIMIT 10"
);
$stats['sellers_most_sales'] = $stmt->fetchAll(PDO::FETCH_ASSOC);

// ── Sellers with most commission contribution ─────────────────────────────────
$stmt = $db->query(
    "SELECT u.id, u.full_name, sp.store_name,
            COALESCE(SUM(oi.commission_amount),0) AS commission_contributed,
            COALESCE(SUM(oi.item_subtotal),0)     AS seller_revenue,
            COUNT(DISTINCT oi.order_id)           AS orders_count
     FROM users u
     JOIN seller_profiles sp ON u.id = sp.user_id
     LEFT JOIN order_items oi ON oi.seller_id = u.id
     LEFT JOIN orders o ON oi.order_id = o.id AND o.status='delivered'
     WHERE u.role='seller'
     GROUP BY u.id
     ORDER BY commission_contributed DESC LIMIT 10"
);
$stats['sellers_most_commission'] = $stmt->fetchAll(PDO::FETCH_ASSOC);

// ── Charts ────────────────────────────────────────────────────────────────────
$stmt = $db->query(
    "SELECT DATE(created_at) as date, COUNT(*) as count, SUM(total_amount) as revenue
     FROM orders WHERE created_at > DATE_SUB(NOW(), INTERVAL 30 DAY)
     GROUP BY DATE(created_at) ORDER BY date"
);
$stats['orders_chart'] = $stmt->fetchAll(PDO::FETCH_ASSOC);

$stmt = $db->query(
    "SELECT DATE_FORMAT(created_at,'%Y-%m') as month, COUNT(*) as count
     FROM users WHERE role='seller' AND created_at > DATE_SUB(NOW(), INTERVAL 12 MONTH)
     GROUP BY month ORDER BY month"
);
$stats['seller_growth'] = $stmt->fetchAll(PDO::FETCH_ASSOC);

$stmt = $db->query(
    "SELECT DATE_FORMAT(created_at,'%Y-%m') as month, COUNT(*) as count
     FROM users WHERE role='buyer' AND created_at > DATE_SUB(NOW(), INTERVAL 12 MONTH)
     GROUP BY month ORDER BY month"
);
$stats['buyer_growth'] = $stmt->fetchAll(PDO::FETCH_ASSOC);

$stmt = $db->query("SELECT status, COUNT(*) as count FROM orders GROUP BY status");
$stats['order_status_distribution'] = $stmt->fetchAll(PDO::FETCH_ASSOC);

$stmt = $db->query(
    "SELECT c.name, COUNT(p.id) as product_count, COALESCE(SUM(p.sold_count),0) as total_sold
     FROM categories c LEFT JOIN products p ON c.id=p.category_id AND p.deleted_at IS NULL
     GROUP BY c.id ORDER BY total_sold DESC LIMIT 10"
);
$stats['top_categories'] = $stmt->fetchAll(PDO::FETCH_ASSOC);

echo json_encode(["stats" => $stats]);
