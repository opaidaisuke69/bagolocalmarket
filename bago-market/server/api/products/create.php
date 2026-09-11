<?php
error_reporting(E_ALL);
ini_set('display_errors', 0);
ini_set('log_errors', 1);

require_once '../config/cors.php';
require_once '../config/database.php';
require_once '../middleware/auth.php';
require_once '../config/logger.php';

$database = new Database();
$db = $database->getConnection();
$auth = new AuthMiddleware($db);
$payload = $auth->requireRole(['seller']);

$data = json_decode(file_get_contents("php://input"));

if (!$data) {
    http_response_code(400);
    echo json_encode(["message" => "Invalid JSON body."]);
    exit;
}

if (empty($data->name) || !isset($data->price) || empty($data->category_id)) {
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

$description = isset($data->description) ? $data->description : '';
$stock = isset($data->stock) ? (int)$data->stock : 0;
$condition = isset($data->condition) ? $data->condition : 'new';
$brand = isset($data->brand) ? $data->brand : '';
$sku = isset($data->sku) ? $data->sku : '';
$is_available = isset($data->is_available) ? $data->is_available : true;

try {
    $db->beginTransaction();

    $stmt = $db->prepare("INSERT INTO products (seller_id, category_id, name, slug, description, price, stock, `condition`, brand, sku, barangay_id, is_available) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");
    $stmt->execute([
        $payload['user_id'],
        $data->category_id,
        $data->name,
        $slug,
        $description,
        round((float)$data->price, 2), // seller's listed price — stored as-is, 2% commission deducted at order time
        $stock,
        $condition,
        $brand,
        $sku,
        $barangay_id,
        $is_available
    ]);

    $productId = $db->lastInsertId();

    // Add images
    if (!empty($data->images)) {
        foreach ($data->images as $index => $image) {
            $imageUrl = is_string($image) ? $image : (isset($image->url) ? $image->url : '');
            if (!empty($imageUrl)) {
                $stmt = $db->prepare("INSERT INTO product_images (product_id, image_url, is_primary, sort_order) VALUES (?, ?, ?, ?)");
                $stmt->execute([$productId, $imageUrl, $index === 0 ? 1 : 0, $index]);
            }
        }
    }

    // Add variations
    if (!empty($data->variations)) {
        foreach ($data->variations as $variation) {
            $varName     = isset($variation->name)             ? $variation->name             : '';
            $varValue    = isset($variation->value)            ? $variation->value            : '';
            $varPrice    = isset($variation->price_adjustment) ? $variation->price_adjustment : 0;
            $varStock    = isset($variation->stock)            ? $variation->stock            : 0;
            $varImageUrl = isset($variation->image_url)        ? $variation->image_url        : null;
            $varHex      = isset($variation->hex)              ? $variation->hex              : null;
            if (!empty($varName) && !empty($varValue)) {
                // Build query dynamically so it works even if optional columns don't exist yet
                $cols   = ['product_id', 'name', 'value', 'price_adjustment', 'stock'];
                $vals   = [$productId, $varName, $varValue, $varPrice, $varStock];
                $placeholders = ['?', '?', '?', '?', '?'];

                if ($varImageUrl !== null) {
                    $cols[]         = 'image_url';
                    $vals[]         = $varImageUrl;
                    $placeholders[] = '?';
                }
                if ($varHex !== null) {
                    $cols[]         = 'hex';
                    $vals[]         = $varHex;
                    $placeholders[] = '?';
                }

                $sql  = 'INSERT INTO product_variations (' . implode(', ', $cols) . ') VALUES (' . implode(', ', $placeholders) . ')';
                $stmt = $db->prepare($sql);
                $stmt->execute($vals);
            }
        }
    }

    $db->commit();

    log_activity($db, $payload['user_id'], 'create_product', 'product', $productId,
        "Created product \"{$data->name}\" (₱" . number_format((float)$data->price, 2) . ", stock: $stock)");

    http_response_code(201);
    echo json_encode([
        "message" => "Product created successfully. Awaiting admin approval.",
        "product_id" => $productId
    ]);
} catch (Exception $e) {
    $db->rollBack();
    http_response_code(500);
    echo json_encode(["message" => "Failed to create product: " . $e->getMessage()]);
}
