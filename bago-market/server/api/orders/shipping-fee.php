<?php
/**
 * GET /orders/shipping-fee.php?address_id=X[&seller_ids=1,2,3]
 *
 * PIN-TO-PIN shipping fee using Haversine (straight-line GPS distance).
 *
 * Formula:  fee = max(₱25,  km × ₱5)
 *   0 – 5 km  →  ₱25 flat
 *   > 5 km    →  km × ₱5   (e.g. 8 km = ₱40, 17 km = ₱85)
 *   Rounded up to nearest peso.
 *
 * Requires both buyer address AND seller profile to have lat/lng pinned.
 * If GPS is missing on either side, returns has_gps_issue = true with a
 * clear message instead of guessing from barangay names.
 */
require_once '../config/cors.php';
require_once '../config/database.php';
require_once '../middleware/auth.php';

$database = new Database();
$db       = $database->getConnection();
$auth     = new AuthMiddleware($db);
$payload  = $auth->requireRole(['buyer']);

// ─── Haversine: straight-line km between two GPS points ──────────────────────
function haversineKm(float $lat1, float $lon1, float $lat2, float $lon2): float {
    $R    = 6371.0;
    $dLat = deg2rad($lat2 - $lat1);
    $dLon = deg2rad($lon2 - $lon1);
    $a    = sin($dLat / 2) ** 2
          + cos(deg2rad($lat1)) * cos(deg2rad($lat2)) * sin($dLon / 2) ** 2;
    return $R * 2 * atan2(sqrt($a), sqrt(1 - $a));
}

// ─── Fee formula ─────────────────────────────────────────────────────────────
function calcFee(float $km): float {
    return (float) ceil(max(25.0, $km * 5.0));
}

// ─── Inputs ──────────────────────────────────────────────────────────────────
$addressId = isset($_GET['address_id']) ? (int) $_GET['address_id'] : 0;
if ($addressId === 0) {
    http_response_code(400);
    echo json_encode(['message' => 'address_id is required.']);
    exit;
}

$sellerIds = [];
if (!empty($_GET['seller_ids'])) {
    foreach (explode(',', $_GET['seller_ids']) as $sid) {
        $s = (int) trim($sid);
        if ($s > 0) $sellerIds[] = $s;
    }
}

// ─── Buyer delivery address (must have GPS pin) ───────────────────────────────
$stmt = $db->prepare(
    "SELECT a.latitude, a.longitude, b.name AS barangay_name
     FROM addresses a
     LEFT JOIN barangays b ON a.barangay_id = b.id
     WHERE a.id = ? AND a.user_id = ? AND a.deleted_at IS NULL"
);
$stmt->execute([$addressId, $payload['user_id']]);
if ($stmt->rowCount() === 0) {
    http_response_code(404);
    echo json_encode(['message' => 'Address not found.']);
    exit;
}
$buyerAddr = $stmt->fetch(PDO::FETCH_ASSOC);
$buyerLat  = $buyerAddr['latitude']  !== null ? (float) $buyerAddr['latitude']  : null;
$buyerLon  = $buyerAddr['longitude'] !== null ? (float) $buyerAddr['longitude'] : null;

// ─── Process sellers ──────────────────────────────────────────────────────────
$maxKm           = 0.0;
$sellerBreakdown = [];
$gpsIssues       = [];          // sellers without a pinned location

if (!empty($sellerIds)) {
    $placeholders = implode(',', array_fill(0, count($sellerIds), '?'));
    $stmt = $db->prepare(
        "SELECT sp.user_id AS seller_id,
                sp.latitude, sp.longitude,
                b.name AS barangay_name,
                u.full_name AS seller_name,
                COALESCE(sp.store_name, u.full_name) AS store_name
         FROM seller_profiles sp
         LEFT JOIN barangays b ON sp.barangay_id = b.id
         LEFT JOIN users     u ON sp.user_id     = u.id
         WHERE sp.user_id IN ($placeholders)"
    );
    $stmt->execute($sellerIds);
    $sellers = $stmt->fetchAll(PDO::FETCH_ASSOC);

    foreach ($sellers as $s) {
        $sellerLat = $s['latitude']  !== null ? (float) $s['latitude']  : null;
        $sellerLon = $s['longitude'] !== null ? (float) $s['longitude'] : null;

        // Both sides must have GPS for pin-to-pin calculation
        if ($sellerLat === null || $sellerLon === null) {
            $gpsIssues[] = ($s['store_name'] ?: 'A seller') . ' has not pinned their store location.';
            // Use 0 km — fee will be ₱25 minimum for this seller
            $km = 0.0;
            $method = 'no_seller_gps';
        } elseif ($buyerLat === null || $buyerLon === null) {
            $gpsIssues[] = 'Your delivery address has no GPS pin. Please edit it and pin your location.';
            $km = 0.0;
            $method = 'no_buyer_gps';
        } else {
            $km     = haversineKm($sellerLat, $sellerLon, $buyerLat, $buyerLon);
            $method = 'gps';
        }

        $fee = calcFee($km);

        $sellerBreakdown[] = [
            'seller_id'       => (int) $s['seller_id'],
            'store_name'      => $s['store_name'],
            'seller_barangay' => $s['barangay_name'],
            'seller_lat'      => $sellerLat,
            'seller_lng'      => $sellerLon,
            'distance_km'     => round($km, 3),
            'fee'             => $fee,
            'method'          => $method,
        ];

        if ($km > $maxKm) $maxKm = $km;
    }
}

// If no sellers provided, just return the minimum
$shippingFee  = calcFee($maxKm);
$hasGpsIssue  = !empty($gpsIssues) || ($buyerLat === null && !empty($sellerIds));
$uniqueIssues = array_values(array_unique($gpsIssues));

// Build readable GPS note
$note = '';
if ($buyerLat === null) {
    $note = 'Your delivery address has no GPS pin. Edit it and drop a pin for an accurate fee.';
} elseif (!empty($uniqueIssues)) {
    $note = implode(' ', $uniqueIssues) . ' Showing minimum fee until all locations are pinned.';
}

echo json_encode([
    'shipping_fee'    => $shippingFee,
    'distance_km'     => round($maxKm, 3),
    'fee_breakdown'   => '₱5 × km · min ₱25 (0–5 km) · pin-to-pin GPS',
    'method'          => $hasGpsIssue ? 'partial_gps' : 'gps',
    'buyer_has_gps'   => $buyerLat !== null,
    'buyer_barangay'  => $buyerAddr['barangay_name'],
    'buyer_lat'       => $buyerLat,
    'buyer_lng'       => $buyerLon,
    'sellers'         => $sellerBreakdown,
    'has_gps_issue'   => $hasGpsIssue,
    'note'            => $note,
]);
