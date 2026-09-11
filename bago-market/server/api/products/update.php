<?php
require_once '../config/cors.php';
require_once '../config/database.php';
require_once '../middleware/auth.php';
require_once '../config/logger.php';

$database = new Database();
$db = $database->getConnection();
$auth = new AuthMiddleware($db);
$payload = $auth->requireRole(['seller']);

$data = json_decode(file_get_contents("php://input"));

if (empty($data->id)) {
    http_response_code(400);
    echo json_encode(["message" => "Product ID is required."]);
    exit;
}

// Verify ownership
$stmt = $db->prepare("SELECT id FROM products WHERE id = ? AND seller_id = ? AND deleted_at IS NULL");
$stmt->execute([$data->id, $payload['user_id']]);

if ($stmt->rowCount() === 0) {
    http_response_code(403);
    echo json_encode(["message" => "Product not found or access denied."]);
    exit;
}

try {
    $db->beginTransaction();

    $fields = [];
    $params = [];

    if (isset($data->name)) { $fields[] = "name = ?"; $params[] = $data->name; }
    if (isset($data->description)) { $fields[] = "description = ?"; $params[] = $data->description; }
    if (isset($data->price)) { $fields[] = "price = ?"; $params[] = round((float)$data->price, 2); } // seller's listed price — stored as-is, 2% commission deducted at order time
    if (isset($data->stock)) { $fields[] = "stock = ?"; $params[] = $data->stock; }
    if (isset($data->category_id)) { $fields[] = "category_id = ?"; $params[] = $data->category_id; }
    if (isset($data->condition)) { $fields[] = "`condition` = ?"; $params[] = $data->condition; }
    if (isset($data->brand)) { $fields[] = "brand = ?"; $params[] = $data->brand; }
    if (isset($data->sku)) { $fields[] = "sku = ?"; $params[] = $data->sku; }
    if (isset($data->barangay_id)) { $fields[] = "barangay_id = ?"; $params[] = $data->barangay_id; }
    if (isset($data->is_available)) { $fields[] = "is_available = ?"; $params[] = $data->is_available; }

    if (!empty($fields)) {
        $params[] = $data->id;
        $query = "UPDATE products SET " . implode(', ', $fields) . " WHERE id = ?";
        $stmt = $db->prepare($query);
        $stmt->execute($params);
    }

    // Update images if provided
    if (isset($data->images)) {
        $stmt = $db->prepare("DELETE FROM product_images WHERE product_id = ?");
        $stmt->execute([$data->id]);

        foreach ($data->images as $index => $image) {
            $stmt = $db->prepare("INSERT INTO product_images (product_id, image_url, is_primary, sort_order) VALUES (?, ?, ?, ?)");
            $stmt->execute([$data->id, $image->url, $index === 0 ? 1 : 0, $index]);
        }
    }

    // Update variations if provided
    if (isset($data->variations)) {
        $stmt = $db->prepare("DELETE FROM product_variations WHERE product_id = ?");
        $stmt->execute([$data->id]);

        foreach ($data->variations as $variation) {
            $varName  = isset($variation->name)             ? trim($variation->name)             : '';
            $varValue = isset($variation->value)            ? trim($variation->value)            : '';
            $varAdj   = isset($variation->price_adjustment) ? (float)$variation->price_adjustment : 0;
            $varStock    = isset($variation->stock)            ? (int)$variation->stock              : 0;
            $varImageUrl = isset($variation->image_url)        ? $variation->image_url               : null;
            $varHex      = isset($variation->hex)              ? $variation->hex                     : null;
            if ($varName !== '' && $varValue !== '') {
                // Build query dynamically so it works even if optional columns don't exist yet
                $cols   = ['product_id', 'name', 'value', 'price_adjustment', 'stock'];
                $vals   = [$data->id, $varName, $varValue, $varAdj, $varStock];
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

    log_activity($db, $payload['user_id'], 'update_product', 'product', (int)$data->id,
        "Updated product #" . (int)$data->id);

    echo json_encode(["message" => "Product updated successfully."]);
} catch (Exception $e) {
    $db->rollBack();
    http_response_code(500);
    echo json_encode(["message" => "Failed to update product."]);
}
