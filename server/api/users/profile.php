<?php
require_once '../config/cors.php';
require_once '../config/database.php';
require_once '../middleware/auth.php';

$database = new Database();
$db = $database->getConnection();
$auth = new AuthMiddleware($db);
$payload = $auth->requireAuth();

$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'GET') {
    $stmt = $db->prepare("SELECT id, email, full_name, role, status, profile_image, contact_number, created_at FROM users WHERE id = ?");
    $stmt->execute([$payload['user_id']]);
    $user = $stmt->fetch(PDO::FETCH_ASSOC);

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

} elseif ($method === 'PUT' || $method === 'POST') {
    $data = json_decode(file_get_contents("php://input"));
    $action = isset($data->action) ? $data->action : 'update';

    if ($action === 'update_photo') {
        if (empty($data->image)) {
            http_response_code(400);
            echo json_encode(["message" => "Image data is required."]);
            exit;
        }

        $imageData = $data->image;
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

        $uploadDir = '../../uploads/profiles/';
        if (!is_dir($uploadDir)) { mkdir($uploadDir, 0777, true); }

        $filename = 'profile_' . $payload['user_id'] . '_' . time() . '.' . $extension;
        $filepath = $uploadDir . $filename;

        if (file_put_contents($filepath, $imageData)) {
            $imageUrl = '/uploads/profiles/' . $filename;
            $stmt = $db->prepare("UPDATE users SET profile_image = ? WHERE id = ?");
            $stmt->execute([$imageUrl, $payload['user_id']]);
            echo json_encode(["message" => "Photo updated.", "image_url" => $imageUrl, "profile_image" => $imageUrl]);
        } else {
            http_response_code(500);
            echo json_encode(["message" => "Failed to save image."]);
        }
        exit;
    }

    if ($action === 'change_password') {
        if (empty($data->current_password)) {
            http_response_code(400);
            echo json_encode(["message" => "Current password is required."]);
            exit;
        }
        if (empty($data->new_password) || strlen($data->new_password) < 6) {
            http_response_code(400);
            echo json_encode(["message" => "New password must be at least 6 characters."]);
            exit;
        }

        $stmt = $db->prepare("SELECT password FROM users WHERE id = ?");
        $stmt->execute([$payload['user_id']]);
        $user = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!password_verify($data->current_password, $user['password'])) {
            http_response_code(400);
            echo json_encode(["message" => "Current password is incorrect."]);
            exit;
        }

        $hashed = password_hash($data->new_password, PASSWORD_BCRYPT);
        $stmt = $db->prepare("UPDATE users SET password = ? WHERE id = ?");
        $stmt->execute([$hashed, $payload['user_id']]);
        echo json_encode(["message" => "Password changed successfully."]);
        exit;
    }

    // Default: update_profile or legacy PUT behavior
    $fields = [];
    $params = [];

    if (isset($data->full_name)) { $fields[] = "full_name = ?"; $params[] = $data->full_name; }
    if (isset($data->contact_number)) { $fields[] = "contact_number = ?"; $params[] = $data->contact_number; }
    if (isset($data->profile_image)) { $fields[] = "profile_image = ?"; $params[] = $data->profile_image; }

    if (!empty($fields)) {
        $params[] = $payload['user_id'];
        $stmt = $db->prepare("UPDATE users SET " . implode(', ', $fields) . " WHERE id = ?");
        $stmt->execute($params);
    }

    // Legacy password update (PUT method without action)
    if (!empty($data->new_password) && $action === 'update') {
        if (empty($data->current_password)) {
            http_response_code(400);
            echo json_encode(["message" => "Current password is required."]);
            exit;
        }

        $stmt = $db->prepare("SELECT password FROM users WHERE id = ?");
        $stmt->execute([$payload['user_id']]);
        $user = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!password_verify($data->current_password, $user['password'])) {
            http_response_code(400);
            echo json_encode(["message" => "Current password is incorrect."]);
            exit;
        }

        $hashed = password_hash($data->new_password, PASSWORD_BCRYPT);
        $stmt = $db->prepare("UPDATE users SET password = ? WHERE id = ?");
        $stmt->execute([$hashed, $payload['user_id']]);
    }

    echo json_encode(["message" => "Profile updated successfully."]);
}
