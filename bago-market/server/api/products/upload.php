<?php
error_reporting(E_ALL);
ini_set('display_errors', 0);
ini_set('log_errors', 1);

require_once '../config/cors.php';
require_once '../config/database.php';
require_once '../middleware/auth.php';

$database = new Database();
$db       = $database->getConnection();
$auth     = new AuthMiddleware($db);
$payload  = $auth->requireRole(['seller']);

// ── 1. Check file was sent ────────────────────────────────────────────────────
if (empty($_FILES['image'])) {
    http_response_code(400);
    echo json_encode(["message" => "No image file received."]);
    exit;
}

$file = $_FILES['image'];

// ── 2. Check PHP upload error FIRST (before touching tmp_name) ────────────────
if ($file['error'] !== UPLOAD_ERR_OK) {
    http_response_code(400);
    $uploadErrors = [
        UPLOAD_ERR_INI_SIZE   => 'File exceeds the server upload limit (upload_max_filesize in php.ini).',
        UPLOAD_ERR_FORM_SIZE  => 'File exceeds the form MAX_FILE_SIZE.',
        UPLOAD_ERR_PARTIAL    => 'File was only partially uploaded.',
        UPLOAD_ERR_NO_FILE    => 'No file was uploaded.',
        UPLOAD_ERR_NO_TMP_DIR => 'Server missing temporary folder.',
        UPLOAD_ERR_CANT_WRITE => 'Server failed to write file to disk.',
        UPLOAD_ERR_EXTENSION  => 'A PHP extension stopped the upload.',
    ];
    $msg = isset($uploadErrors[$file['error']]) ? $uploadErrors[$file['error']] : 'Unknown upload error (code ' . $file['error'] . ').';
    echo json_encode(["message" => $msg]);
    exit;
}

// ── 3. Size check ─────────────────────────────────────────────────────────────
$maxSize = 5 * 1024 * 1024; // 5MB
if ($file['size'] > $maxSize) {
    http_response_code(400);
    echo json_encode(["message" => "File too large. Maximum size is 5MB."]);
    exit;
}

// ── 4. MIME type detection — finfo preferred, browser type as fallback ────────
$allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

$mimeType = null;

// Try finfo first (most reliable)
if (function_exists('finfo_open')) {
    $finfo    = finfo_open(FILEINFO_MIME_TYPE);
    $detected = finfo_file($finfo, $file['tmp_name']);
    finfo_close($finfo);
    if ($detected && in_array($detected, $allowedTypes)) {
        $mimeType = $detected;
    }
}

// Fallback: use browser-reported type (acceptable since we also validate extension)
if ($mimeType === null) {
    $browserType = strtolower(trim($file['type']));
    // Normalise: some browsers send image/jpg instead of image/jpeg
    if ($browserType === 'image/jpg') $browserType = 'image/jpeg';
    if (in_array($browserType, $allowedTypes)) {
        $mimeType = $browserType;
    }
}

// Last resort: derive from file extension
if ($mimeType === null) {
    $ext = strtolower(pathinfo($file['name'], PATHINFO_EXTENSION));
    $extToMime = ['jpg' => 'image/jpeg', 'jpeg' => 'image/jpeg', 'png' => 'image/png', 'webp' => 'image/webp', 'gif' => 'image/gif'];
    if (isset($extToMime[$ext])) {
        $mimeType = $extToMime[$ext];
    }
}

if ($mimeType === null) {
    http_response_code(400);
    echo json_encode(["message" => "Unsupported file type. Please upload a JPG, PNG, WebP, or GIF image."]);
    exit;
}

// ── 5. Build upload directory using __DIR__ (not DOCUMENT_ROOT) ──────────────
// __DIR__ = .../server/api/products → up 2 levels → .../server/
$uploadDir = realpath(__DIR__ . '/../../') . DIRECTORY_SEPARATOR . 'uploads' . DIRECTORY_SEPARATOR . 'products' . DIRECTORY_SEPARATOR;

if (!is_dir($uploadDir)) {
    if (!mkdir($uploadDir, 0755, true)) {
        http_response_code(500);
        echo json_encode(["message" => "Server could not create the upload directory."]);
        exit;
    }
}

// ── 6. Generate filename and move ─────────────────────────────────────────────
$extMap    = ['image/jpeg' => 'jpg', 'image/png' => 'png', 'image/webp' => 'webp', 'image/gif' => 'gif'];
$extension = $extMap[$mimeType];
$filename  = 'product_' . uniqid('', true) . '_' . time() . '.' . $extension;
$filepath  = $uploadDir . $filename;

if (move_uploaded_file($file['tmp_name'], $filepath)) {
    echo json_encode([
        "message"  => "Image uploaded successfully.",
        "url"      => '/uploads/products/' . $filename,
        "filename" => $filename,
    ]);
} else {
    http_response_code(500);
    echo json_encode([
        "message"      => "Failed to save uploaded file. Check server permissions.",
        "upload_dir"   => $uploadDir,
        "dir_exists"   => is_dir($uploadDir),
        "dir_writable" => is_writable($uploadDir),
    ]);
}
