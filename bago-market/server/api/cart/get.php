<?php
require_once '../config/cors.php';
require_once '../config/database.php';
require_once '../middleware/auth.php';

$database = new Database();
$db = $database->getConnection();
$auth = new AuthMiddleware($db);
$payload = $auth->requireRole(['buyer']);

$userId = $payload['user_id'];

// Get or create cart
$stmt = $db->prepare("SELECT id FROM carts WHERE user_id = ?");
$stmt->execute([$userId]);

if ($stmt->rowCount() === 0) {
    $stmt = $db->prepare("INSERT INTO carts (user_id) VALUES (?)");
    $stmt->execute([$userId]);
    $cartId = $db->lastInsertId();
} else {
    $cartId = $stmt->fetch(PDO::FETCH_ASSOC)['id'];
}

// Auto-add color_variation_id columns if they don't exist yet
foreach ([
    "ALTER TABLE cart_items ADD COLUMN IF NOT EXISTS color_variation_id INT NULL",
    "ALTER TABLE order_items ADD COLUMN IF NOT EXISTS color_variation_id INT NULL",
] as $ddl) {
    try { $db->exec($ddl); } catch (Exception $e) { /* already exists or not supported */ }
}

// Get cart items (with variation info)
$stmt = $db->prepare("SELECT ci.*, p.name as product_name, p.price as base_price,
    p.stock as product_stock, p.is_available,
    p.seller_id, u.full_name as seller_name, sp.store_name,
    (SELECT image_url FROM product_images WHERE product_id = p.id AND is_primary = 1 LIMIT 1) as product_image,
    b.name as seller_barangay,
    pv.name as variation_name, pv.value as variation_value,
    pv.price_adjustment as variation_price_adjustment,
    COALESCE(pv.stock, p.stock) as stock,
    pvc.value as color_value, pvc.hex as color_hex, pvc.image_url as color_image_url
    FROM cart_items ci
    JOIN products p ON ci.product_id = p.id
    JOIN users u ON p.seller_id = u.id
    LEFT JOIN seller_profiles sp ON p.seller_id = sp.user_id
    LEFT JOIN barangays b ON p.barangay_id = b.id
    LEFT JOIN product_variations pv ON ci.variation_id = pv.id
    LEFT JOIN product_variations pvc ON ci.color_variation_id = pvc.id
    WHERE ci.cart_id = ? AND p.deleted_at IS NULL
    ORDER BY ci.created_at DESC");
$stmt->execute([$cartId]);
$items = $stmt->fetchAll(PDO::FETCH_ASSOC);

$subtotal = 0;
foreach ($items as &$item) {
    // Effective price = base + variation adjustment
    $item['price'] = round((float)$item['base_price'] + (float)($item['variation_price_adjustment'] ?? 0), 2);
    $item['total'] = $item['price'] * $item['quantity'];
    $subtotal += $item['total'];

    // Build combined label: "Color: Red · Size: Large" or just one if only one exists
    $parts = [];
    if (!empty($item['color_value'])) {
        $parts[] = 'Color: ' . $item['color_value'];
    }
    if (!empty($item['variation_name']) && !empty($item['variation_value'])) {
        $parts[] = $item['variation_name'] . ': ' . $item['variation_value'];
    }
    $item['variation_label'] = !empty($parts) ? implode(' · ', $parts) : null;
}

echo json_encode([
    "cart_id" => $cartId,
    "items" => $items,
    "item_count" => count($items),
    "subtotal" => $subtotal
]);
