<?php
require_once '../config/cors.php';
require_once '../config/database.php';
require_once '../middleware/auth.php';

header('Content-Type: application/json');

$database = new Database();
$db = $database->getConnection();

$data = json_decode(file_get_contents("php://input"));

if (empty($data->email) || empty($data->password)) {
    http_response_code(400);
    echo json_encode(["message" => "Email and password are required."]);
    exit;
}

// Check if email_verified_at column exists (graceful fallback before migration is run)
$hasVerifiedCol = false;
try {
    $colCheck = $db->query("SHOW COLUMNS FROM users LIKE 'email_verified_at'");
    $hasVerifiedCol = ($colCheck && $colCheck->rowCount() > 0);
} catch (Exception $e) {}

$selectCols = "id, email, password, full_name, role, status, profile_image, contact_number";
if ($hasVerifiedCol) {
    $selectCols .= ", email_verified_at";
}

$stmt = $db->prepare("SELECT $selectCols FROM users WHERE email = ? AND deleted_at IS NULL");
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

// Email verification check — only enforce if column exists and is populated
if ($hasVerifiedCol && array_key_exists('email_verified_at', $user) && $user['email_verified_at'] === null) {
    http_response_code(403);
    echo json_encode([
        "message" => "Please verify your email address before logging in. Check your inbox.",
        "email_unverified" => true,
    ]);
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

// Check rider approval — only if rider_profiles table exists
if ($user['role'] === 'rider') {
    try {
        $stmtRider = $db->prepare("SELECT approval_status FROM rider_profiles WHERE user_id = ?");
        $stmtRider->execute([$user['id']]);
        $rider = $stmtRider->fetch(PDO::FETCH_ASSOC);
        if ($rider && $rider['approval_status'] !== 'approved') {
            http_response_code(403);
            echo json_encode(["message" => "Your rider account is pending admin approval."]);
            exit;
        }
    } catch (Exception $e) {
        // rider_profiles table may not exist yet — allow login
    }
}

// Update last login
$stmt = $db->prepare("UPDATE users SET last_login_at = NOW() WHERE id = ?");
$stmt->execute([$user['id']]);

$auth  = new AuthMiddleware($db);
$token = $auth->generateToken($user['id'], $user['role']);

unset($user['password']);

echo json_encode([
    "message" => "Login successful.",
    "token"   => $token,
    "user"    => $user,
]);
