<?php
/**
 * GET /rider/earnings.php?period=day|week|month|year&date=YYYY-MM-DD
 * Returns the rider's earnings, collections, and commission breakdown.
 */
require_once '../config/cors.php';
require_once '../config/database.php';
require_once '../middleware/auth.php';

$database = new Database();
$db       = $database->getConnection();
$auth     = new AuthMiddleware($db);
$payload  = $auth->requireAuth();
$riderId  = $payload['user_id'];

// ── Auto-migrate ──────────────────────────────────────────────────────────────
try {
    $db->exec("CREATE TABLE IF NOT EXISTS rider_payment_accounts (
        id             INT AUTO_INCREMENT PRIMARY KEY,
        rider_id       INT NOT NULL,
        type           ENUM('gcash','maya','bank','others') NOT NULL DEFAULT 'gcash',
        label          VARCHAR(100) NOT NULL,
        account_name   VARCHAR(255) NOT NULL,
        account_number VARCHAR(100) NOT NULL,
        qr_code_image  VARCHAR(500) NULL,
        is_primary     BOOLEAN DEFAULT FALSE,
        created_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (rider_id) REFERENCES users(id) ON DELETE CASCADE,
        INDEX idx_rider (rider_id)
    )");
    $db->exec("CREATE TABLE IF NOT EXISTS rider_remittances (
        id               INT AUTO_INCREMENT PRIMARY KEY,
        rider_id         INT NOT NULL,
        amount           DECIMAL(10,2) NOT NULL,
        period_start     DATE NOT NULL,
        period_end       DATE NOT NULL,
        receipt_image    VARCHAR(500) NOT NULL,
        reference_number VARCHAR(100) NULL,
        payment_method   VARCHAR(100) NULL,
        status           ENUM('pending','verified','rejected') DEFAULT 'pending',
        verified_by      INT NULL,
        verified_at      TIMESTAMP NULL,
        rejection_reason TEXT NULL,
        notes            TEXT NULL,
        created_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (rider_id) REFERENCES users(id),
        INDEX idx_rider (rider_id)
    )");
    $db->exec("CREATE TABLE IF NOT EXISTS remittance_qr_codes (
        id             INT AUTO_INCREMENT PRIMARY KEY,
        label          VARCHAR(100) NOT NULL,
        type           ENUM('gcash','maya','bank','others') NOT NULL DEFAULT 'gcash',
        account_name   VARCHAR(255) NOT NULL,
        account_number VARCHAR(100) NOT NULL,
        qr_code_image  VARCHAR(500) NOT NULL,
        is_active      BOOLEAN DEFAULT TRUE,
        created_by     INT NULL,
        created_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )");
} catch (Exception $e) { /* already exists */ }

$period = isset($_GET['period']) ? $_GET['period'] : 'day';
$date   = isset($_GET['date'])   ? $_GET['date']   : date('Y-m-d');

// ── Build date range ──────────────────────────────────────────────────────────
switch ($period) {
    case 'week':
        $start = date('Y-m-d', strtotime('monday this week', strtotime($date)));
        $end   = date('Y-m-d', strtotime('sunday this week', strtotime($date)));
        break;
    case 'month':
        $start = date('Y-m-01', strtotime($date));
        $end   = date('Y-m-t',  strtotime($date));
        break;
    case 'year':
        $start = date('Y-01-01', strtotime($date));
        $end   = date('Y-12-31', strtotime($date));
        break;
    default: // day
        $start = $date;
        $end   = $date;
        break;
}

// ── Summary for the period ────────────────────────────────────────────────────
$stmt = $db->prepare(
    "SELECT
        COUNT(o.id)                        AS deliveries_count,
        COALESCE(SUM(o.total_amount), 0)   AS total_collections,
        COALESCE(SUM(o.rider_earning), 0)  AS total_commission,
        COALESCE(SUM(o.delivery_fee), 0)   AS total_shipping_fees
     FROM orders o
     JOIN deliveries d ON d.order_id = o.id
     WHERE d.rider_id = ?
       AND o.status = 'delivered'
       AND DATE(d.delivered_at) BETWEEN ? AND ?"
);
$stmt->execute([$riderId, $start, $end]);
$summary = $stmt->fetch(PDO::FETCH_ASSOC);

// ── Daily breakdown for charts (within the period) ────────────────────────────
$stmt = $db->prepare(
    "SELECT
        DATE(d.delivered_at)               AS date,
        COUNT(o.id)                        AS deliveries,
        COALESCE(SUM(o.total_amount), 0)   AS collections,
        COALESCE(SUM(o.rider_earning), 0)  AS commission
     FROM orders o
     JOIN deliveries d ON d.order_id = o.id
     WHERE d.rider_id = ?
       AND o.status = 'delivered'
       AND DATE(d.delivered_at) BETWEEN ? AND ?
     GROUP BY DATE(d.delivered_at)
     ORDER BY date ASC"
);
$stmt->execute([$riderId, $start, $end]);
$dailyBreakdown = $stmt->fetchAll(PDO::FETCH_ASSOC);

// ── Delivered orders in this period (with per-item commission) ────────────────
$stmt = $db->prepare(
    "SELECT
        o.id, o.order_number, o.total_amount, o.rider_earning, o.delivery_fee,
        o.commission_amount,
        a.recipient_name, b.name AS barangay_name,
        d.delivered_at
     FROM orders o
     JOIN deliveries d ON d.order_id = o.id
     JOIN addresses a  ON o.address_id = a.id
     JOIN barangays b  ON a.barangay_id = b.id
     WHERE d.rider_id = ?
       AND o.status = 'delivered'
       AND DATE(d.delivered_at) BETWEEN ? AND ?
     ORDER BY d.delivered_at DESC"
);
$stmt->execute([$riderId, $start, $end]);
$orders = $stmt->fetchAll(PDO::FETCH_ASSOC);

// Attach items with commission per product
foreach ($orders as &$order) {
    $iStmt = $db->prepare(
        "SELECT oi.quantity, oi.price, oi.item_subtotal, oi.commission_amount, oi.item_total,
                p.name AS product_name,
                sp.store_name
         FROM order_items oi
         JOIN products p ON oi.product_id = p.id
         LEFT JOIN seller_profiles sp ON oi.seller_id = sp.user_id
         WHERE oi.order_id = ?"
    );
    $iStmt->execute([$order['id']]);
    $order['items'] = $iStmt->fetchAll(PDO::FETCH_ASSOC);
}

// ── All-time totals ───────────────────────────────────────────────────────────
$stmt = $db->prepare(
    "SELECT
        COUNT(o.id)                       AS total_deliveries,
        COALESCE(SUM(o.total_amount), 0)  AS lifetime_collections,
        COALESCE(SUM(o.rider_earning), 0) AS lifetime_commission
     FROM orders o
     JOIN deliveries d ON d.order_id = o.id
     WHERE d.rider_id = ? AND o.status = 'delivered'"
);
$stmt->execute([$riderId]);
$allTime = $stmt->fetch(PDO::FETCH_ASSOC);

// ── Today's quick stats ───────────────────────────────────────────────────────
$today = date('Y-m-d');
$stmt = $db->prepare(
    "SELECT
        COUNT(o.id)                       AS today_deliveries,
        COALESCE(SUM(o.total_amount), 0)  AS today_collections,
        COALESCE(SUM(o.rider_earning), 0) AS today_commission
     FROM orders o
     JOIN deliveries d ON d.order_id = o.id
     WHERE d.rider_id = ? AND o.status = 'delivered'
       AND DATE(d.delivered_at) = ?"
);
$stmt->execute([$riderId, $today]);
$todayStats = $stmt->fetch(PDO::FETCH_ASSOC);

echo json_encode([
    "period"          => $period,
    "start"           => $start,
    "end"             => $end,
    "summary"         => $summary,
    "daily_breakdown" => $dailyBreakdown,
    "orders"          => $orders,
    "all_time"        => $allTime,
    "today"           => $todayStats,
]);
