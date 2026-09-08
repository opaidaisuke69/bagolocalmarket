<?php
require_once '../config/cors.php';
require_once '../config/database.php';

// cors.php already sets Content-Type: application/json

$database = new Database();
$db = $database->getConnection();

// ── Parse multipart manually when $_FILES is empty (Apache rewrite bug) ──────
function parseMultipart(): array {
    $ct = $_SERVER['CONTENT_TYPE'] ?? '';
    if (!preg_match('/boundary=(.+)$/', $ct, $m)) return ['post' => [], 'files' => []];
    $boundary = $m[1];
    $raw = file_get_contents('php://input');
    if (empty($raw)) {
        // Fall back to $_POST / $_FILES (normal PHP parsing worked)
        return ['post' => $_POST, 'files' => $_FILES];
    }

    $post = [];
    $files = [];
    $parts = preg_split('/--' . preg_quote($boundary, '/') . '(?:--)?/', $raw);

    foreach ($parts as $part) {
        $part = ltrim($part, "\r\n");
        if (empty($part)) continue;

        // Split headers from body
        $pos = strpos($part, "\r\n\r\n");
        if ($pos === false) continue;
        $headers_raw = substr($part, 0, $pos);
        $body        = substr($part, $pos + 4);
        $body        = rtrim($body, "\r\n");

        // Parse Content-Disposition
        if (!preg_match('/Content-Disposition:\s*form-data;(.+)/i', $headers_raw, $dMatch)) continue;
        $disp = $dMatch[1];

        preg_match('/name="([^"]+)"/', $disp, $nameMatch);
        $name = $nameMatch[1] ?? null;
        if (!$name) continue;

        if (preg_match('/filename="([^"]+)"/i', $disp, $fnMatch)) {
            // It's a file
            $filename = $fnMatch[1];
            $mimeType = 'application/octet-stream';
            if (preg_match('/Content-Type:\s*(.+)/i', $headers_raw, $ctMatch)) {
                $mimeType = trim($ctMatch[1]);
            }
            // Save to temp file
            $tmpFile = tempnam(sys_get_temp_dir(), 'rfu_');
            file_put_contents($tmpFile, $body);
            $files[$name] = [
                'name'     => $filename,
                'type'     => $mimeType,
                'tmp_name' => $tmpFile,
                'error'    => UPLOAD_ERR_OK,
                'size'     => strlen($body),
            ];
        } else {
            $post[$name] = $body;
        }
    }

    // Merge with normally parsed data (in case some arrived correctly)
    return [
        'post'  => array_merge($post,  $_POST),
        'files' => array_merge($files, $_FILES),
    ];
}

$parsed = parseMultipart();
$data   = (object) $parsed['post'];
$files  = $parsed['files'];

// ── Validation ────────────────────────────────────────────────────────────────
$required = ['full_name', 'email', 'contact_number', 'birthdate', 'sex', 'password', 'confirm_password'];
foreach ($required as $field) {
    if (empty($data->$field)) {
        http_response_code(400);
        echo json_encode(["message" => ucfirst(str_replace('_', ' ', $field)) . " is required."]);
        exit;
    }
}

if (!filter_var($data->email, FILTER_VALIDATE_EMAIL)) {
    http_response_code(400);
    echo json_encode(["message" => "Invalid email format."]);
    exit;
}

$stmt = $db->prepare("SELECT id FROM users WHERE email = ?");
$stmt->execute([$data->email]);
if ($stmt->rowCount() > 0) {
    http_response_code(409);
    echo json_encode(["message" => "Email already exists."]);
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

if (!in_array($data->sex, ['male', 'female', 'other'])) {
    http_response_code(400);
    echo json_encode(["message" => "Invalid sex value. Must be male, female, or other."]);
    exit;
}

$birthdateTs = strtotime($data->birthdate);
if (!$birthdateTs || $birthdateTs >= strtotime('today')) {
    http_response_code(400);
    echo json_encode(["message" => "Invalid birthdate."]);
    exit;
}
$birthYear = (int) date('Y', $birthdateTs);
$birthMD   = (int) date('md', $birthdateTs);
$age       = (int) date('Y') - $birthYear - ($birthMD > (int) date('md') ? 1 : 0);
if ($age < 18) {
    http_response_code(400);
    echo json_encode(["message" => "Rider must be at least 18 years old."]);
    exit;
}

// File validation
if (!isset($files['driver_license']) || $files['driver_license']['error'] !== UPLOAD_ERR_OK) {
    http_response_code(400);
    echo json_encode(["message" => "Driver's license image is required."]);
    exit;
}
if (!isset($files['motorcycle_registration']) || $files['motorcycle_registration']['error'] !== UPLOAD_ERR_OK) {
    http_response_code(400);
    echo json_encode(["message" => "Motorcycle registration image is required."]);
    exit;
}

// ── File save helper ──────────────────────────────────────────────────────────
function saveRiderFile(array $fileInfo, string $subfolder): ?string {
    $ext     = strtolower(pathinfo($fileInfo['name'], PATHINFO_EXTENSION));
    $allowed = ['jpg', 'jpeg', 'png', 'webp', 'pdf'];
    if (!in_array($ext, $allowed)) return null;

    $uploadDir = __DIR__ . '/../../uploads/' . $subfolder . '/';
    if (!is_dir($uploadDir)) mkdir($uploadDir, 0755, true);

    $filename = uniqid('', true) . '_' . time() . '.' . $ext;
    $dest     = $uploadDir . $filename;

    // tmp_name may be a real temp file or a manually created one
    if (is_uploaded_file($fileInfo['tmp_name'])) {
        $ok = move_uploaded_file($fileInfo['tmp_name'], $dest);
    } else {
        // Manually parsed temp file
        $ok = rename($fileInfo['tmp_name'], $dest);
    }
    return $ok ? ('/uploads/' . $subfolder . '/' . $filename) : null;
}

// ── Auto-create tables if migration hasn't been run ───────────────────────────
$tablesSql = [
    "CREATE TABLE IF NOT EXISTS rider_profiles (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL UNIQUE,
        birthdate DATE NOT NULL,
        sex ENUM('male','female','other') NOT NULL,
        driver_license_image VARCHAR(500) NOT NULL,
        motorcycle_registration_image VARCHAR(500) NOT NULL,
        approval_status ENUM('pending','approved','rejected') DEFAULT 'pending',
        approved_at TIMESTAMP NULL,
        approved_by INT NULL,
        rejection_reason TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )",
    "CREATE TABLE IF NOT EXISTS email_verification_tokens (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        token VARCHAR(64) NOT NULL UNIQUE,
        expires_at TIMESTAMP NOT NULL,
        used_at TIMESTAMP NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        INDEX idx_token_evt (token),
        INDEX idx_user_evt (user_id)
    )",
    "ALTER TABLE users MODIFY COLUMN role ENUM('buyer','seller','admin','rider') NOT NULL DEFAULT 'buyer'",
];
foreach ($tablesSql as $sql) {
    try { $db->exec($sql); } catch (Exception $e) { /* already exists */ }
}

// ── Transaction ───────────────────────────────────────────────────────────────
try {
    $db->beginTransaction();

    $hash = password_hash($data->password, PASSWORD_BCRYPT);
    $stmt = $db->prepare("INSERT INTO users (full_name, email, password, contact_number, role) VALUES (?, ?, ?, ?, 'rider')");
    $stmt->execute([$data->full_name, $data->email, $hash, $data->contact_number]);
    $userId = $db->lastInsertId();

    $licenseImage = saveRiderFile($files['driver_license'], 'rider_licenses');
    $regImage     = saveRiderFile($files['motorcycle_registration'], 'rider_registrations');

    if (!$licenseImage || !$regImage) {
        $db->rollBack();
        http_response_code(422);
        echo json_encode(["message" => "Failed to save uploaded files. Allowed types: jpg, jpeg, png, webp, pdf."]);
        exit;
    }

    $stmt = $db->prepare("
        INSERT INTO rider_profiles (user_id, birthdate, sex, driver_license_image, motorcycle_registration_image)
        VALUES (?, ?, ?, ?, ?)
    ");
    $stmt->execute([
        $userId,
        date('Y-m-d', $birthdateTs),
        $data->sex,
        $licenseImage,
        $regImage,
    ]);

    $token   = bin2hex(random_bytes(32));
    $expires = date('Y-m-d H:i:s', strtotime('+24 hours'));
    $stmt    = $db->prepare("INSERT INTO email_verification_tokens (user_id, token, expires_at) VALUES (?, ?, ?)");
    $stmt->execute([$userId, $token, $expires]);

    $db->commit();

    // Send verification email — non-fatal
    try {
        require_once '../config/mailer.php';
        Mailer::sendVerification($data->email, $data->full_name, $token);
    } catch (Throwable $mailErr) {
        error_log('Rider registration mailer error: ' . $mailErr->getMessage());
    }

    http_response_code(201);
    echo json_encode([
        "message" => "Registration successful. Please check your email to verify your account.",
        "user_id" => $userId,
    ]);

} catch (Exception $e) {
    if ($db->inTransaction()) $db->rollBack();
    http_response_code(500);
    echo json_encode([
        "message" => "Registration failed. Please try again.",
        "debug"   => $e->getMessage(),
    ]);
}
