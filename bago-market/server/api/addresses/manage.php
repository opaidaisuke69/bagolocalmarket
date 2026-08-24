<?php
require_once '../config/cors.php';
require_once '../config/database.php';
require_once '../middleware/auth.php';

$database = new Database();
$db = $database->getConnection();
$auth = new AuthMiddleware($db);
$payload = $auth->requireAuth();

$method = $_SERVER['REQUEST_METHOD'];
$data = json_decode(file_get_contents("php://input"));

if ($method === 'POST') {
    if (empty($data->recipient_name) || empty($data->contact_number) || empty($data->barangay_id) || empty($data->street_address)) {
        http_response_code(400);
        echo json_encode(["message" => "All address fields are required."]);
        exit;
    }

    // Verify barangay is valid (within Bago City)
    $stmt = $db->prepare("SELECT id FROM barangays WHERE id = ?");
    $stmt->execute([$data->barangay_id]);
    if ($stmt->rowCount() === 0) {
        http_response_code(400);
        echo json_encode(["message" => "Invalid barangay. Delivery is only available within Bago City."]);
        exit;
    }

    $isDefault = isset($data->is_default) && $data->is_default;

    if ($isDefault) {
        $stmt = $db->prepare("UPDATE addresses SET is_default = 0 WHERE user_id = ?");
        $stmt->execute([$payload['user_id']]);
    }

    $stmt = $db->prepare("INSERT INTO addresses (user_id, recipient_name, contact_number, barangay_id, street_address, landmark, delivery_notes, is_default) VALUES (?, ?, ?, ?, ?, ?, ?, ?)");
    $stmt->execute([
        $payload['user_id'],
        $data->recipient_name,
        $data->contact_number,
        $data->barangay_id,
        $data->street_address,
        $data->landmark ?? '',
        $data->delivery_notes ?? '',
        $isDefault ? 1 : 0
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
        $stmt = $db->prepare("UPDATE addresses SET is_default = 0 WHERE user_id = ?");
        $stmt->execute([$payload['user_id']]);
    }

    $stmt = $db->prepare("UPDATE addresses SET recipient_name = ?, contact_number = ?, barangay_id = ?, street_address = ?, landmark = ?, delivery_notes = ?, is_default = ? WHERE id = ? AND user_id = ?");
    $stmt->execute([
        $data->recipient_name ?? '',
        $data->contact_number ?? '',
        $data->barangay_id ?? null,
        $data->street_address ?? '',
        $data->landmark ?? '',
        $data->delivery_notes ?? '',
        isset($data->is_default) ? ($data->is_default ? 1 : 0) : 0,
        $data->id,
        $payload['user_id']
    ]);

    echo json_encode(["message" => "Address updated successfully."]);

} elseif ($method === 'DELETE') {
    $id = isset($_GET['id']) ? (int)$_GET['id'] : 0;
    if ($id === 0) {
        http_response_code(400);
        echo json_encode(["message" => "Address ID is required."]);
        exit;
    }

    $stmt = $db->prepare("UPDATE addresses SET deleted_at = NOW() WHERE id = ? AND user_id = ?");
    $stmt->execute([$id, $payload['user_id']]);

    echo json_encode(["message" => "Address deleted successfully."]);
}
