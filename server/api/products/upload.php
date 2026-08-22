<?php
require_once '../config/cors.php';
require_once '../config/database.php';
require_once '../middleware/auth.php';

$database = new Database();
$db = $database->getConnection();
$auth = new AuthMiddleware($db);
$payload = $auth->requireRole(['seller']);

if (!isset($_FILES['image'])) {
    http_response_code(400);
    echo json_encode(["message" => "No image uploaded."]);
    exit;
}

$file = $_FILES['image'];
$allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
$maxSize = 5 * 1024 * 1024; // 5MB

if (!in_array($file['type'], $allowedTypes)) {
    http_response_code(400);
    echo json_encode(["message" => "Invalid file type. Allowed: JPG, PNG, WebP, GIF."]);
    exit;
}

if ($file['size'] > $maxSize) {
    http_response_code(400);
    echo json_encode(["message" => "File too large. Maximum size is 5MB."]);
    exit;
}

$uploadDir = '../../uploads/products/';
if (!is_dir($uploadDir)) {
    mkdir($uploadDir, 0777, true);
}

$extension = pathinfo($file['name'], PATHINFO_EXTENSION);
$filename = uniqid('product_') . '_' . time() . '.' . $extension;
$filepath = $uploadDir . $filename;

if (move_uploaded_file($file['tmp_name'], $filepath)) {
    $url = '/uploads/products/' . $filename;
    echo json_encode([
        "message" => "Image uploaded successfully.",
        "url" => $url,
        "filename" => $filename
    ]);
} else {
    http_response_code(500);
    echo json_encode(["message" => "Failed to upload image."]);
}
