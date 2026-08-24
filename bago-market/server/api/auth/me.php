<?php
require_once '../config/cors.php';
require_once '../config/database.php';
require_once '../middleware/auth.php';

$database = new Database();
$db = $database->getConnection();
$auth = new AuthMiddleware($db);
$payload = $auth->requireAuth();

$stmt = $db->prepare("SELECT id, email, full_name, role, status, profile_image, contact_number, created_at FROM users WHERE id = ? AND deleted_at IS NULL");
$stmt->execute([$payload['user_id']]);

if ($stmt->rowCount() === 0) {
    http_response_code(404);
    echo json_encode(["message" => "User not found."]);
    exit;
}

$user = $stmt->fetch(PDO::FETCH_ASSOC);

// Get role-specific profile
if ($user['role'] === 'buyer') {
    $stmt = $db->prepare("SELECT bp.*, b.name as barangay_name FROM buyer_profiles bp LEFT JOIN barangays b ON bp.barangay_id = b.id WHERE bp.user_id = ?");
    $stmt->execute([$user['id']]);
    $user['profile'] = $stmt->fetch(PDO::FETCH_ASSOC);
} elseif ($user['role'] === 'seller') {
    $stmt = $db->prepare("SELECT sp.*, b.name as barangay_name FROM seller_profiles sp LEFT JOIN barangays b ON sp.barangay_id = b.id WHERE sp.user_id = ?");
    $stmt->execute([$user['id']]);
    $user['profile'] = $stmt->fetch(PDO::FETCH_ASSOC);
}

echo json_encode(["user" => $user]);
