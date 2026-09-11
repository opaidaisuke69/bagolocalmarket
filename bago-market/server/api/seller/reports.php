<?php
/**
 * Seller Reports API  (PHP 7.4 compatible — no match expressions)
 *
 * GET ?type=summary&from=&to=
 * GET ?type=sales&from=&to=&group=day|week|month
 * GET ?type=orders&from=&to=&status=
 * GET ?type=products&from=&to=
 * GET ?type=payouts
 */

error_reporting(E_ALL);
ini_set('display_errors', 0);
ini_set('log_errors', 1);

require_once '../config/cors.php';
require_once '../config/database.php';
require_once '../middleware/auth.php';

$database = new Database();
$db       = $database->getConnection();
$auth     = new AuthMiddleware($db);
$payload  = $auth->requireRole(['seller']);

$sellerId = (int)$payload['user_id'];
$type     = isset($_GET['type'])   ? $_GET['type']   : 'summary';
$from     = isset($_GET['from'])   ? $_GET['from']   : date('Y-m-01');
$to       = isset($_GET['to'])     ? $_GET['to']     : date('Y-m-d');
$group    = isset($_GET['group'])  ? $_GET['group']  : 'day';
$status   = isset($_GET['status']) ? $_GET['status'] : '';

// Clamp range to 366 days
$fromTs = strtotime($from);
$toTs   = strtotime($to);
if (!$fromTs || !$toTs) { $fromTs = strtotime(date('Y-m-01')); $toTs = strtotime(date('Y-m-d')); }
if ($toTs < $fromTs)    { $toTs = $fromTs; }
if ($toTs - $fromTs > 86400 * 366) $fromTs = $toTs - 86400 * 366;
$from = date('Y-m-d', $fromTs);
$to   = date('Y-m-d', $toTs);

// ── helpers ───────────────────────────────────────────────────────────────
// Safely get a column's value — falls back to 0 if column doesn't exist
function safeCoalesce($col) {
    return "COALESCE($col, 0)";
}

// Check whether item_subtotal column exists on order_items
function hasItemSubtotal($db) {
    static $checked = null;
    if ($checked !== null) return $checked;
    try {
        $db->query("SELECT item_subtotal FROM order_items LIMIT 1");
        $checked = true;
    } catch (Exception $e) {
        $checked = false;
    }
    return $checked;
}

// Revenue expression: use item_subtotal if available, else price*quantity
function revenueExpr($db) {
    if (hasItemSubtotal($db)) {
        return 'COALESCE(oi.item_subtotal, 0)';
    }
    return 'COALESCE(oi.price * oi.quantity, 0)';
}

// Commission expression
function commissionExpr($db) {
    try {
        $db->query("SELECT commission_amount FROM order_items LIMIT 1");
        return 'COALESCE(oi.commission_amount, 0)';
    } catch (Exception $e) {
        // Fallback: estimate 2%
        return 'COALESCE(oi.price * oi.quantity * 0.02, 0)';
    }
}

$rev  = revenueExpr($db);
$comm = commissionExpr($db);

// =============================================================================
// SUMMARY
// =============================================================================
if ($type === 'summary') {
    $kpi = [];
    try {
        $s = $db->prepare(
            "SELECT
                COALESCE(SUM($rev),         0) AS gross_revenue,
                COALESCE(SUM($comm),        0) AS commission,
                COALESCE(SUM($rev) - SUM($comm), 0) AS net_revenue,
                COUNT(DISTINCT o.id)            AS order_count,
                COALESCE(SUM(oi.quantity),  0) AS units_sold
             FROM order_items oi
             JOIN orders o ON o.id = oi.order_id
             WHERE oi.seller_id = ?
               AND o.status = 'delivered'
               AND DATE(o.created_at) BETWEEN ? AND ?"
        );
        $s->execute([$sellerId, $from, $to]);
        $kpi = $s->fetch(PDO::FETCH_ASSOC);
    } catch (Exception $e) {
        $kpi = ['gross_revenue'=>0,'commission'=>0,'net_revenue'=>0,'order_count'=>0,'units_sold'=>0];
    }

    // Pending orders (all time)
    try {
        $p = $db->prepare(
            "SELECT COUNT(DISTINCT o.id)
             FROM order_items oi JOIN orders o ON o.id = oi.order_id
             WHERE oi.seller_id = ? AND o.status = 'pending'"
        );
        $p->execute([$sellerId]);
        $kpi['pending_orders'] = (int)$p->fetchColumn();
    } catch (Exception $e) { $kpi['pending_orders'] = 0; }

    // Cancelled in period
    try {
        $c = $db->prepare(
            "SELECT COUNT(DISTINCT o.id)
             FROM order_items oi JOIN orders o ON o.id = oi.order_id
             WHERE oi.seller_id = ? AND o.status = 'cancelled'
               AND DATE(o.created_at) BETWEEN ? AND ?"
        );
        $c->execute([$sellerId, $from, $to]);
        $kpi['cancelled_orders'] = (int)$c->fetchColumn();
    } catch (Exception $e) { $kpi['cancelled_orders'] = 0; }

    // Active products
    try {
        $pr = $db->prepare(
            "SELECT COUNT(*) FROM products
             WHERE seller_id = ? AND deleted_at IS NULL AND approval_status = 'approved'"
        );
        $pr->execute([$sellerId]);
        $kpi['active_products'] = (int)$pr->fetchColumn();
    } catch (Exception $e) { $kpi['active_products'] = 0; }

    // Low stock (≤5)
    try {
        $ls = $db->prepare(
            "SELECT COUNT(*) FROM products
             WHERE seller_id = ? AND deleted_at IS NULL AND stock <= 5 AND stock > 0"
        );
        $ls->execute([$sellerId]);
        $kpi['low_stock'] = (int)$ls->fetchColumn();
    } catch (Exception $e) { $kpi['low_stock'] = 0; }

    // Out of stock
    try {
        $os = $db->prepare(
            "SELECT COUNT(*) FROM products
             WHERE seller_id = ? AND deleted_at IS NULL AND stock = 0"
        );
        $os->execute([$sellerId]);
        $kpi['out_of_stock'] = (int)$os->fetchColumn();
    } catch (Exception $e) { $kpi['out_of_stock'] = 0; }

    echo json_encode(['summary' => $kpi, 'from' => $from, 'to' => $to]);
    exit;
}

// =============================================================================
// SALES SERIES
// =============================================================================
if ($type === 'sales') {
    // PHP 7.4-safe grouping expressions
    if ($group === 'week') {
        $groupExpr = "YEARWEEK(o.created_at, 1)";
        $labelExpr = "DATE_FORMAT(MIN(o.created_at), '%b %d')";
    } elseif ($group === 'month') {
        $groupExpr = "DATE_FORMAT(o.created_at, '%Y-%m')";
        $labelExpr = "DATE_FORMAT(o.created_at, '%b %Y')";
    } else {
        $groupExpr = "DATE(o.created_at)";
        $labelExpr = "DATE(o.created_at)";
    }

    try {
        $s = $db->prepare(
            "SELECT
                $labelExpr                      AS label,
                COALESCE(SUM($rev),         0)  AS gross,
                COALESCE(SUM($comm),        0)  AS commission,
                COALESCE(SUM($rev) - SUM($comm), 0) AS net,
                COUNT(DISTINCT o.id)            AS orders,
                COALESCE(SUM(oi.quantity),  0)  AS units
             FROM order_items oi
             JOIN orders o ON o.id = oi.order_id
             WHERE oi.seller_id = ?
               AND o.status NOT IN ('cancelled')
               AND DATE(o.created_at) BETWEEN ? AND ?
             GROUP BY $groupExpr
             ORDER BY MIN(o.created_at) ASC"
        );
        $s->execute([$sellerId, $from, $to]);
        $series = $s->fetchAll(PDO::FETCH_ASSOC);
    } catch (Exception $e) {
        $series = [];
    }

    echo json_encode(['series' => $series, 'from' => $from, 'to' => $to, 'group' => $group]);
    exit;
}

// =============================================================================
// ORDERS LIST
// =============================================================================
if ($type === 'orders') {
    $where  = "oi.seller_id = ? AND DATE(o.created_at) BETWEEN ? AND ?";
    $params = [$sellerId, $from, $to];
    if ($status !== '') {
        $where   .= " AND o.status = ?";
        $params[] = $status;
    }

    try {
        $s = $db->prepare(
            "SELECT
                o.order_number,
                o.created_at,
                o.status,
                u.full_name                         AS buyer_name,
                b.name                              AS barangay,
                COALESCE(SUM($rev),             0)  AS subtotal,
                COALESCE(SUM($comm),            0)  AS commission,
                COALESCE(SUM($rev) - SUM($comm), 0) AS net_payout,
                COALESCE(o.delivery_fee,        0)  AS delivery_fee,
                COALESCE(o.total_amount,        0)  AS total_amount,
                COALESCE(SUM(oi.quantity),      0)  AS total_qty,
                GROUP_CONCAT(p.name ORDER BY p.name SEPARATOR ', ') AS products
             FROM order_items oi
             JOIN orders o   ON o.id  = oi.order_id
             JOIN users  u   ON u.id  = o.buyer_id
             JOIN products p ON p.id  = oi.product_id
             LEFT JOIN addresses a  ON a.id  = o.address_id
             LEFT JOIN barangays b  ON b.id  = a.barangay_id
             WHERE $where
             GROUP BY o.id, o.order_number, o.created_at, o.status,
                      u.full_name, b.name, o.delivery_fee, o.total_amount
             ORDER BY o.created_at DESC
             LIMIT 1000"
        );
        $s->execute($params);
        $orders = $s->fetchAll(PDO::FETCH_ASSOC);
    } catch (Exception $e) {
        $orders = [];
    }

    echo json_encode(['orders' => $orders, 'from' => $from, 'to' => $to]);
    exit;
}

// =============================================================================
// TOP PRODUCTS
// =============================================================================
if ($type === 'products') {
    try {
        $s = $db->prepare(
            "SELECT
                p.name                              AS product_name,
                c.name                              AS category,
                p.price,
                COALESCE(SUM(oi.quantity),      0)  AS units_sold,
                COALESCE(SUM($rev),             0)  AS gross_revenue,
                COALESCE(SUM($comm),            0)  AS commission,
                COALESCE(SUM($rev) - SUM($comm), 0) AS net_revenue,
                p.stock,
                p.approval_status
             FROM order_items oi
             JOIN products p    ON p.id = oi.product_id
             LEFT JOIN categories c ON c.id = p.category_id
             JOIN orders o      ON o.id = oi.order_id
             WHERE oi.seller_id = ?
               AND o.status = 'delivered'
               AND DATE(o.created_at) BETWEEN ? AND ?
             GROUP BY p.id, p.name, c.name, p.price, p.stock, p.approval_status
             ORDER BY gross_revenue DESC
             LIMIT 200"
        );
        $s->execute([$sellerId, $from, $to]);
        $products = $s->fetchAll(PDO::FETCH_ASSOC);
    } catch (Exception $e) {
        $products = [];
    }

    echo json_encode(['products' => $products, 'from' => $from, 'to' => $to]);
    exit;
}

// =============================================================================
// PAYOUT HISTORY
// =============================================================================
if ($type === 'payouts') {
    try {
        $s = $db->prepare(
            "SELECT
                py.payout_period_start,
                py.payout_period_end,
                py.gross_amount,
                py.commission_amount,
                py.net_amount,
                py.order_count,
                py.status,
                py.reference_number,
                py.payment_method,
                py.released_at,
                sra.label          AS account_label,
                sra.account_number AS account_number,
                sra.type           AS account_type
             FROM seller_payouts py
             LEFT JOIN seller_remittance_accounts sra
                    ON sra.id = py.remittance_account_id
             WHERE py.seller_id = ?
             ORDER BY py.created_at DESC
             LIMIT 200"
        );
        $s->execute([$sellerId]);
        $payouts = $s->fetchAll(PDO::FETCH_ASSOC);
    } catch (Exception $e) {
        $payouts = [];
    }

    echo json_encode(['payouts' => $payouts]);
    exit;
}

http_response_code(400);
echo json_encode(['message' => "Unknown report type: $type"]);
