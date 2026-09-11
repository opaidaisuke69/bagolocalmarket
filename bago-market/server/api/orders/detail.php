<?php
require_once '../config/cors.php';
require_once '../config/database.php';
require_once '../middleware/auth.php';

$database = new Database();
$db = $database->getConnection();
$auth = new AuthMiddleware($db);
$payload = $auth->requireAuth();

$id = isset($_GET['id']) ? (int)$_GET['id'] : 0;

if ($id === 0) {
    http_response_code(400);
    echo json_encode(["message" => "Order ID is required."]);
    exit;
}

// Get order
$stmt = $db->prepare("SELECT o.*, a.recipient_name, a.contact_number as delivery_contact,
    a.street_address, a.landmark, a.delivery_notes as address_notes,
    b.name as barangay_name, b.distance_zone, b.shipping_fee as barangay_shipping_fee,
    u.full_name as buyer_name, u.email as buyer_email
    FROM orders o
    LEFT JOIN addresses a ON o.address_id = a.id
    LEFT JOIN barangays b ON a.barangay_id = b.id
    LEFT JOIN users u ON o.buyer_id = u.id
    WHERE o.id = ?");
$stmt->execute([$id]);

if ($stmt->rowCount() === 0) {
    http_response_code(404);
    echo json_encode(["message" => "Order not found."]);
    exit;
}

$order = $stmt->fetch(PDO::FETCH_ASSOC);

// Access control
if ($payload['role'] === 'buyer' && $order['buyer_id'] != $payload['user_id']) {
    http_response_code(403);
    echo json_encode(["message" => "Access denied."]);
    exit;
}

// Auto-add color_variation_id to order_items if missing
try { $db->exec("ALTER TABLE order_items ADD COLUMN IF NOT EXISTS color_variation_id INT NULL"); } catch (Exception $e) {}

// Get order items (include per-item commission breakdown + variation)
$stmt = $db->prepare("SELECT oi.*, p.name as product_name, p.slug,
    (SELECT image_url FROM product_images WHERE product_id = p.id AND is_primary = 1 LIMIT 1) as product_image,
    u.full_name as seller_name, sp.store_name,
    pv.name as variation_name, pv.value as variation_value,
    pvc.value as color_value,
    CASE
        WHEN pvc.id IS NOT NULL AND pv.id IS NOT NULL THEN CONCAT('Color: ', pvc.value, ' · ', pv.name, ': ', pv.value)
        WHEN pvc.id IS NOT NULL THEN CONCAT('Color: ', pvc.value)
        WHEN pv.id IS NOT NULL THEN CONCAT(pv.name, ': ', pv.value)
        ELSE NULL
    END as variation_label
    FROM order_items oi
    JOIN products p ON oi.product_id = p.id
    JOIN users u ON oi.seller_id = u.id
    LEFT JOIN seller_profiles sp ON oi.seller_id = sp.user_id
    LEFT JOIN product_variations pv ON oi.variation_id = pv.id
    LEFT JOIN product_variations pvc ON oi.color_variation_id = pvc.id
    WHERE oi.order_id = ?");
$stmt->execute([$id]);
$order['items'] = $stmt->fetchAll(PDO::FETCH_ASSOC);

// Get status history
$stmt = $db->prepare("SELECT osh.*, u.full_name as changed_by_name FROM order_status_history osh LEFT JOIN users u ON osh.changed_by = u.id WHERE osh.order_id = ? ORDER BY osh.created_at ASC");
$stmt->execute([$id]);
$order['status_history'] = $stmt->fetchAll(PDO::FETCH_ASSOC);

// Get delivery info with rider name
$stmt = $db->prepare("SELECT d.*, u.full_name as rider_name, u.contact_number as rider_contact 
    FROM deliveries d 
    LEFT JOIN users u ON d.rider_id = u.id 
    WHERE d.order_id = ?");
$stmt->execute([$id]);
$order['delivery'] = $stmt->fetch(PDO::FETCH_ASSOC);

echo json_encode(["order" => $order]);
