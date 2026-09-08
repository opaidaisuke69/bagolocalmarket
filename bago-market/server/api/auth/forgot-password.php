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

if (!filter_var($data->email, FILTER_VALIDATE_EMAIL)) {
    http_response_code(400);
    echo json_encode(["message" => "Invalid email format."]);
    exit;
}

// Ensure password_reset_tokens table exists
try {
    $db->exec("
        CREATE TABLE IF NOT EXISTS password_reset_tokens (
            id INT AUTO_INCREMENT PRIMARY KEY,
            user_id INT NOT NULL,
            token VARCHAR(64) NOT NULL UNIQUE,
            expires_at TIMESTAMP NOT NULL,
            used_at TIMESTAMP NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
            INDEX idx_token_prt (token),
            INDEX idx_user_prt (user_id)
        )
    ");
} catch (Exception $e) { /* already exists */ }

// Look up user — accept any role (buyer, seller, rider, admin)
$stmt = $db->prepare("SELECT id, full_name, email, role FROM users WHERE email = ? AND deleted_at IS NULL");
$stmt->execute([$data->email]);
$user = $stmt->fetch(PDO::FETCH_ASSOC);

// Always respond the same way to prevent user enumeration
if (!$user) {
    echo json_encode(["message" => "If that email is registered, a reset link has been sent."]);
    exit;
}

// Invalidate any existing unused tokens
$stmt = $db->prepare("UPDATE password_reset_tokens SET used_at = NOW() WHERE user_id = ? AND used_at IS NULL");
$stmt->execute([$user['id']]);

// Create new token (1 hour expiry)
$token   = bin2hex(random_bytes(32));
$expires = date('Y-m-d H:i:s', strtotime('+1 hour'));

$stmt = $db->prepare("INSERT INTO password_reset_tokens (user_id, token, expires_at) VALUES (?, ?, ?)");
$stmt->execute([$user['id'], $token, $expires]);

// Send email — non-fatal
try {
    require_once '../config/mailer.php';
    $appType = ($user['role'] === 'rider') ? 'rider' : 'web';
    Mailer::sendPasswordReset($user['email'], $user['full_name'], $token, $appType);
} catch (Throwable $e) {
    error_log('forgot-password mailer error: ' . $e->getMessage());
}

echo json_encode(["message" => "If that email is registered, a reset link has been sent."]);
