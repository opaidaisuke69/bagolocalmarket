<?php
require_once '../config/cors.php';
require_once '../config/database.php';

// cors.php already sets Content-Type: application/json

$database = new Database();
$db = $database->getConnection();

// ── Shared multipart parser (works around Apache rewrite stripping $_FILES) ───
function parseMultipartRequest(): array {
    $ct = $_SERVER['CONTENT_TYPE'] ?? '';
    if (strpos($ct, 'multipart/form-data') === false) {
        // JSON body
        return ['post' => (array) json_decode(file_get_contents('php://input'), true), 'files' => []];
    }

    if (!preg_match('/boundary=(.+)$/', $ct, $m)) {
        return ['post' => $_POST, 'files' => $_FILES];
    }
    $boundary = $m[1];
    $raw = file_get_contents('php://input');

    if (empty($raw)) {
        // Apache parsed it normally
        return ['post' => $_POST, 'files' => $_FILES];
    }

    $post  = [];
    $files = [];
    $parts = preg_split('/--' . preg_quote($boundary, '/') . '(?:--)?/', $raw);

    foreach ($parts as $part) {
        $part = ltrim($part, "\r\n");
        if (empty($part)) continue;

        $pos = strpos($part, "\r\n\r\n");
        if ($pos === false) continue;

        $headers_raw = substr($part, 0, $pos);
        $body        = substr($part, $pos + 4);
        $body        = rtrim($body, "\r\n");

        if (!preg_match('/Content-Disposition:\s*form-data;(.+)/i', $headers_raw, $dMatch)) continue;
        $disp = $dMatch[1];

        preg_match('/\bname="([^"]+)"/', $disp, $nameMatch);
        $name = $nameMatch[1] ?? null;
        if (!$name) continue;

        if (preg_match('/\bfilename="([^"]*)"/', $disp, $fnMatch)) {
            $filename = $fnMatch[1];
            $mime     = 'application/octet-stream';
            if (preg_match('/Content-Type:\s*([^\r\n]+)/i', $headers_raw, $ctm)) {
                $mime = trim($ctm[1]);
            }
            $tmp = tempnam(sys_get_temp_dir(), 'reg_');
            file_put_contents($tmp, $body);

            // Handle array fields like sample_products[]
            if (substr($name, -2) === '[]') {
                $key = substr($name, 0, -2);
                if (!isset($files[$key])) {
                    $files[$key] = ['name' => [], 'type' => [], 'tmp_name' => [], 'error' => [], 'size' => []];
                }
                $files[$key]['name'][]     = $filename;
                $files[$key]['type'][]     = $mime;
                $files[$key]['tmp_name'][] = $tmp;
                $files[$key]['error'][]    = UPLOAD_ERR_OK;
                $files[$key]['size'][]     = strlen($body);
            } else {
                $files[$name] = [
                    'name'     => $filename,
                    'type'     => $mime,
                    'tmp_name' => $tmp,
                    'error'    => UPLOAD_ERR_OK,
                    'size'     => strlen($body),
                ];
            }
        } else {
            // Handle array fields like field_name[] as post values
            if (substr($name, -2) === '[]') {
                $key = substr($name, 0, -2);
                if (!isset($post[$key])) $post[$key] = [];
                $post[$key][] = $body;
            } else {
                $post[$name] = $body;
            }
        }
    }

    return [
        'post'  => array_merge($post,  $_POST),
        'files' => array_merge($files, $_FILES),
    ];
}

$parsed   = parseMultipartRequest();
$postData = $parsed['post'];
$files    = $parsed['files'];
$data     = (object) $postData;

// ── Basic validation ──────────────────────────────────────────────────────────
if (empty($data->full_name) || empty($data->email) || empty($data->password) || empty($data->contact_number)) {
    http_response_code(400);
    echo json_encode(["message" => "Full name, email, contact number and password are required."]);
    exit;
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

$role = !empty($data->role) ? $data->role : 'buyer';

// ── Seller-specific validation ────────────────────────────────────────────────
if ($role === 'seller') {
    if (empty($data->store_name)) {
        http_response_code(400);
        echo json_encode(["message" => "Store name is required."]);
        exit;
    }
    if (empty($data->valid_id_type)) {
        http_response_code(400);
        echo json_encode(["message" => "Valid ID type is required."]);
        exit;
    }
    if (!isset($files['valid_id_image']) || $files['valid_id_image']['error'] !== UPLOAD_ERR_OK) {
        http_response_code(400);
        echo json_encode(["message" => "Valid ID image is required."]);
        exit;
    }
    $sampleCount = 0;
    if (isset($files['sample_products']) && is_array($files['sample_products']['name'])) {
        foreach ($files['sample_products']['error'] as $err) {
            if ($err === UPLOAD_ERR_OK) $sampleCount++;
        }
    }
    if ($sampleCount < 5) {
        http_response_code(400);
        echo json_encode(["message" => "Please upload at least 5 sample product images."]);
        exit;
    }
}

// ── File save helper ──────────────────────────────────────────────────────────
function saveFile(array $fileInfo, string $subfolder): ?string {
    if ($fileInfo['error'] !== UPLOAD_ERR_OK) return null;
    $ext     = strtolower(pathinfo($fileInfo['name'], PATHINFO_EXTENSION));
    $allowed = ['jpg', 'jpeg', 'png', 'webp', 'gif'];
    if (!in_array($ext, $allowed)) return null;

    $dir = __DIR__ . '/../../uploads/' . $subfolder . '/';
    if (!is_dir($dir)) mkdir($dir, 0755, true);

    $dest = $dir . uniqid('', true) . '_' . time() . '.' . $ext;
    $ok   = is_uploaded_file($fileInfo['tmp_name'])
        ? move_uploaded_file($fileInfo['tmp_name'], $dest)
        : rename($fileInfo['tmp_name'], $dest);

    return $ok ? ('/uploads/' . $subfolder . '/' . basename($dest)) : null;
}

// ── Ensure required tables exist (auto-migrate) ───────────────────────────────
$autoMigrate = [
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
    "CREATE TABLE IF NOT EXISTS seller_sample_products (
        id INT AUTO_INCREMENT PRIMARY KEY,
        seller_id INT NOT NULL,
        image_path VARCHAR(500) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (seller_id) REFERENCES seller_profiles(id) ON DELETE CASCADE,
        INDEX idx_seller_sp (seller_id)
    )",
];
foreach ($autoMigrate as $sql) {
    try { $db->exec($sql); } catch (Exception $e) { /* already exists */ }
}
// Add new columns to seller_profiles if missing
foreach ([
    "ALTER TABLE seller_profiles ADD COLUMN IF NOT EXISTS valid_id_type VARCHAR(50) NULL AFTER verification_document",
    "ALTER TABLE seller_profiles ADD COLUMN IF NOT EXISTS valid_id_image VARCHAR(500) NULL AFTER valid_id_type",
    "ALTER TABLE seller_profiles ADD COLUMN IF NOT EXISTS latitude  DECIMAL(10,8) NULL",
    "ALTER TABLE seller_profiles ADD COLUMN IF NOT EXISTS longitude DECIMAL(11,8) NULL",
    "ALTER TABLE addresses ADD COLUMN IF NOT EXISTS latitude  DECIMAL(10,8) NULL",
    "ALTER TABLE addresses ADD COLUMN IF NOT EXISTS longitude DECIMAL(11,8) NULL",
] as $col) {
    try { $db->exec($col); } catch (Exception $e) { /* already exists */ }
}

// ── Transaction ───────────────────────────────────────────────────────────────
try {
    $db->beginTransaction();

    $hash = password_hash($data->password, PASSWORD_BCRYPT);
    $stmt = $db->prepare("INSERT INTO users (full_name, email, password, contact_number, role) VALUES (?, ?, ?, ?, ?)");
    $stmt->execute([$data->full_name, $data->email, $hash, $data->contact_number, $role]);
    $userId = $db->lastInsertId();

    if ($role === 'buyer') {
        $stmt = $db->prepare("INSERT INTO buyer_profiles (user_id, barangay_id, complete_address) VALUES (?, ?, ?)");
        $stmt->execute([$userId, !empty($data->barangay_id) ? $data->barangay_id : null, $data->complete_address ?? '']);
        $stmt = $db->prepare("INSERT INTO carts (user_id) VALUES (?)");
        $stmt->execute([$userId]);
    }

    if ($role === 'seller') {
        $validIdImage = saveFile($files['valid_id_image'], 'seller_ids');

        $stmt = $db->prepare("
            INSERT INTO seller_profiles
                (user_id, store_name, store_description, barangay_id, complete_address, valid_id_type, valid_id_image, latitude, longitude)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        ");
        $stmt->execute([
            $userId,
            $data->store_name,
            $data->store_description ?? '',
            !empty($data->barangay_id) ? $data->barangay_id : null,
            $data->complete_address ?? '',
            $data->valid_id_type,
            $validIdImage,
            !empty($data->latitude)  ? (float)$data->latitude  : null,
            !empty($data->longitude) ? (float)$data->longitude : null,
        ]);
        $sellerProfileId = $db->lastInsertId();

        // Save sample product images (array field)
        if (isset($files['sample_products']) && is_array($files['sample_products']['name'])) {
            $names  = $files['sample_products']['name'];
            $tmps   = $files['sample_products']['tmp_name'];
            $errors = $files['sample_products']['error'];

            $dir = __DIR__ . '/../../uploads/sample_products/';
            if (!is_dir($dir)) mkdir($dir, 0755, true);

            for ($i = 0; $i < count($names); $i++) {
                if ($errors[$i] !== UPLOAD_ERR_OK) continue;
                $ext = strtolower(pathinfo($names[$i], PATHINFO_EXTENSION));
                if (!in_array($ext, ['jpg','jpeg','png','webp','gif'])) continue;

                $dest = $dir . uniqid('', true) . '_' . time() . '_' . $i . '.' . $ext;
                $ok   = is_uploaded_file($tmps[$i])
                    ? move_uploaded_file($tmps[$i], $dest)
                    : rename($tmps[$i], $dest);

                if ($ok) {
                    $sp = $db->prepare("INSERT INTO seller_sample_products (seller_id, image_path) VALUES (?, ?)");
                    $sp->execute([$sellerProfileId, '/uploads/sample_products/' . basename($dest)]);
                }
            }
        }
    }

    // Email verification token
    $token   = bin2hex(random_bytes(32));
    $expires = date('Y-m-d H:i:s', strtotime('+24 hours'));
    $stmt    = $db->prepare("INSERT INTO email_verification_tokens (user_id, token, expires_at) VALUES (?, ?, ?)");
    $stmt->execute([$userId, $token, $expires]);

    $db->commit();

    // Send email — non-fatal
    try {
        require_once '../config/mailer.php';
        Mailer::sendVerification($data->email, $data->full_name, $token);
    } catch (Throwable $mailErr) {
        error_log('Registration mailer error: ' . $mailErr->getMessage());
    }

    http_response_code(201);
    echo json_encode([
        "message" => "Registration successful. Please check your email to verify your account.",
        "user_id" => $userId,
    ]);

} catch (Exception $e) {
    if ($db->inTransaction()) $db->rollBack();
    http_response_code(500);
    echo json_encode(["message" => "Registration failed. Please try again.", "debug" => $e->getMessage()]);
}
