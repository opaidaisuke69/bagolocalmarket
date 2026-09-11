<?php
/**
 * Admin Orders API
 *
 * GET  ?search=&status=&from=&to=&page=&limit=   — paginated order list with stats
 * GET  ?action=detail&id=                         — full order detail with items
 * PUT  { order_id, status, notes }               — admin status override
 */

require_once '../config/cors.php';
require_once '../config/database.php';
require_once '../middleware/auth.php';

$database = new Database();
$db       = $database->getConnection();
$auth     = new AuthMiddleware($db);
$payload  = $auth->requireRole(['admin']);

$method = $_SERVER['REQUEST_METHOD'];

// ── GET ───────────────────────────────────────────────────────────────────────
if ($method === 'GET') {
    $action = isset($_GET['action']) ? $_GET['action'] : '';

    // ── Detail view ──
    if ($action === 'detail') {
        $id = isset($_GET['id']) ? (int)$_GET['id'] : 0;
        if (!$id) { http_response_code(400); echo json_encode(['message' => 'Order ID required.']); exit; }

        $stmt = $db->prepare(
            "SELECT o.*,
                    u.full_name   AS buyer_name,
                    u.email       AS buyer_email,
                    u.contact_number AS buyer_contact,
                    CONCAT(
                        COALESCE(a.street,''), ', ',
                        COALESCE(b.name,''), ', ',
                        COALESCE(a.city,'')
                    ) AS delivery_address
             FROM orders o
             JOIN users u ON o.buyer_id = u.id
             LEFT JOIN addresses a ON o.address_id = a.id
             LEFT JOIN barangays b ON a.barangay_id = b.id
             WHERE o.id = ?"
        );
        $stmt->execute([$id]);
        $order = $stmt->fetch(PDO::FETCH_ASSOC);
        if (!$order) { http_response_code(404); echo json_encode(['message' => 'Order not found.']); exit; }

        // Items
        $stmt = $db->prepare(
            "SELECT oi.*,
                    p.name, p.description,
                    sp.store_name AS seller_name,
                    (SELECT image_url FROM product_images WHERE product_id = p.id AND is_primary = 1 LIMIT 1) AS image
             FROM order_items oi
             JOIN products p ON oi.product_id = p.id
             JOIN users us ON oi.seller_id = us.id
             LEFT JOIN seller_profiles sp ON oi.seller_id = sp.user_id
             WHERE oi.order_id = ?"
        );
        $stmt->execute([$id]);
        $order['items'] = $stmt->fetchAll(PDO::FETCH_ASSOC);

        // Status history
        try {
            $stmt = $db->prepare(
                "SELECT osh.*, u.full_name AS changed_by_name
                 FROM order_status_history osh
                 LEFT JOIN users u ON osh.changed_by = u.id
                 WHERE osh.order_id = ?
                 ORDER BY osh.created_at ASC"
            );
            $stmt->execute([$id]);
            $order['status_history'] = $stmt->fetchAll(PDO::FETCH_ASSOC);
        } catch (Exception $e) {
            $order['status_history'] = [];
        }

        echo json_encode(['order' => $order]);
        exit;
    }

    // ── List view ──
    $search    = isset($_GET['search']) ? trim($_GET['search']) : '';
    $status    = isset($_GET['status']) ? $_GET['status'] : '';
    $from      = isset($_GET['from'])   ? $_GET['from']   : '';
    $to        = isset($_GET['to'])     ? $_GET['to']     : '';
    $page      = max(1, (int)($_GET['page']  ?? 1));
    $limit     = max(1, min(100, (int)($_GET['limit'] ?? 20)));
    $offset    = ($page - 1) * $limit;

    $where  = [];
    $params = [];

    if ($status) {
        $where[]  = 'o.status = ?';
        $params[] = $status;
    }
    if ($from) {
        $where[]  = 'DATE(o.created_at) >= ?';
        $params[] = $from;
    }
    if ($to) {
        $where[]  = 'DATE(o.created_at) <= ?';
        $params[] = $to;
    }
    if ($search) {
        $where[]  = '(o.order_number LIKE ? OR u.full_name LIKE ? OR u.email LIKE ?)';
        $s = "%$search%";
        $params[] = $s; $params[] = $s; $params[] = $s;
    }

    $whereSQL = $where ? ('WHERE ' . implode(' AND ', $where)) : '';

    // Total count
    $stmt = $db->prepare(
        "SELECT COUNT(*) AS total
         FROM orders o
         JOIN users u ON o.buyer_id = u.id
         $whereSQL"
    );
    $stmt->execute($params);
    $total = (int)$stmt->fetch(PDO::FETCH_ASSOC)['total'];

    // Orders
    $stmt = $db->prepare(
        "SELECT o.id, o.order_number, o.status, o.total_amount, o.payment_method,
                o.created_at, o.updated_at,
                u.full_name  AS buyer_name,
                u.email      AS buyer_email,
                (SELECT COUNT(*) FROM order_items WHERE order_id = o.id) AS items_count,
                (SELECT GROUP_CONCAT(DISTINCT sp.store_name SEPARATOR ', ')
                 FROM order_items oi2
                 LEFT JOIN seller_profiles sp ON oi2.seller_id = sp.user_id
                 WHERE oi2.order_id = o.id) AS seller_names
         FROM orders o
         JOIN users u ON o.buyer_id = u.id
         $whereSQL
         ORDER BY o.created_at DESC
         LIMIT $limit OFFSET $offset"
    );
    $stmt->execute($params);
    $orders = $stmt->fetchAll(PDO::FETCH_ASSOC);

    // Stats (no filter — always platform-wide)
    $statsStmt = $db->query(
        "SELECT
            COUNT(*) AS total,
            SUM(status = 'delivered') AS delivered,
            SUM(status = 'cancelled') AS cancelled,
            SUM(status NOT IN ('delivered','cancelled')) AS in_progress
         FROM orders"
    );
    $stats = $statsStmt->fetch(PDO::FETCH_ASSOC);

    echo json_encode([
        'orders'      => $orders,
        'total'       => $total,
        'page'        => $page,
        'total_pages' => ceil($total / $limit),
        'stats'       => $stats,
    ]);
    exit;
}

// ── PUT — admin status override ───────────────────────────────────────────────
if ($method === 'PUT') {
    $data     = json_decode(file_get_contents('php://input'));
    $orderId  = isset($data->order_id) ? (int)$data->order_id : 0;
    $newStatus= isset($data->status)   ? $data->status       : '';
    $notes    = isset($data->notes)    ? $data->notes        : 'Admin override';

    $valid = ['confirmed','preparing','ready_to_ship','shipped','out_for_delivery','delivered','cancelled'];
    if (!$orderId || !in_array($newStatus, $valid)) {
        http_response_code(400);
        echo json_encode(['message' => 'Invalid order_id or status.']);
        exit;
    }

    // Verify order exists
    $stmt = $db->prepare('SELECT id, status, buyer_id, order_number FROM orders WHERE id = ?');
    $stmt->execute([$orderId]);
    $order = $stmt->fetch(PDO::FETCH_ASSOC);
    if (!$order) { http_response_code(404); echo json_encode(['message' => 'Order not found.']); exit; }

    try {
        $db->beginTransaction();

        $db->prepare('UPDATE orders SET status = ?, updated_at = NOW() WHERE id = ?')
           ->execute([$newStatus, $orderId]);

        $db->prepare('UPDATE order_items SET status = ? WHERE order_id = ?')
           ->execute([$newStatus, $orderId]);

        // History
        try {
            $db->prepare('INSERT INTO order_status_history (order_id, status, notes, changed_by) VALUES (?,?,?,?)')
               ->execute([$orderId, $newStatus, $notes, $payload['user_id']]);
        } catch (Exception $e) {}

        // Notify buyer
        $msgs = [
            'confirmed'        => 'Your order has been confirmed.',
            'preparing'        => 'Your order is being prepared.',
            'ready_to_ship'    => 'Your order is ready to ship.',
            'shipped'          => 'Your order has been shipped.',
            'out_for_delivery' => 'Your order is out for delivery.',
            'delivered'        => 'Your order has been delivered.',
            'cancelled'        => 'Your order has been cancelled by admin.',
        ];
        try {
            $db->prepare("INSERT INTO notifications (user_id, title, message, type) VALUES (?,?,?,'order')")
               ->execute([$order['buyer_id'], "Order #{$order['order_number']} Updated", $msgs[$newStatus]]);
        } catch (Exception $e) {}

        // Log admin action
        try {
            $db->prepare("INSERT INTO admin_logs (admin_id, action, target_type, target_id, details, ip_address) VALUES (?,?,?,?,?,?)")
               ->execute([$payload['user_id'], 'update', 'order', $orderId, "Status changed to $newStatus. $notes", $_SERVER['REMOTE_ADDR'] ?? '']);
        } catch (Exception $e) {}

        $db->commit();
        echo json_encode(['message' => 'Order status updated successfully.']);
    } catch (Exception $e) {
        $db->rollBack();
        http_response_code(500);
        echo json_encode(['message' => 'Failed to update order.']);
    }
    exit;
}

http_response_code(405);
echo json_encode(['message' => 'Method not allowed.']);
