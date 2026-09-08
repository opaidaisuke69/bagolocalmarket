<?php
require_once '../config/cors.php';
require_once '../config/database.php';
require_once '../middleware/auth.php';

$database = new Database();
$db       = $database->getConnection();
$auth     = new AuthMiddleware($db);
$payload  = $auth->requireRole(['admin']);

$page   = isset($_GET['page'])   ? (int)$_GET['page']  : 1;
$limit  = isset($_GET['limit'])  ? (int)$_GET['limit'] : 20;
$offset = ($page - 1) * $limit;
$from   = isset($_GET['from'])   ? $_GET['from']  : '';
$to     = isset($_GET['to'])     ? $_GET['to']    : '';
$search = isset($_GET['search']) ? $_GET['search'] : '';

$where  = "WHERE o.status = 'delivered'";
$params = [];

if (!empty($from)) { $where .= " AND DATE(o.created_at) >= ?"; $params[] = $from; }
if (!empty($to))   { $where .= " AND DATE(o.created_at) <= ?"; $params[] = $to;   }
if (!empty($search)) {
    $where .= " AND (o.order_number LIKE ? OR u_buyer.full_name LIKE ?)";
    $params[] = "%$search%";
    $params[] = "%$search%";
}

// ── Summary totals ────────────────────────────────────────────────────────────
$sumStmt = $db->prepare(
    "SELECT
        COALESCE(SUM(o.subtotal), 0)           AS total_seller_subtotal,
        COALESCE(SUM(o.commission_amount), 0)  AS total_commission,
        COALESCE(SUM(o.rider_earning), 0)      AS total_rider_earnings,
        COALESCE(SUM(o.total_amount), 0)       AS total_gmv,
        COUNT(o.id)                            AS total_orders
     FROM orders o
     JOIN users u_buyer ON o.buyer_id = u_buyer.id
     $where"
);
$sumStmt->execute($params);
$summary = $sumStmt->fetch(PDO::FETCH_ASSOC);

// ── Paginated order list ──────────────────────────────────────────────────────
$countStmt = $db->prepare(
    "SELECT COUNT(o.id) as total
     FROM orders o
     JOIN users u_buyer ON o.buyer_id = u_buyer.id
     $where"
);
$countStmt->execute($params);
$total = $countStmt->fetch(PDO::FETCH_ASSOC)['total'];

$listStmt = $db->prepare(
    "SELECT
        o.id, o.order_number, o.created_at, o.status,
        o.subtotal, o.commission_amount, o.commission_rate,
        o.rider_earning, o.delivery_fee, o.total_amount,
        u_buyer.full_name  AS buyer_name,
        b.name             AS delivery_barangay,
        u_rider.full_name  AS rider_name
     FROM orders o
     JOIN users u_buyer  ON o.buyer_id   = u_buyer.id
     JOIN addresses a    ON o.address_id = a.id
     JOIN barangays b    ON a.barangay_id = b.id
     LEFT JOIN deliveries d  ON d.order_id  = o.id
     LEFT JOIN users u_rider ON d.rider_id  = u_rider.id
     $where
     ORDER BY o.created_at DESC
     LIMIT $limit OFFSET $offset"
);
$listStmt->execute($params);
$orders = $listStmt->fetchAll(PDO::FETCH_ASSOC);

// ── Top sellers by commission contribution ────────────────────────────────────
$topSellersStmt = $db->prepare(
    "SELECT
        u.full_name, sp.store_name,
        COALESCE(SUM(oi.commission_amount), 0) AS commission_contributed,
        COALESCE(SUM(oi.item_subtotal), 0)     AS seller_revenue,
        COUNT(DISTINCT oi.order_id)            AS orders_count
     FROM order_items oi
     JOIN orders o  ON oi.order_id  = o.id
     JOIN users u   ON oi.seller_id = u.id
     LEFT JOIN seller_profiles sp ON oi.seller_id = sp.user_id
     WHERE o.status = 'delivered'
     GROUP BY oi.seller_id
     ORDER BY commission_contributed DESC
     LIMIT 10"
);
$topSellersStmt->execute();
$topSellers = $topSellersStmt->fetchAll(PDO::FETCH_ASSOC);

// ── Commission by month (last 12 months) ─────────────────────────────────────
$monthlyStmt = $db->query(
    "SELECT
        DATE_FORMAT(o.created_at, '%Y-%m') AS month,
        COALESCE(SUM(o.commission_amount), 0) AS commission,
        COALESCE(SUM(o.rider_earning), 0)     AS rider_earnings,
        COALESCE(SUM(o.total_amount), 0)      AS gmv,
        COUNT(o.id)                           AS orders
     FROM orders o
     WHERE o.status = 'delivered'
       AND o.created_at >= DATE_SUB(NOW(), INTERVAL 12 MONTH)
     GROUP BY month
     ORDER BY month ASC"
);
$monthly = $monthlyStmt->fetchAll(PDO::FETCH_ASSOC);

echo json_encode([
    "summary"     => $summary,
    "orders"      => $orders,
    "total"       => (int)$total,
    "page"        => $page,
    "total_pages" => ceil($total / max(1, $limit)),
    "top_sellers" => $topSellers,
    "monthly"     => $monthly,
]);
