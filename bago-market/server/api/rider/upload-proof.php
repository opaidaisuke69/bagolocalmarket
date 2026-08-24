<?php
require_once '../config/cors.php';
require_once '../config/database.php';
require_once '../middleware/auth.php';

$database = new Database();
$db = $database->getConnection();
$auth = new AuthMiddleware($db);
$payload = $auth->requireAuth();

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(["message" => "Method not allowed."]);
    exit;
}

// Handle base64 image upload
$data = json_decode(file_get_contents("php://input"));

if (empty($data->image)) {
    http_response_code(400);
    echo json_encode(["message" => "Image data is required."]);
    exit;
}

$imageData = $data->image;
$type = isset($data->type) ? $data->type : 'proof';

// Decode base64
if (preg_match('/^data:image\/(\w+);base64,/', $imageData, $matches)) {
    $extension = $matches[1];
    $imageData = substr($imageData, strpos($imageData, ',') + 1);
} else {
    $extension = 'jpg';
}

$imageData = base64_decode($imageData);
if ($imageData === false) {
    http_response_code(400);
    echo json_encode(["message" => "Invalid image data."]);
    exit;
}

// Save file
$uploadDir = $_SERVER['DOCUMENT_ROOT'] . '/server/uploads/proofs/';
if (!is_dir($uploadDir)) {
    mkdir($uploadDir, 0755, true);
}

$filename = $type . '_' . uniqid() . '_' . time() . '.' . $extension;
$filepath = $uploadDir . $filename;

if (file_put_contents($filepath, $imageData)) {
    $imageUrl = '/uploads/proofs/' . $filename;
    echo json_encode([
        "message" => "Image uploaded successfully.",
        "image_url" => $imageUrl
    ]);
} else {
    http_response_code(500);
    echo json_encode(["message" => "Failed to save image."]);
}
