<?php
require_once '../config/cors.php';
require_once '../config/database.php';

header('Content-Type: application/json');

$database = new Database();
$db = $database->getConnection();

$data = json_decode(file_get_contents("php://input"));

if (empty($data->email)) {
    http_response_code(400);
    echo json_encode(["message" => "Email address is required."]);
    exit;
}

// Ensure table exists
try {
    $db->exec("
        CREATE TABLE IF NOT EXISTS email_verification_tokens (
            id INT AUTO_INCREMENT PRIMARY KEY,
            user_id INT NOT NULL,
            token VARCHAR(64) NOT NULL UNIQUE,
            expires_at TIMESTAMP NOT NULL,
            used_at TIMESTAMP NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
            INDEX idx_token (token),
            INDEX idx_user_evt (user_id)
        )
    ");
} catch (Exception $e) { /* already exists */ }

$stmt = $db->prepare("SELECT id, full_name, email, email_verified_at FROM users WHERE email = ? AND deleted_at IS NULL");
$stmt->execute([$data->email]);
$user = $stmt->fetch(PDO::FETCH_ASSOC);

// Silent response to prevent enumeration
if (!$user) {
    echo json_encode(["message" => "If that email is registered and unverified, a new link has been sent."]);
    exit;
}

if ($user['email_verified_at'] !== null) {
    http_response_code(409);
    echo json_encode(["message" => "This email is already verified. Please log in."]);
    exit;
}

// Invalidate existing tokens
$stmt = $db->prepare("UPDATE email_verification_tokens SET used_at = NOW() WHERE user_id = ? AND used_at IS NULL");
$stmt->execute([$user['id']]);

// Create new token
$token   = bin2hex(random_bytes(32));
$expires = date('Y-m-d H:i:s', strtotime('+24 hours'));
$stmt    = $db->prepare("INSERT INTO email_verification_tokens (user_id, token, expires_at) VALUES (?, ?, ?)");
$stmt->execute([$user['id'], $token, $expires]);

// Send — non-fatal
try {
    require_once '../config/mailer.php';
    Mailer::sendVerification($user['email'], $user['full_name'], $token);
} catch (Throwable $e) {
    error_log('resend-verification mailer error: ' . $e->getMessage());
}

echo json_encode(["message" => "If that email is registered and unverified, a new link has been sent."]);
