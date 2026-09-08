<?php
require_once '../config/cors.php';
require_once '../config/database.php';

header('Content-Type: application/json');

$database = new Database();
$db = $database->getConnection();

$data = json_decode(file_get_contents("php://input"));

// GET request — just validate the token (used by frontend before showing the form)
if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    $token = $_GET['token'] ?? '';
    if (empty($token)) {
        http_response_code(400);
        echo json_encode(["message" => "Token is required."]);
        exit;
    }

$stmt = $db->prepare("
    SELECT t.id, t.expires_at, t.used_at,
           (t.expires_at < NOW()) AS is_expired,
           u.email
    FROM password_reset_tokens t
    JOIN users u ON u.id = t.user_id
    WHERE t.token = ?
");
$stmt->execute([$token]);
$row = $stmt->fetch(PDO::FETCH_ASSOC);

if (!$row) {
    http_response_code(404);
    echo json_encode(["valid" => false, "message" => "Invalid reset link."]);
    exit;
}
if ($row['used_at'] !== null) {
    http_response_code(409);
    echo json_encode(["valid" => false, "message" => "This reset link has already been used."]);
    exit;
}
if ((int)$row['is_expired'] === 1) {
    http_response_code(410);
    echo json_encode(["valid" => false, "message" => "This reset link has expired."]);
    exit;
}

    echo json_encode(["valid" => true, "email" => $row['email']]);
    exit;
}

// POST — actually reset the password
if (empty($data->token) || empty($data->password) || empty($data->confirm_password)) {
    http_response_code(400);
    echo json_encode(["message" => "Token, password and confirm password are required."]);
    exit;
}

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

$stmt = $db->prepare("
    SELECT t.id, t.user_id, t.used_at,
           (t.expires_at < NOW()) AS is_expired
    FROM password_reset_tokens t
    WHERE t.token = ?
");
$stmt->execute([$data->token]);
$row = $stmt->fetch(PDO::FETCH_ASSOC);

if (!$row) {
    http_response_code(404);
    echo json_encode(["message" => "Invalid reset link."]);
    exit;
}
if ($row['used_at'] !== null) {
    http_response_code(409);
    echo json_encode(["message" => "This reset link has already been used."]);
    exit;
}
if ((int)$row['is_expired'] === 1) {
    http_response_code(410);
    echo json_encode(["message" => "This reset link has expired. Please request a new one."]);
    exit;
}

try {
    $db->beginTransaction();

    $hash = password_hash($data->password, PASSWORD_BCRYPT);
    $stmt = $db->prepare("UPDATE users SET password = ?, updated_at = NOW() WHERE id = ?");
    $stmt->execute([$hash, $row['user_id']]);

    $stmt = $db->prepare("UPDATE password_reset_tokens SET used_at = NOW() WHERE id = ?");
    $stmt->execute([$row['id']]);

    $db->commit();
    echo json_encode(["message" => "Password reset successfully. You can now log in."]);
} catch (Exception $e) {
    $db->rollBack();
    http_response_code(500);
    echo json_encode(["message" => "Failed to reset password. Please try again."]);
}
