<?php
require_once '../config/cors.php';
require_once '../config/database.php';
require_once '../middleware/auth.php';

$database = new Database();
$db = $database->getConnection();
$auth = new AuthMiddleware($db);
$payload = $auth->requireRole(['buyer']);

$data = json_decode(file_get_contents("php://input"));

if (empty($data->address_id) || empty($data->items)) {
    http_response_code(400);
    echo json_encode(["message" => "Address and items are required."]);
    exit;
}

// Verify address belongs to user and is in Bago City
$stmt = $db->prepare("SELECT a.*, b.name as barangay_name FROM addresses a JOIN barangays b ON a.barangay_id = b.id WHERE a.id = ? AND a.user_id = ?");
$stmt->execute([$data->address_id, $payload['user_id']]);

if ($stmt->rowCount() === 0) {
    http_response_code(400);
    echo json_encode(["message" => "Invalid delivery address."]);
    exit;
}

try {
    $db->beginTransaction();

    $orderNumber = 'BGO-' . date('Ymd') . '-' . strtoupper(substr(uniqid(), -6));
    $subtotal = 0;
    $deliveryFee = 50.00; // Flat rate within Bago City

    // Validate items and calculate total
    $orderItems = [];
    foreach ($data->items as $item) {
        $stmt = $db->prepare("SELECT id, name, price, stock, seller_id FROM products WHERE id = ? AND is_available = 1 AND approval_status = 'approved' AND deleted_at IS NULL");
        $stmt->execute([$item->product_id]);

        if ($stmt->rowCount() === 0) {
            throw new Exception("Product not available: " . $item->product_id);
        }

        $product = $stmt->fetch(PDO::FETCH_ASSOC);

        if ($product['stock'] < $item->quantity) {
            throw new Exception("Insufficient stock for: " . $product['name']);
        }

        $itemTotal = $product['price'] * $item->quantity;
        $subtotal += $itemTotal;

        $orderItems[] = [
            'product_id' => $product['id'],
            'seller_id' => $product['seller_id'],
            'quantity' => $item->quantity,
            'price' => $product['price'],
            'variation_id' => $item->variation_id ?? null
        ];
    }

    $totalAmount = $subtotal + $deliveryFee;

    // Create order
    $stmt = $db->prepare("INSERT INTO orders (order_number, buyer_id, address_id, subtotal, delivery_fee, total_amount, payment_method, status) VALUES (?, ?, ?, ?, ?, ?, 'cod', 'pending')");
    $stmt->execute([$orderNumber, $payload['user_id'], $data->address_id, $subtotal, $deliveryFee, $totalAmount]);
    $orderId = $db->lastInsertId();

    // Create order items
    foreach ($orderItems as $orderItem) {
        $stmt = $db->prepare("INSERT INTO order_items (order_id, product_id, seller_id, quantity, price, variation_id) VALUES (?, ?, ?, ?, ?, ?)");
        $stmt->execute([$orderId, $orderItem['product_id'], $orderItem['seller_id'], $orderItem['quantity'], $orderItem['price'], $orderItem['variation_id']]);

        // Reduce stock
        $stmt = $db->prepare("UPDATE products SET stock = stock - ?, sold_count = sold_count + ? WHERE id = ?");
        $stmt->execute([$orderItem['quantity'], $orderItem['quantity'], $orderItem['product_id']]);

        // Track purchase interaction
        $stmt = $db->prepare("INSERT INTO product_interactions (user_id, product_id, interaction_type) VALUES (?, ?, 'purchase')");
        $stmt->execute([$payload['user_id'], $orderItem['product_id']]);
    }

    // Add status history
    $stmt = $db->prepare("INSERT INTO order_status_history (order_id, status, changed_by) VALUES (?, 'pending', ?)");
    $stmt->execute([$orderId, $payload['user_id']]);

    // Create delivery record
    $stmt = $db->prepare("INSERT INTO deliveries (order_id, status) VALUES (?, 'preparing')");
    $stmt->execute([$orderId]);

    // Remove items from cart
    $stmt = $db->prepare("SELECT id FROM carts WHERE user_id = ?");
    $stmt->execute([$payload['user_id']]);
    $cart = $stmt->fetch(PDO::FETCH_ASSOC);

    if ($cart) {
        $productIds = array_column($orderItems, 'product_id');
        $placeholders = implode(',', array_fill(0, count($productIds), '?'));
        $stmt = $db->prepare("DELETE FROM cart_items WHERE cart_id = ? AND product_id IN ($placeholders)");
        $stmt->execute(array_merge([$cart['id']], $productIds));
    }

    // Create notification for sellers
    $sellerIds = array_unique(array_column($orderItems, 'seller_id'));
    foreach ($sellerIds as $sellerId) {
        $stmt = $db->prepare("INSERT INTO notifications (user_id, title, message, type) VALUES (?, 'New Order', ?, 'order')");
        $stmt->execute([$sellerId, "You have a new order #$orderNumber"]);
    }

    $db->commit();

    http_response_code(201);
    echo json_encode([
        "message" => "Order placed successfully.",
        "order_id" => $orderId,
        "order_number" => $orderNumber,
        "total_amount" => $totalAmount
    ]);
} catch (Exception $e) {
    $db->rollBack();
    http_response_code(400);
    echo json_encode(["message" => $e->getMessage()]);
}
