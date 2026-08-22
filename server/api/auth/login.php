<?php
require_once '../config/cors.php';
require_once '../config/database.php';
require_once '../middleware/auth.php';

$database = new Database();
$db = $database->getConnection();

$data = json_decode(file_get_contents("php://input"));

if (empty($data->email) || empty($data->password)) {
    http_response_code(400);
    echo json_encode(["message" => "Email and password are required."]);
    exit;
}

$stmt = $db->prepare("SELECT id, email, password, full_name, role, status, profile_image, contact_number FROM users WHERE email = ? AND deleted_at IS NULL");
$stmt->execute([$data->email]);

if ($stmt->rowCount() === 0) {
    http_response_code(401);
    echo json_encode(["message" => "Invalid email or password."]);
    exit;
}

$user = $stmt->fetch(PDO::FETCH_ASSOC);

if (!password_verify($data->password, $user['password'])) {
    http_response_code(401);
    echo json_encode(["message" => "Invalid email or password."]);
    exit;
}

if ($user['status'] === 'banned') {
    http_response_code(403);
    echo json_encode(["message" => "Your account has been banned."]);
    exit;
}

if ($user['status'] === 'suspended') {
    http_response_code(403);
    echo json_encode(["message" => "Your account has been suspended."]);
    exit;
}

// Check seller approval
if ($user['role'] === 'seller') {
    $stmtSeller = $db->prepare("SELECT approval_status FROM seller_profiles WHERE user_id = ?");
    $stmtSeller->execute([$user['id']]);
    $seller = $stmtSeller->fetch(PDO::FETCH_ASSOC);
    if ($seller && $seller['approval_status'] !== 'approved') {
        http_response_code(403);
        echo json_encode(["message" => "Your seller account is pending approval."]);
        exit;
    }
}

// Update last login
$stmt = $db->prepare("UPDATE users SET last_login_at = NOW() WHERE id = ?");
$stmt->execute([$user['id']]);

$auth = new AuthMiddleware($db);
$token = $auth->generateToken($user['id'], $user['role']);

unset($user['password']);

echo json_encode([
    "message" => "Login successful.",
    "token" => $token,
    "user" => $user
]);
