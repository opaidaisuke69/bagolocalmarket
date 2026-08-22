<?php
require_once '../config/cors.php';
require_once '../config/database.php';
require_once '../middleware/auth.php';

$database = new Database();
$db = $database->getConnection();
$auth = new AuthMiddleware($db);
$payload = $auth->requireAuth();

$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'GET') {
    $tab = isset($_GET['tab']) ? $_GET['tab'] : '';
    $rider_id = $payload['user_id'];
    
    if ($tab === 'delivering') {
        // Rider's active deliveries (picked up, out for delivery)
        $query = "SELECT o.*, o.order_number, o.total_amount, o.created_at,
            a.recipient_name, a.contact_number, a.street_address,
            b.name as barangay_name,
            u.full_name as buyer_name,
            d.id as delivery_id, d.rider_id, d.status as delivery_status,
            d.pickup_proof, d.delivery_proof, d.picked_up_at, d.delivered_at
            FROM orders o
            LEFT JOIN addresses a ON o.address_id = a.id
            LEFT JOIN barangays b ON a.barangay_id = b.id
            LEFT JOIN users u ON o.buyer_id = u.id
            LEFT JOIN deliveries d ON o.id = d.order_id
            WHERE d.rider_id = ? AND o.status IN ('shipped', 'out_for_delivery')
            ORDER BY o.created_at DESC";
        $stmt = $db->prepare($query);
        $stmt->execute([$rider_id]);
    } elseif ($tab === 'completed') {
        // Completed deliveries
        $query = "SELECT o.*, o.order_number, o.total_amount, o.created_at,
            a.recipient_name, a.contact_number, a.street_address,
            b.name as barangay_name,
            u.full_name as buyer_name,
            d.id as delivery_id, d.rider_id, d.status as delivery_status,
            d.pickup_proof, d.delivery_proof, d.picked_up_at, d.delivered_at
            FROM orders o
            LEFT JOIN addresses a ON o.address_id = a.id
            LEFT JOIN barangays b ON a.barangay_id = b.id
            LEFT JOIN users u ON o.buyer_id = u.id
            LEFT JOIN deliveries d ON o.id = d.order_id
            WHERE d.rider_id = ? AND o.status = 'delivered'
            ORDER BY d.delivered_at DESC
            LIMIT 50";
        $stmt = $db->prepare($query);
        $stmt->execute([$rider_id]);
    } elseif (isset($_GET['my_deliveries'])) {
        // Legacy: Rider's own active and completed deliveries
        $query = "SELECT o.*, o.order_number, o.total_amount, o.created_at,
            a.recipient_name, a.contact_number, a.street_address,
            b.name as barangay_name,
            u.full_name as buyer_name,
            d.id as delivery_id, d.rider_id, d.status as delivery_status,
            d.pickup_proof, d.delivery_proof, d.picked_up_at, d.delivered_at
            FROM orders o
            LEFT JOIN addresses a ON o.address_id = a.id
            LEFT JOIN barangays b ON a.barangay_id = b.id
            LEFT JOIN users u ON o.buyer_id = u.id
            LEFT JOIN deliveries d ON o.id = d.order_id
            WHERE d.rider_id = ? AND o.status IN ('shipped', 'out_for_delivery', 'delivered')
            ORDER BY o.created_at DESC";
        $stmt = $db->prepare($query);
        $stmt->execute([$rider_id]);
    } else {
        // Available orders for pickup: 'ready_to_ship' (unassigned OR assigned to this rider)
        $query = "SELECT o.*, o.order_number, o.total_amount, o.created_at,
            a.recipient_name, a.contact_number, a.street_address,
            b.name as barangay_name,
            u.full_name as buyer_name,
            d.id as delivery_id, d.rider_id, d.status as delivery_status,
            d.pickup_proof, d.delivery_proof, d.picked_up_at, d.delivered_at,
            pr.id as my_request_id, pr.status as my_request_status
            FROM orders o
            LEFT JOIN addresses a ON o.address_id = a.id
            LEFT JOIN barangays b ON a.barangay_id = b.id
            LEFT JOIN users u ON o.buyer_id = u.id
            LEFT JOIN deliveries d ON o.id = d.order_id
            LEFT JOIN pickup_requests pr ON o.id = pr.order_id AND pr.rider_id = ?
            WHERE o.status = 'ready_to_ship' AND (d.rider_id IS NULL OR d.rider_id = 0 OR d.rider_id = ?)
            ORDER BY o.created_at DESC";
        $stmt = $db->prepare($query);
        $stmt->execute([$rider_id, $rider_id]);
    }
    
    $orders = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    // Get items for each order (include seller contact)
    foreach ($orders as &$order) {
        $stmtItems = $db->prepare("SELECT oi.*, p.name as product_name,
            (SELECT image_url FROM product_images WHERE product_id = p.id AND is_primary = 1 LIMIT 1) as product_image,
            sp.store_name, sp.complete_address as store_address,
            u.full_name as seller_name, u.contact_number as seller_contact
            FROM order_items oi
            JOIN products p ON oi.product_id = p.id
            LEFT JOIN seller_profiles sp ON oi.seller_id = sp.user_id
            LEFT JOIN users u ON oi.seller_id = u.id
            WHERE oi.order_id = ?");
        $stmtItems->execute([$order['id']]);
        $order['items'] = $stmtItems->fetchAll(PDO::FETCH_ASSOC);
        $order['items_count'] = count($order['items']);
    }
    
    echo json_encode(["orders" => $orders]);

} elseif ($method === 'POST') {
    $data = json_decode(file_get_contents("php://input"));
    
    if (empty($data->order_id) || empty($data->action)) {
        http_response_code(400);
        echo json_encode(["message" => "Order ID and action are required."]);
        exit;
    }
    
    $order_id = (int)$data->order_id;
    $action = $data->action;
    $proof_image = isset($data->proof_image) ? $data->proof_image : null;
    $rider_id = $payload['user_id'];
    
    if ($action === 'request_pickup') {
        // Rider requests to pick up — seller must approve
        $stmt = $db->prepare("SELECT id, status FROM orders WHERE id = ? AND status = 'ready_to_ship'");
        $stmt->execute([$order_id]);
        if ($stmt->rowCount() === 0) {
            http_response_code(400);
            echo json_encode(["message" => "Order is not available for pickup."]);
            exit;
        }
        
        // Check if already assigned (approved) to a rider
        $stmt = $db->prepare("SELECT rider_id FROM deliveries WHERE order_id = ? AND rider_id IS NOT NULL AND rider_id != 0");
        $stmt->execute([$order_id]);
        if ($stmt->rowCount() > 0) {
            http_response_code(400);
            echo json_encode(["message" => "This order is already assigned to a rider."]);
            exit;
        }
        
        // Check if rider already has a pending request
        $stmt = $db->prepare("SELECT id, status FROM pickup_requests WHERE order_id = ? AND rider_id = ?");
        $stmt->execute([$order_id, $rider_id]);
        if ($stmt->rowCount() > 0) {
            $existing = $stmt->fetch(PDO::FETCH_ASSOC);
            if ($existing['status'] === 'pending') {
                http_response_code(400);
                echo json_encode(["message" => "You already have a pending request for this order."]);
                exit;
            }
        }
        
        // Insert pickup request
        $stmt = $db->prepare("INSERT INTO pickup_requests (order_id, rider_id, status) VALUES (?, ?, 'pending') ON DUPLICATE KEY UPDATE status = 'pending', updated_at = NOW()");
        $stmt->execute([$order_id, $rider_id]);
        
        // Notify seller(s)
        $stmt = $db->prepare("SELECT DISTINCT oi.seller_id FROM order_items oi WHERE oi.order_id = ?");
        $stmt->execute([$order_id]);
        $sellers = $stmt->fetchAll(PDO::FETCH_ASSOC);
        $riderStmt = $db->prepare("SELECT full_name FROM users WHERE id = ?");
        $riderStmt->execute([$rider_id]);
        $riderName = $riderStmt->fetch(PDO::FETCH_ASSOC)['full_name'];
        
        foreach ($sellers as $seller) {
            $stmt = $db->prepare("INSERT INTO notifications (user_id, title, message, type) VALUES (?, 'Pickup Request', ?, 'order')");
            $stmt->execute([$seller['seller_id'], "Rider {$riderName} is requesting to pick up your order #{$order_id}. Please approve or reject."]);
        }
        
        echo json_encode(["message" => "Pickup requested! Waiting for seller approval.", "status" => "pending"]);
    
    } elseif ($action === 'pickup') {
        // Rider picks up from seller — order must be 'ready_to_ship'
        $stmt = $db->prepare("SELECT id, status FROM orders WHERE id = ? AND status = 'ready_to_ship'");
        $stmt->execute([$order_id]);
        if ($stmt->rowCount() === 0) {
            http_response_code(400);
            echo json_encode(["message" => "Order is not ready for pickup."]);
            exit;
        }
        
        // Verify rider is assigned (or assign now)
        $stmt = $db->prepare("SELECT rider_id FROM deliveries WHERE order_id = ?");
        $stmt->execute([$order_id]);
        $delivery = $stmt->fetch(PDO::FETCH_ASSOC);
        if ($delivery && $delivery['rider_id'] && $delivery['rider_id'] != $rider_id) {
            http_response_code(403);
            echo json_encode(["message" => "This order is assigned to another rider."]);
            exit;
        }
        
        // Update delivery record - assign rider
        $stmt = $db->prepare("UPDATE deliveries SET rider_id = ?, status = 'picked_up', pickup_proof = ?, picked_up_at = NOW() WHERE order_id = ?");
        $stmt->execute([$rider_id, $proof_image, $order_id]);
        
        // If no delivery record exists, create one
        if ($stmt->rowCount() === 0) {
            $stmt = $db->prepare("INSERT INTO deliveries (order_id, rider_id, status, pickup_proof, picked_up_at) VALUES (?, ?, 'picked_up', ?, NOW())");
            $stmt->execute([$order_id, $rider_id, $proof_image]);
        }
        
        // Update order status to 'shipped' (rider has the package)
        $stmt = $db->prepare("UPDATE orders SET status = 'shipped' WHERE id = ?");
        $stmt->execute([$order_id]);
        
        // Update order items
        $stmt = $db->prepare("UPDATE order_items SET status = 'shipped' WHERE order_id = ?");
        $stmt->execute([$order_id]);
        
        // Status history
        $stmt = $db->prepare("INSERT INTO order_status_history (order_id, status, changed_by, notes) VALUES (?, 'shipped', ?, 'Picked up by rider')");
        $stmt->execute([$order_id, $rider_id]);
        
        // Notify buyer
        $stmt = $db->prepare("SELECT buyer_id FROM orders WHERE id = ?");
        $stmt->execute([$order_id]);
        $buyer = $stmt->fetch(PDO::FETCH_ASSOC);
        if ($buyer) {
            $stmt = $db->prepare("INSERT INTO notifications (user_id, title, message, type) VALUES (?, 'Order Shipped', 'Your order has been picked up by the rider!', 'order')");
            $stmt->execute([$buyer['buyer_id']]);
        }
        
        echo json_encode(["message" => "Order picked up! Status: Shipped", "status" => "shipped"]);
        
    } elseif ($action === 'out_for_delivery') {
        $stmt = $db->prepare("SELECT id FROM orders WHERE id = ? AND status = 'shipped'");
        $stmt->execute([$order_id]);
        if ($stmt->rowCount() === 0) {
            http_response_code(400);
            echo json_encode(["message" => "Order is not in shipped status."]);
            exit;
        }
        
        $stmt = $db->prepare("UPDATE deliveries SET rider_id = ?, status = 'out_for_delivery' WHERE order_id = ?");
        $stmt->execute([$rider_id, $order_id]);
        
        $stmt = $db->prepare("UPDATE orders SET status = 'out_for_delivery' WHERE id = ?");
        $stmt->execute([$order_id]);
        
        $stmt = $db->prepare("UPDATE order_items SET status = 'out_for_delivery' WHERE order_id = ?");
        $stmt->execute([$order_id]);
        
        $stmt = $db->prepare("INSERT INTO order_status_history (order_id, status, changed_by, notes) VALUES (?, 'out_for_delivery', ?, 'Out for delivery')");
        $stmt->execute([$order_id, $rider_id]);
        
        // Notify buyer
        $stmt = $db->prepare("SELECT buyer_id FROM orders WHERE id = ?");
        $stmt->execute([$order_id]);
        $buyer = $stmt->fetch(PDO::FETCH_ASSOC);
        if ($buyer) {
            $stmt = $db->prepare("INSERT INTO notifications (user_id, title, message, type) VALUES (?, 'Out for Delivery', 'Your order is on its way to you!', 'order')");
            $stmt->execute([$buyer['buyer_id']]);
        }
        
        echo json_encode(["message" => "Order is out for delivery!", "status" => "out_for_delivery"]);
        
    } elseif ($action === 'deliver') {
        $stmt = $db->prepare("SELECT id FROM orders WHERE id = ? AND status = 'out_for_delivery'");
        $stmt->execute([$order_id]);
        if ($stmt->rowCount() === 0) {
            http_response_code(400);
            echo json_encode(["message" => "Order is not out for delivery."]);
            exit;
        }
        
        $stmt = $db->prepare("UPDATE deliveries SET status = 'delivered', delivery_proof = ?, delivered_at = NOW(), rider_id = ? WHERE order_id = ?");
        $stmt->execute([$proof_image, $rider_id, $order_id]);
        
        $stmt = $db->prepare("UPDATE orders SET status = 'delivered' WHERE id = ?");
        $stmt->execute([$order_id]);
        
        $stmt = $db->prepare("UPDATE order_items SET status = 'delivered' WHERE order_id = ?");
        $stmt->execute([$order_id]);
        
        $stmt = $db->prepare("INSERT INTO order_status_history (order_id, status, changed_by, notes) VALUES (?, 'delivered', ?, 'Delivered by rider')");
        $stmt->execute([$order_id, $rider_id]);
        
        // Update seller stats
        $stmt = $db->prepare("SELECT oi.seller_id, SUM(oi.price * oi.quantity) as total FROM order_items oi WHERE oi.order_id = ? GROUP BY oi.seller_id");
        $stmt->execute([$order_id]);
        $sellerTotals = $stmt->fetchAll(PDO::FETCH_ASSOC);
        foreach ($sellerTotals as $st) {
            $stmt = $db->prepare("UPDATE seller_profiles SET total_sales = total_sales + ?, total_orders = total_orders + 1 WHERE user_id = ?");
            $stmt->execute([$st['total'], $st['seller_id']]);
        }
        
        // Notify buyer
        $stmt = $db->prepare("SELECT buyer_id FROM orders WHERE id = ?");
        $stmt->execute([$order_id]);
        $buyer = $stmt->fetch(PDO::FETCH_ASSOC);
        if ($buyer) {
            $stmt = $db->prepare("INSERT INTO notifications (user_id, title, message, type) VALUES (?, 'Order Delivered', 'Your order has been delivered! Please rate your purchase.', 'order')");
            $stmt->execute([$buyer['buyer_id']]);
        }
        
        echo json_encode(["message" => "Order delivered successfully!", "status" => "delivered"]);
        
    } elseif ($action === 'cancel_delivery') {
        // Rider cancels — returns order to ready_to_ship
        $cancel_reason = isset($data->cancel_reason) ? $data->cancel_reason : 'Cancelled by rider';
        
        $stmt = $db->prepare("SELECT id, status FROM orders WHERE id = ? AND status IN ('shipped', 'out_for_delivery')");
        $stmt->execute([$order_id]);
        if ($stmt->rowCount() === 0) {
            http_response_code(400);
            echo json_encode(["message" => "Cannot cancel this delivery."]);
            exit;
        }
        
        // Verify this rider owns the delivery
        $stmt = $db->prepare("SELECT rider_id FROM deliveries WHERE order_id = ?");
        $stmt->execute([$order_id]);
        $delivery = $stmt->fetch(PDO::FETCH_ASSOC);
        if (!$delivery || $delivery['rider_id'] != $rider_id) {
            http_response_code(403);
            echo json_encode(["message" => "You are not assigned to this delivery."]);
            exit;
        }
        
        // Reset delivery — unassign rider, reset proofs
        $stmt = $db->prepare("UPDATE deliveries SET rider_id = NULL, status = 'ready', pickup_proof = NULL, delivery_proof = NULL, picked_up_at = NULL, delivered_at = NULL WHERE order_id = ?");
        $stmt->execute([$order_id]);
        
        // Return order to ready_to_ship
        $stmt = $db->prepare("UPDATE orders SET status = 'ready_to_ship' WHERE id = ?");
        $stmt->execute([$order_id]);
        
        $stmt = $db->prepare("UPDATE order_items SET status = 'ready_to_ship' WHERE order_id = ?");
        $stmt->execute([$order_id]);
        
        // Status history
        $stmt = $db->prepare("INSERT INTO order_status_history (order_id, status, changed_by, notes) VALUES (?, 'ready_to_ship', ?, ?)");
        $stmt->execute([$order_id, $rider_id, 'Delivery cancelled: ' . $cancel_reason]);
        
        // Notify buyer
        $stmt = $db->prepare("SELECT buyer_id FROM orders WHERE id = ?");
        $stmt->execute([$order_id]);
        $buyer = $stmt->fetch(PDO::FETCH_ASSOC);
        if ($buyer) {
            $stmt = $db->prepare("INSERT INTO notifications (user_id, title, message, type) VALUES (?, 'Delivery Update', 'Your order delivery has been reassigned. A new rider will be assigned shortly.', 'order')");
            $stmt->execute([$buyer['buyer_id']]);
        }
        
        echo json_encode(["message" => "Delivery cancelled. Order returned to available pool.", "status" => "ready_to_ship"]);
        
    } else {
        http_response_code(400);
        echo json_encode(["message" => "Invalid action. Use 'request_pickup', 'pickup', 'out_for_delivery', 'deliver', or 'cancel_delivery'."]);
    }
}
