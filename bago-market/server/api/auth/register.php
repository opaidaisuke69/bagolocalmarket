<?php
require_once '../config/cors.php';
require_once '../config/database.php';

$database = new Database();
$db = $database->getConnection();

$data = json_decode(file_get_contents("php://input"));

if (empty($data->full_name) || empty($data->email) || empty($data->password) || empty($data->contact_number)) {
    http_response_code(400);
    echo json_encode(["message" => "All fields are required."]);
    exit;
}

// Validate email
if (!filter_var($data->email, FILTER_VALIDATE_EMAIL)) {
    http_response_code(400);
    echo json_encode(["message" => "Invalid email format."]);
    exit;
}

// Check duplicate email
$stmt = $db->prepare("SELECT id FROM users WHERE email = ?");
$stmt->execute([$data->email]);
if ($stmt->rowCount() > 0) {
    http_response_code(409);
    echo json_encode(["message" => "Email already exists."]);
    exit;
}

// Password validation
if (strlen($data->password) < 8) {
    http_response_code(400);
    echo json_encode(["message" => "Password must be at least 8 characters."]);
    exit;
}

if ($data->password !== $data->confirm_password) {
    http_response_code(400);
    echo json_encode(["message" => "Passwords do not match."]);
    exit;
}

$role = isset($data->role) ? $data->role : 'buyer';
$hashedPassword = password_hash($data->password, PASSWORD_BCRYPT);

try {
    $db->beginTransaction();

    $stmt = $db->prepare("INSERT INTO users (full_name, email, password, contact_number, role) VALUES (?, ?, ?, ?, ?)");
    $stmt->execute([$data->full_name, $data->email, $hashedPassword, $data->contact_number, $role]);
    $userId = $db->lastInsertId();

    if ($role === 'buyer') {
        $barangayId = isset($data->barangay_id) ? $data->barangay_id : null;
        $address = isset($data->complete_address) ? $data->complete_address : '';
        $stmt = $db->prepare("INSERT INTO buyer_profiles (user_id, barangay_id, complete_address) VALUES (?, ?, ?)");
        $stmt->execute([$userId, $barangayId, $address]);

        // Create cart for buyer
        $stmt = $db->prepare("INSERT INTO carts (user_id) VALUES (?)");
        $stmt->execute([$userId]);
    }

    if ($role === 'seller') {
        $stmt = $db->prepare("INSERT INTO seller_profiles (user_id, store_name, store_description, barangay_id, complete_address, verification_document) VALUES (?, ?, ?, ?, ?, ?)");
        $stmt->execute([
            $userId,
            $data->store_name ?? '',
            $data->store_description ?? '',
            $data->barangay_id ?? null,
            $data->complete_address ?? '',
            $data->verification_document ?? ''
        ]);
    }

    $db->commit();

    http_response_code(201);
    echo json_encode([
        "message" => "Registration successful.",
        "user_id" => $userId
    ]);
} catch (Exception $e) {
    $db->rollBack();
    http_response_code(500);
    echo json_encode(["message" => "Registration failed. Please try again."]);
}
