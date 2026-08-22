<?php
require_once '../config/cors.php';
require_once '../config/database.php';
require_once '../middleware/auth.php';

$database = new Database();
$db = $database->getConnection();
$auth = new AuthMiddleware($db);
$payload = $auth->requireRole(['seller', 'admin']);

$data = json_decode(file_get_contents("php://input"));

if (empty($data->order_id) || empty($data->status)) {
    http_response_code(400);
    echo json_encode(["message" => "Order ID and status are required."]);
    exit;
}

$validStatuses = ['confirmed', 'preparing', 'ready_to_ship', 'shipped', 'out_for_delivery', 'delivered', 'cancelled'];
if (!in_array($data->status, $validStatuses)) {
    http_response_code(400);
    echo json_encode(["message" => "Invalid status."]);
    exit;
}

// Sellers cannot change status after ready_to_ship (rider takes over)
if ($payload['role'] === 'seller') {
    $sellerAllowed = ['confirmed', 'preparing', 'ready_to_ship', 'cancelled'];
    if (!in_array($data->status, $sellerAllowed)) {
        http_response_code(403);
        echo json_encode(["message" => "Sellers cannot change status beyond 'Ready to Ship'. Rider handles shipping."]);
        exit;
    }
}

// Verify access
if ($payload['role'] === 'seller') {
    $stmt = $db->prepare("SELECT DISTINCT o.id, o.status FROM orders o JOIN order_items oi ON o.id = oi.order_id WHERE o.id = ? AND oi.seller_id = ?");
    $stmt->execute([$data->order_id, $payload['user_id']]);
} else {
    $stmt = $db->prepare("SELECT id, status FROM orders WHERE id = ?");
    $stmt->execute([$data->order_id]);
}

if ($stmt->rowCount() === 0) {
    http_response_code(404);
    echo json_encode(["message" => "Order not found."]);
    exit;
}

$order = $stmt->fetch(PDO::FETCH_ASSOC);

try {
    $db->beginTransaction();

    // Update order status
    $stmt = $db->prepare("UPDATE orders SET status = ? WHERE id = ?");
    $stmt->execute([$data->status, $data->order_id]);

    // Update order items status for this seller
    if ($payload['role'] === 'seller') {
        $stmt = $db->prepare("UPDATE order_items SET status = ? WHERE order_id = ? AND seller_id = ?");
        $stmt->execute([$data->status, $data->order_id, $payload['user_id']]);
    } else {
        $stmt = $db->prepare("UPDATE order_items SET status = ? WHERE order_id = ?");
        $stmt->execute([$data->status, $data->order_id]);
    }

    // Add status history
    $notes = isset($data->notes) ? $data->notes : '';
    $stmt = $db->prepare("INSERT INTO order_status_history (order_id, status, notes, changed_by) VALUES (?, ?, ?, ?)");
    $stmt->execute([$data->order_id, $data->status, $notes, $payload['user_id']]);

    // Update delivery if applicable
    if (in_array($data->status, ['preparing', 'ready_to_ship', 'shipped', 'out_for_delivery', 'delivered'])) {
        $deliveryStatusMap = array(
            'preparing' => 'preparing',
            'ready_to_ship' => 'ready',
            'shipped' => 'shipped',
            'out_for_delivery' => 'out_for_delivery',
            'delivered' => 'delivered'
        );
        $deliveryStatus = isset($deliveryStatusMap[$data->status]) ? $deliveryStatusMap[$data->status] : 'preparing';

        $stmt = $db->prepare("UPDATE deliveries SET status = ?, delivery_person_name = COALESCE(?, delivery_person_name), delivery_contact = COALESCE(?, delivery_contact), delivery_notes = COALESCE(?, delivery_notes) WHERE order_id = ?");
        $stmt->execute([
            $deliveryStatus,
            $data->delivery_person ?? null,
            $data->delivery_contact ?? null,
            $data->delivery_notes ?? null,
            $data->order_id
        ]);

        if ($data->status === 'delivered') {
            $stmt = $db->prepare("UPDATE deliveries SET actual_delivery = NOW() WHERE order_id = ?");
            $stmt->execute([$data->order_id]);

            // Update seller stats
            $stmt = $db->prepare("SELECT oi.seller_id, SUM(oi.price * oi.quantity) as total FROM order_items oi WHERE oi.order_id = ? GROUP BY oi.seller_id");
            $stmt->execute([$data->order_id]);
            $sellerTotals = $stmt->fetchAll(PDO::FETCH_ASSOC);

            foreach ($sellerTotals as $st) {
                $stmt = $db->prepare("UPDATE seller_profiles SET total_sales = total_sales + ?, total_orders = total_orders + 1 WHERE user_id = ?");
                $stmt->execute([$st['total'], $st['seller_id']]);
            }
        }
    }

    // Notify buyer
    $stmt = $db->prepare("SELECT buyer_id, order_number FROM orders WHERE id = ?");
    $stmt->execute([$data->order_id]);
    $orderInfo = $stmt->fetch(PDO::FETCH_ASSOC);

    $statusMessages = [
        'confirmed' => 'Your order has been confirmed by the seller.',
        'preparing' => 'Your order is being prepared.',
        'ready_to_ship' => 'Your order is ready to ship.',
        'shipped' => 'Your order has been shipped.',
        'out_for_delivery' => 'Your order is out for delivery.',
        'delivered' => 'Your order has been delivered.',
        'cancelled' => 'Your order has been cancelled.'
    ];

    $stmt = $db->prepare("INSERT INTO notifications (user_id, title, message, type) VALUES (?, ?, ?, 'order')");
    $stmt->execute([$orderInfo['buyer_id'], "Order #{$orderInfo['order_number']} Update", $statusMessages[$data->status]]);

    $db->commit();

    echo json_encode(["message" => "Order status updated successfully."]);
} catch (Exception $e) {
    $db->rollBack();
    http_response_code(500);
    echo json_encode(["message" => "Failed to update order status."]);
}
