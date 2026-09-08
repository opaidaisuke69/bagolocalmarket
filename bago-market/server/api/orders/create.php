<?php
require_once '../config/cors.php';
require_once '../config/database.php';
require_once '../middleware/auth.php';

$database = new Database();
$db       = $database->getConnection();
$auth     = new AuthMiddleware($db);
$payload  = $auth->requireRole(['buyer']);

$data = json_decode(file_get_contents("php://input"));

if (empty($data->address_id) || empty($data->items)) {
    http_response_code(400);
    echo json_encode(["message" => "Address and items are required."]);
    exit;
}

// ── Auto-migrate: commission columns + distance table ────────────────────────
foreach ([
    "ALTER TABLE orders
        ADD COLUMN IF NOT EXISTS commission_rate   DECIMAL(5,4)  NOT NULL DEFAULT 0.0200,
        ADD COLUMN IF NOT EXISTS commission_amount DECIMAL(10,2) NOT NULL DEFAULT 0.00,
        ADD COLUMN IF NOT EXISTS rider_earning     DECIMAL(10,2) NOT NULL DEFAULT 0.00",
    "ALTER TABLE order_items
        ADD COLUMN IF NOT EXISTS item_subtotal     DECIMAL(10,2) NOT NULL DEFAULT 0.00,
        ADD COLUMN IF NOT EXISTS commission_amount DECIMAL(10,2) NOT NULL DEFAULT 0.00,
        ADD COLUMN IF NOT EXISTS item_total        DECIMAL(10,2) NOT NULL DEFAULT 0.00",
    "INSERT IGNORE INTO barangays (name) VALUES ('Bacong-Montilla')",
    "CREATE TABLE IF NOT EXISTS barangay_distances (
        id               INT AUTO_INCREMENT PRIMARY KEY,
        from_barangay_id INT NOT NULL,
        to_barangay_id   INT NOT NULL,
        distance_km      DECIMAL(6,2) NOT NULL DEFAULT 0.00,
        UNIQUE KEY uk_route (from_barangay_id, to_barangay_id),
        INDEX idx_from (from_barangay_id),
        INDEX idx_to   (to_barangay_id)
    )",
] as $ddl) {
    try { $db->exec($ddl); } catch (Exception $e) { /* already exists */ }
}

// ── Haversine: straight-line km between two GPS points ───────────────────────
function haversineKm(float $lat1, float $lon1, float $lat2, float $lon2): float {
    $R    = 6371.0;
    $dLat = deg2rad($lat2 - $lat1);
    $dLon = deg2rad($lon2 - $lon1);
    $a    = sin($dLat / 2) ** 2
          + cos(deg2rad($lat1)) * cos(deg2rad($lat2)) * sin($dLon / 2) ** 2;
    return $R * 2 * atan2(sqrt($a), sqrt(1 - $a));
}

// ── Fee formula: ₱25 min (0–5 km), ₱5/km beyond 5 km ────────────────────────
function calcShippingFee($km) {
    $km  = max(0.0, (float)$km);
    return (float) ceil(max(25.0, $km * 5.0));
}

// ── Verify address and get buyer barangay ─────────────────────────────────────
$stmt = $db->prepare(
    "SELECT a.*, b.id AS barangay_id, b.name AS barangay_name,
            a.latitude, a.longitude
     FROM addresses a
     JOIN barangays b ON a.barangay_id = b.id
     WHERE a.id = ? AND a.user_id = ?"
);
$stmt->execute([$data->address_id, $payload['user_id']]);

if ($stmt->rowCount() === 0) {
    http_response_code(400);
    echo json_encode(["message" => "Invalid delivery address."]);
    exit;
}

$address      = $stmt->fetch(PDO::FETCH_ASSOC);
$buyerBrgyId  = (int)$address['barangay_id'];

define('COMMISSION_RATE', 0.00); // platform fee disabled

try {
    $db->beginTransaction();

    $orderNumber     = 'BGO-' . date('Ymd') . '-' . strtoupper(substr(uniqid(), -6));
    $sellerSubtotal  = 0.00;
    $totalCommission = 0.00;
    $orderItems      = [];
    $maxDistanceKm   = 0.0;

    // Buyer GPS coordinates (from address)
    $buyerLat = isset($address['latitude'])  && $address['latitude']  !== null ? (float)$address['latitude']  : null;
    $buyerLon = isset($address['longitude']) && $address['longitude'] !== null ? (float)$address['longitude'] : null;

    // ── Validate items, calculate per-item commission, track seller GPS ────────
    foreach ($data->items as $item) {
        $stmt = $db->prepare(
            "SELECT p.id, p.name, p.price, p.stock, p.seller_id,
                    COALESCE(sp.barangay_id, p.barangay_id) AS seller_barangay_id,
                    sp.latitude  AS seller_lat,
                    sp.longitude AS seller_lon
             FROM products p
             LEFT JOIN seller_profiles sp ON p.seller_id = sp.user_id
             WHERE p.id = ? AND p.is_available = 1
               AND p.approval_status = 'approved'
               AND p.deleted_at IS NULL"
        );
        $stmt->execute([$item->product_id]);

        if ($stmt->rowCount() === 0) {
            throw new Exception("Product not available: " . $item->product_id);
        }

        $product = $stmt->fetch(PDO::FETCH_ASSOC);

        if ($product['stock'] < $item->quantity) {
            throw new Exception("Insufficient stock for: " . $product['name']);
        }

        // Distance: GPS pin-to-pin (Haversine) — fallback to 0 km if no GPS
        $sellerLat = isset($product['seller_lat'])  && $product['seller_lat']  !== null ? (float)$product['seller_lat']  : null;
        $sellerLon = isset($product['seller_lon'])  && $product['seller_lon']  !== null ? (float)$product['seller_lon']  : null;

        if ($sellerLat !== null && $sellerLon !== null && $buyerLat !== null && $buyerLon !== null) {
            $km = haversineKm($sellerLat, $sellerLon, $buyerLat, $buyerLon);
            if ($km > $maxDistanceKm) $maxDistanceKm = $km;
        } else {
            // No GPS on one side — use barangay_distances as fallback
            $sellerBrgyId = (int)$product['seller_barangay_id'];
            if ($sellerBrgyId > 0 && $sellerBrgyId !== $buyerBrgyId) {
                $dStmt = $db->prepare(
                    "SELECT distance_km FROM barangay_distances
                     WHERE from_barangay_id = ? AND to_barangay_id = ?"
                );
                $dStmt->execute([$sellerBrgyId, $buyerBrgyId]);
                $dRow = $dStmt->fetch(PDO::FETCH_ASSOC);
                $km   = $dRow ? (float)$dRow['distance_km'] : 0.0;
                if ($km > $maxDistanceKm) $maxDistanceKm = $km;
            }
        }

        $qty       = (int)$item->quantity;
        $unitPrice = (float)$product['price'];
        $lineSubtotal = round($unitPrice * $qty, 2);

        $sellerSubtotal += $lineSubtotal;

        $orderItems[] = [
            'product_id'   => $product['id'],
            'seller_id'    => $product['seller_id'],
            'quantity'     => $qty,
            'price'        => $unitPrice,
            'variation_id' => $item->variation_id ?? null,
            'item_subtotal' => $lineSubtotal,
        ];
    }

    // ── Commission on total subtotal (matches checkout UI calculation) ────────
    $subtotal        = round($sellerSubtotal, 2);
    $totalCommission = round($subtotal * COMMISSION_RATE * 100) / 100;

    // Back-fill per-item commission proportionally so item_total adds up correctly
    foreach ($orderItems as &$oi) {
        $oi['commission_amount'] = round($oi['item_subtotal'] * COMMISSION_RATE, 4);
        $oi['item_total']        = round($oi['item_subtotal'] + $oi['commission_amount'], 2);
    }
    unset($oi);

    // ── Compute shipping fee from max distance ────────────────────────────────
    $shippingFee = calcShippingFee($maxDistanceKm);
    $totalAmount = round($subtotal + $totalCommission + $shippingFee, 2);

    // ── Insert order ──────────────────────────────────────────────────────────
    $stmt = $db->prepare(
        "INSERT INTO orders
            (order_number, buyer_id, address_id,
             subtotal, delivery_fee, total_amount,
             commission_rate, commission_amount, rider_earning,
             payment_method, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'cod', 'pending')"
    );
    $stmt->execute([
        $orderNumber,
        $payload['user_id'],
        $data->address_id,
        $subtotal,
        $shippingFee,
        $totalAmount,
        COMMISSION_RATE,
        round($totalCommission, 2),
        $shippingFee,
    ]);
    $orderId = $db->lastInsertId();

    // ── Insert order items ────────────────────────────────────────────────────
    foreach ($orderItems as $oi) {
        $stmt = $db->prepare(
            "INSERT INTO order_items
                (order_id, product_id, seller_id, quantity, price,
                 variation_id, item_subtotal, commission_amount, item_total)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)"
        );
        $stmt->execute([
            $orderId,
            $oi['product_id'],
            $oi['seller_id'],
            $oi['quantity'],
            $oi['price'],
            $oi['variation_id'],
            $oi['item_subtotal'],
            $oi['commission_amount'],
            $oi['item_total'],
        ]);

        $stmt = $db->prepare("UPDATE products SET stock = stock - ?, sold_count = sold_count + ? WHERE id = ?");
        $stmt->execute([$oi['quantity'], $oi['quantity'], $oi['product_id']]);

        $stmt = $db->prepare("INSERT INTO product_interactions (user_id, product_id, interaction_type) VALUES (?, ?, 'purchase')");
        $stmt->execute([$payload['user_id'], $oi['product_id']]);
    }

    $stmt = $db->prepare("INSERT INTO order_status_history (order_id, status, changed_by) VALUES (?, 'pending', ?)");
    $stmt->execute([$orderId, $payload['user_id']]);

    $stmt = $db->prepare("INSERT INTO deliveries (order_id, status) VALUES (?, 'preparing')");
    $stmt->execute([$orderId]);

    // ── Clear cart ────────────────────────────────────────────────────────────
    $stmt = $db->prepare("SELECT id FROM carts WHERE user_id = ?");
    $stmt->execute([$payload['user_id']]);
    $cart = $stmt->fetch(PDO::FETCH_ASSOC);

    if ($cart) {
        $productIds   = array_column($orderItems, 'product_id');
        $placeholders = implode(',', array_fill(0, count($productIds), '?'));
        $stmt         = $db->prepare("DELETE FROM cart_items WHERE cart_id = ? AND product_id IN ($placeholders)");
        $stmt->execute(array_merge([$cart['id']], $productIds));
    }

    // ── Notify sellers ────────────────────────────────────────────────────────
    $sellerIds = array_unique(array_column($orderItems, 'seller_id'));
    foreach ($sellerIds as $sellerId) {
        $stmt = $db->prepare("INSERT INTO notifications (user_id, title, message, type) VALUES (?, 'New Order', ?, 'order')");
        $stmt->execute([$sellerId, "You have a new order #$orderNumber"]);
    }

    $db->commit();

    http_response_code(201);
    echo json_encode([
        "message"           => "Order placed successfully.",
        "order_id"          => $orderId,
        "order_number"      => $orderNumber,
        "subtotal"          => $subtotal,
        "commission_amount" => round($totalCommission, 2),
        "shipping_fee"      => $shippingFee,
        "distance_km"       => round($maxDistanceKm, 2),
        "total_amount"      => $totalAmount,
        "barangay"          => $address['barangay_name'],
    ]);

} catch (Exception $e) {
    $db->rollBack();
    http_response_code(400);
    echo json_encode(["message" => $e->getMessage()]);
}
