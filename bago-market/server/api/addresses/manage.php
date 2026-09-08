<?php
require_once '../config/cors.php';
require_once '../config/database.php';
require_once '../middleware/auth.php';

$database = new Database();
$db = $database->getConnection();
$auth = new AuthMiddleware($db);
$payload = $auth->requireAuth();

// Auto-add coordinate columns if missing
foreach ([
    "ALTER TABLE addresses ADD COLUMN IF NOT EXISTS latitude  DECIMAL(10,8) NULL",
    "ALTER TABLE addresses ADD COLUMN IF NOT EXISTS longitude DECIMAL(11,8) NULL",
] as $col) {
    try { $db->exec($col); } catch (Exception $e) {}
}

$method = $_SERVER['REQUEST_METHOD'];
$data   = json_decode(file_get_contents("php://input"));

if ($method === 'POST') {
    if (empty($data->recipient_name) || empty($data->contact_number) || empty($data->street_address)) {
        http_response_code(400);
        echo json_encode(["message" => "Recipient name, contact number and street address are required."]);
        exit;
    }

    // Coordinates are required for accurate shipping fee
    if (empty($data->latitude) || empty($data->longitude)) {
        http_response_code(400);
        echo json_encode(["message" => "Please pin your exact location on the map."]);
        exit;
    }

    // Enforce 5-address limit
    $countStmt = $db->prepare("SELECT COUNT(*) FROM addresses WHERE user_id = ? AND deleted_at IS NULL");
    $countStmt->execute([$payload['user_id']]);
    if ((int)$countStmt->fetchColumn() >= 5) {
        http_response_code(422);
        echo json_encode(["message" => "You can only save up to 5 addresses. Please remove one first."]);
        exit;
    }

    $isDefault = isset($data->is_default) && $data->is_default;
    // First address is always default
    $countStmt->execute([$payload['user_id']]);
    if ((int)$countStmt->fetchColumn() === 0) $isDefault = true;

    if ($isDefault) {
        $db->prepare("UPDATE addresses SET is_default = 0 WHERE user_id = ?")->execute([$payload['user_id']]);
    }

    $stmt = $db->prepare(
        "INSERT INTO addresses
            (user_id, recipient_name, contact_number, barangay_id, street_address,
             landmark, delivery_notes, is_default, latitude, longitude)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
    );
    $stmt->execute([
        $payload['user_id'],
        $data->recipient_name,
        $data->contact_number,
        !empty($data->barangay_id) ? (int)$data->barangay_id : null,
        $data->street_address,
        $data->landmark       ?? '',
        $data->delivery_notes ?? '',
        $isDefault ? 1 : 0,
        (float)$data->latitude,
        (float)$data->longitude,
    ]);

    http_response_code(201);
    echo json_encode(["message" => "Address added successfully.", "id" => $db->lastInsertId()]);

} elseif ($method === 'PUT') {
    if (empty($data->id)) {
        http_response_code(400);
        echo json_encode(["message" => "Address ID is required."]);
        exit;
    }

    $stmt = $db->prepare("SELECT id FROM addresses WHERE id = ? AND user_id = ?");
    $stmt->execute([$data->id, $payload['user_id']]);
    if ($stmt->rowCount() === 0) {
        http_response_code(404);
        echo json_encode(["message" => "Address not found."]);
        exit;
    }

    if (isset($data->is_default) && $data->is_default) {
        $db->prepare("UPDATE addresses SET is_default = 0 WHERE user_id = ?")->execute([$payload['user_id']]);
    }

    $stmt = $db->prepare(
        "UPDATE addresses SET
            recipient_name = ?, contact_number = ?, barangay_id = ?,
            street_address = ?, landmark = ?, delivery_notes = ?, is_default = ?,
            latitude = ?, longitude = ?
         WHERE id = ? AND user_id = ?"
    );
    $stmt->execute([
        $data->recipient_name ?? '',
        $data->contact_number ?? '',
        !empty($data->barangay_id) ? (int)$data->barangay_id : null,
        $data->street_address ?? '',
        $data->landmark       ?? '',
        $data->delivery_notes ?? '',
        isset($data->is_default) ? ($data->is_default ? 1 : 0) : 0,
        !empty($data->latitude)  ? (float)$data->latitude  : null,
        !empty($data->longitude) ? (float)$data->longitude : null,
        $data->id,
        $payload['user_id'],
    ]);

    echo json_encode(["message" => "Address updated successfully."]);

} elseif ($method === 'DELETE') {
    $id = isset($_GET['id']) ? (int)$_GET['id'] : 0;
    if ($id === 0) {
        http_response_code(400);
        echo json_encode(["message" => "Address ID is required."]);
        exit;
    }

    $db->prepare("UPDATE addresses SET deleted_at = NOW() WHERE id = ? AND user_id = ?")
       ->execute([$id, $payload['user_id']]);

    echo json_encode(["message" => "Address deleted successfully."]);
}
