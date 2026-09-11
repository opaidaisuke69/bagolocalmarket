<?php
require_once '../config/cors.php';
require_once '../config/database.php';
require_once '../middleware/auth.php';
require_once '../config/logger.php';

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
        ADD COLUMN IF NOT EXISTS item_subtotal        DECIMAL(10,2) NOT NULL DEFAULT 0.00,
        ADD COLUMN IF NOT EXISTS commission_amount    DECIMAL(10,2) NOT NULL DEFAULT 0.00,
        ADD COLUMN IF NOT EXISTS item_total           DECIMAL(10,2) NOT NULL DEFAULT 0.00,
        ADD COLUMN IF NOT EXISTS color_variation_id   INT           NULL",
    "ALTER TABLE cart_items
        ADD COLUMN IF NOT EXISTS color_variation_id   INT           NULL",
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
    $km = max(0.0, (float)$km);
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

$address     = $stmt->fetch(PDO::FETCH_ASSOC);
$buyerBrgyId = (int)$address['barangay_id'];
$buyerLat    = isset($address['latitude'])  && $address['latitude']  !== null ? (float)$address['latitude']  : null;
$buyerLon    = isset($address['longitude']) && $address['longitude'] !== null ? (float)$address['longitude'] : null;

define('COMMISSION_RATE', 0.02); // 2% platform fee — deducted from seller payout, NOT added to buyer total

try {
    $db->beginTransaction();

    // ── Step 1: validate all items and group by seller ────────────────────────
    $sellerGroups = []; // seller_id → [ items... ]

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

        $qty       = (int)$item->quantity;
        $unitPrice = (float)$product['price'];
        $varId        = isset($item->variation_id)       && $item->variation_id       ? (int)$item->variation_id       : null;
        $colorVarId   = isset($item->color_variation_id) && $item->color_variation_id ? (int)$item->color_variation_id : null;

        // If a variation was specified, validate its stock and use its effective price
        if ($varId !== null) {
            $vstmt = $db->prepare(
                "SELECT id, stock, price_adjustment FROM product_variations WHERE id = ? AND product_id = ?"
            );
            $vstmt->execute([$varId, $product['id']]);
            if ($vstmt->rowCount() === 0) {
                throw new Exception("Invalid variant for product: " . $product['name']);
            }
            $variation  = $vstmt->fetch(PDO::FETCH_ASSOC);
            $availStock = (int)$variation['stock'];
            $unitPrice  = round($unitPrice + (float)$variation['price_adjustment'], 2);
        } else {
            $availStock = (int)$product['stock'];
        }

        if ($availStock < $qty) {
            throw new Exception("Insufficient stock for: " . $product['name']);
        }

        $sellerId  = (int)$product['seller_id'];

        // Per-seller distance
        $sellerLat = isset($product['seller_lat'])  && $product['seller_lat']  !== null ? (float)$product['seller_lat']  : null;
        $sellerLon = isset($product['seller_lon'])  && $product['seller_lon']  !== null ? (float)$product['seller_lon']  : null;
        $km        = 0.0;

        if ($sellerLat !== null && $sellerLon !== null && $buyerLat !== null && $buyerLon !== null) {
            $km = haversineKm($sellerLat, $sellerLon, $buyerLat, $buyerLon);
        } else {
            $sellerBrgyId = (int)$product['seller_barangay_id'];
            if ($sellerBrgyId > 0 && $sellerBrgyId !== $buyerBrgyId) {
                $dStmt = $db->prepare(
                    "SELECT distance_km FROM barangay_distances
                     WHERE from_barangay_id = ? AND to_barangay_id = ?"
                );
                $dStmt->execute([$sellerBrgyId, $buyerBrgyId]);
                $dRow = $dStmt->fetch(PDO::FETCH_ASSOC);
                $km   = $dRow ? (float)$dRow['distance_km'] : 0.0;
            }
        }

        if (!isset($sellerGroups[$sellerId])) {
            $sellerGroups[$sellerId] = [
                'items'      => [],
                'distanceKm' => 0.0,
            ];
        }

        // Track max distance per seller
        if ($km > $sellerGroups[$sellerId]['distanceKm']) {
            $sellerGroups[$sellerId]['distanceKm'] = $km;
        }

        $lineSubtotal = round($unitPrice * $qty, 2);
        $sellerGroups[$sellerId]['items'][] = [
            'product_id'       => $product['id'],
            'seller_id'        => $sellerId,
            'quantity'         => $qty,
            'price'            => $unitPrice,
            'variation_id'     => $varId,
            'color_variation_id' => $colorVarId,
            'item_subtotal'    => $lineSubtotal,
        ];
    }

    // ── Step 2: create one order per seller ───────────────────────────────────
    $createdOrders  = [];
    $grandTotal     = 0.0;
    $allProductIds  = [];
    $dateSuffix     = date('Ymd');

    foreach ($sellerGroups as $sellerId => $group) {
        $orderItems  = $group['items'];
        $distanceKm  = $group['distanceKm'];

        // Subtotal for this seller's items
        $subtotal        = round(array_sum(array_column($orderItems, 'item_subtotal')), 2);
        $totalCommission = round($subtotal * COMMISSION_RATE, 2);        // platform's 2% cut
        $sellerPayout    = round($subtotal - $totalCommission, 2);       // what seller actually receives
        $shippingFee     = calcShippingFee($distanceKm);
        // Buyer pays: product price + shipping only — commission is a deduction from seller, not a markup
        $totalAmount     = round($subtotal + $shippingFee, 2);
        $grandTotal     += $totalAmount;

        // Back-fill per-item commission (deduction from seller, transparent to buyer)
        foreach ($orderItems as &$oi) {
            $oi['commission_amount'] = round($oi['item_subtotal'] * COMMISSION_RATE, 4);
            $oi['item_total']        = $oi['item_subtotal']; // buyer-facing item total unchanged
        }
        unset($oi);

        // Unique order number per seller sub-order
        $orderNumber = 'BGO-' . $dateSuffix . '-' . strtoupper(substr(uniqid(), -6));

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
            $totalCommission,
            $shippingFee,   // rider earns the shipping fee
        ]);
        $orderId = $db->lastInsertId();

        // Insert items
        foreach ($orderItems as $oi) {
            $stmt = $db->prepare(
                "INSERT INTO order_items
                    (order_id, product_id, seller_id, quantity, price,
                     variation_id, color_variation_id, item_subtotal, commission_amount, item_total)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
            );
            $stmt->execute([
                $orderId,
                $oi['product_id'],
                $oi['seller_id'],
                $oi['quantity'],
                $oi['price'],
                $oi['variation_id'],
                $oi['color_variation_id'] ?? null,
                $oi['item_subtotal'],
                $oi['commission_amount'],
                $oi['item_total'],
            ]);

            // Deduct stock on purchase; sold_count incremented on delivery
            if ($oi['variation_id'] !== null) {
                // Deduct from the specific variant's stock
                $stmt = $db->prepare("UPDATE product_variations SET stock = stock - ? WHERE id = ?");
                $stmt->execute([$oi['quantity'], $oi['variation_id']]);
                // Also keep the base product stock in sync (sum of all variant stocks)
                $stmt = $db->prepare(
                    "UPDATE products SET stock = (SELECT COALESCE(SUM(stock),0) FROM product_variations WHERE product_id = ?) WHERE id = ?"
                );
                $stmt->execute([$oi['product_id'], $oi['product_id']]);
            } else {
                $stmt = $db->prepare("UPDATE products SET stock = stock - ? WHERE id = ?");
                $stmt->execute([$oi['quantity'], $oi['product_id']]);
            }

            $stmt = $db->prepare("INSERT INTO product_interactions (user_id, product_id, interaction_type) VALUES (?, ?, 'purchase')");
            $stmt->execute([$payload['user_id'], $oi['product_id']]);

            $allProductIds[] = $oi['product_id'];
        }

        // Order status history
        $stmt = $db->prepare("INSERT INTO order_status_history (order_id, status, changed_by) VALUES (?, 'pending', ?)");
        $stmt->execute([$orderId, $payload['user_id']]);

        // Delivery record
        $stmt = $db->prepare("INSERT INTO deliveries (order_id, status) VALUES (?, 'preparing')");
        $stmt->execute([$orderId]);

        // Notify seller
        $stmt = $db->prepare("INSERT INTO notifications (user_id, title, message, type) VALUES (?, 'New Order', ?, 'order')");
        $stmt->execute([$sellerId, "You have a new order #$orderNumber"]);

        $createdOrders[] = [
            'order_id'          => $orderId,
            'order_number'      => $orderNumber,
            'subtotal'          => $subtotal,
            'commission_amount' => $totalCommission,
            'seller_payout'     => $sellerPayout,
            'shipping_fee'      => $shippingFee,
            'distance_km'       => round($distanceKm, 2),
            'total_amount'      => $totalAmount,
        ];
    }

    // ── Step 3: clear purchased items from cart ───────────────────────────────
    $stmt = $db->prepare("SELECT id FROM carts WHERE user_id = ?");
    $stmt->execute([$payload['user_id']]);
    $cart = $stmt->fetch(PDO::FETCH_ASSOC);

    if ($cart && !empty($allProductIds)) {
        $placeholders = implode(',', array_fill(0, count($allProductIds), '?'));
        $stmt = $db->prepare("DELETE FROM cart_items WHERE cart_id = ? AND product_id IN ($placeholders)");
        $stmt->execute(array_merge([$cart['id']], $allProductIds));
    }

    $db->commit();

    // Log one entry per created order
    foreach ($createdOrders as $co) {
        log_activity($db, $payload['user_id'], 'place_order', 'order', (int)$co['order_id'],
            "Buyer placed order #{$co['order_number']} (₱" . number_format($co['total_amount'], 2) . ")");
    }

    http_response_code(201);
    echo json_encode([
        "message"        => count($createdOrders) > 1
            ? count($createdOrders) . " orders placed successfully (one per store)."
            : "Order placed successfully.",
        "orders"         => $createdOrders,
        // Backwards-compat: single-order clients still get order_id / order_number
        "order_id"       => $createdOrders[0]['order_id'],
        "order_number"   => $createdOrders[0]['order_number'],
        "total_amount"   => round($grandTotal, 2),
        "barangay"       => $address['barangay_name'],
    ]);

} catch (Exception $e) {
    $db->rollBack();
    http_response_code(400);
    echo json_encode(["message" => $e->getMessage()]);
}
