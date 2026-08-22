<?php
require_once '../config/cors.php';
require_once '../config/database.php';
require_once '../middleware/auth.php';

$database = new Database();
$db = $database->getConnection();
$auth = new AuthMiddleware($db);
$payload = $auth->requireRole(['seller']);

$data = json_decode(file_get_contents("php://input"));

if (empty($data->name) || empty($data->price) || empty($data->category_id)) {
    http_response_code(400);
    echo json_encode(["message" => "Product name, price, and category are required."]);
    exit;
}

$slug = strtolower(trim(preg_replace('/[^A-Za-z0-9-]+/', '-', $data->name))) . '-' . time();

// Default barangay_id to seller's store barangay if not provided
$barangay_id = isset($data->barangay_id) && $data->barangay_id ? $data->barangay_id : null;
if (!$barangay_id) {
    $stmt = $db->prepare("SELECT barangay_id FROM seller_profiles WHERE user_id = ?");
    $stmt->execute([$payload['user_id']]);
    $sellerProfile = $stmt->fetch(PDO::FETCH_ASSOC);
    if ($sellerProfile && $sellerProfile['barangay_id']) {
        $barangay_id = $sellerProfile['barangay_id'];
    }
}

try {
    $db->beginTransaction();

    $stmt = $db->prepare("INSERT INTO products (seller_id, category_id, name, slug, description, price, stock, `condition`, brand, sku, barangay_id, is_available) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");
    $stmt->execute([
        $payload['user_id'],
        $data->category_id,
        $data->name,
        $slug,
        $data->description ?? '',
        $data->price,
        $data->stock ?? 0,
        $data->condition ?? 'new',
        $data->brand ?? '',
        $data->sku ?? '',
        $data->barangay_id ?? $barangay_id,
        $data->is_available ?? true
    ]);

    $productId = $db->lastInsertId();

    // Add images
    if (!empty($data->images)) {
        foreach ($data->images as $index => $image) {
            $stmt = $db->prepare("INSERT INTO product_images (product_id, image_url, is_primary, sort_order) VALUES (?, ?, ?, ?)");
            $stmt->execute([$productId, $image->url, $index === 0 ? 1 : 0, $index]);
        }
    }

    // Add variations
    if (!empty($data->variations)) {
        foreach ($data->variations as $variation) {
            $stmt = $db->prepare("INSERT INTO product_variations (product_id, name, value, price_adjustment, stock) VALUES (?, ?, ?, ?, ?)");
            $stmt->execute([
                $productId,
                $variation->name,
                $variation->value,
                $variation->price_adjustment ?? 0,
                $variation->stock ?? 0
            ]);
        }
    }

    $db->commit();

    http_response_code(201);
    echo json_encode([
        "message" => "Product created successfully. Awaiting admin approval.",
        "product_id" => $productId
    ]);
} catch (Exception $e) {
    $db->rollBack();
    http_response_code(500);
    echo json_encode(["message" => "Failed to create product."]);
}
