<?php
/**
 * Seller Store Settings API
 *
 * GET  — return full seller profile + user info + barangays list
 * POST — update any combination of:
 *        action=profile       personal info (full_name, contact_number)
 *        action=store         store info  (store_name, store_description, barangay_id)
 *        action=profile_photo upload profile photo (base64)
 *        action=store_banner  upload store banner  (base64)
 *        action=store_logo    upload store logo    (base64)
 *        action=password      change password (current_password, new_password)
 */

require_once '../config/cors.php';
require_once '../config/database.php';
require_once '../middleware/auth.php';
require_once '../config/logger.php';

$database = new Database();
$db       = $database->getConnection();
$auth     = new AuthMiddleware($db);
$payload  = $auth->requireRole(['seller']);

$sellerId = (int)$payload['user_id'];
$method   = $_SERVER['REQUEST_METHOD'];

// ── ensure store_logo / store_banner columns exist ────────────────────────
foreach ([
    "ALTER TABLE seller_profiles ADD COLUMN IF NOT EXISTS store_logo   VARCHAR(500) NULL",
    "ALTER TABLE seller_profiles ADD COLUMN IF NOT EXISTS store_banner VARCHAR(500) NULL",
    "ALTER TABLE seller_profiles ADD COLUMN IF NOT EXISTS store_phone  VARCHAR(50)  NULL",
    "ALTER TABLE seller_profiles ADD COLUMN IF NOT EXISTS store_email  VARCHAR(255) NULL",
    "ALTER TABLE seller_profiles ADD COLUMN IF NOT EXISTS store_address TEXT         NULL",
    "ALTER TABLE seller_profiles ADD COLUMN IF NOT EXISTS facebook_url VARCHAR(500) NULL",
    "ALTER TABLE seller_profiles ADD COLUMN IF NOT EXISTS instagram_url VARCHAR(500) NULL",
] as $ddl) {
    try { $db->exec($ddl); } catch (Exception $e) {}
}

// ── helper: save base64 image ─────────────────────────────────────────────
function saveImage($base64, $subdir, $prefix = '') {
    if (empty($base64) || strpos($base64, 'data:') !== 0) return null;
    [$meta, $raw] = explode(',', $base64, 2);
    $mime  = explode(';', explode(':', $meta)[1])[0];
    $extMap = ['image/jpeg' => 'jpg', 'image/png' => 'png', 'image/webp' => 'webp'];
    $ext   = $extMap[$mime] ?? 'jpg';
    $dir   = __DIR__ . '/../../uploads/' . $subdir . '/';
    if (!is_dir($dir)) mkdir($dir, 0755, true);
    $fn = ($prefix ? $prefix . '_' : '') . uniqid('', true) . '.' . $ext;
    file_put_contents($dir . $fn, base64_decode($raw));
    return '/uploads/' . $subdir . '/' . $fn;
}

// =============================================================================
// GET — load current settings
// =============================================================================
if ($method === 'GET') {
    $uStmt = $db->prepare(
        "SELECT u.id, u.full_name, u.email, u.contact_number, u.profile_image, u.status,
                sp.store_name, sp.store_description, sp.store_logo, sp.store_banner,
                sp.store_phone, sp.store_email, sp.store_address,
                sp.facebook_url, sp.instagram_url,
                sp.approval_status, sp.rating, sp.total_sales, sp.total_orders,
                sp.barangay_id,
                b.name AS barangay_name
         FROM users u
         JOIN seller_profiles sp ON sp.user_id = u.id
         LEFT JOIN barangays b   ON b.id = sp.barangay_id
         WHERE u.id = ?"
    );
    $uStmt->execute([$sellerId]);
    $seller = $uStmt->fetch(PDO::FETCH_ASSOC);

    // Barangay list
    $bStmt = $db->query("SELECT id, name FROM barangays ORDER BY name ASC");
    $barangays = $bStmt->fetchAll(PDO::FETCH_ASSOC);

    echo json_encode(['seller' => $seller, 'barangays' => $barangays]);
    exit;
}

// =============================================================================
// POST — update settings
// =============================================================================
if ($method === 'POST') {
    $data   = json_decode(file_get_contents('php://input'), true);
    $action = $data['action'] ?? 'profile';

    // ── Personal profile ───────────────────────────────────────────────────
    if ($action === 'profile') {
        $fields = []; $params = [];
        if (!empty($data['full_name']))      { $fields[] = 'full_name = ?';      $params[] = trim($data['full_name']); }
        if (!empty($data['contact_number'])) { $fields[] = 'contact_number = ?'; $params[] = trim($data['contact_number']); }

        if (empty($fields)) {
            http_response_code(400);
            echo json_encode(['message' => 'Nothing to update.']);
            exit;
        }
        $params[] = $sellerId;
        $db->prepare("UPDATE users SET " . implode(', ', $fields) . " WHERE id = ?")->execute($params);
        log_activity($db, $sellerId, 'update_profile', 'user', $sellerId, "Seller updated personal info");
        echo json_encode(['message' => 'Personal info updated.']);
        exit;
    }

    // ── Store info ─────────────────────────────────────────────────────────
    if ($action === 'store') {
        $fields = []; $params = [];
        $map = [
            'store_name'        => 'store_name = ?',
            'store_description' => 'store_description = ?',
            'store_phone'       => 'store_phone = ?',
            'store_email'       => 'store_email = ?',
            'store_address'     => 'store_address = ?',
            'facebook_url'      => 'facebook_url = ?',
            'instagram_url'     => 'instagram_url = ?',
        ];
        foreach ($map as $key => $expr) {
            if (isset($data[$key])) { $fields[] = $expr; $params[] = $data[$key]; }
        }
        if (isset($data['barangay_id']) && $data['barangay_id']) {
            $fields[] = 'barangay_id = ?';
            $params[] = (int)$data['barangay_id'];
        }
        if (empty($fields)) {
            http_response_code(400);
            echo json_encode(['message' => 'Nothing to update.']);
            exit;
        }
        $params[] = $sellerId;
        $db->prepare("UPDATE seller_profiles SET " . implode(', ', $fields) . " WHERE user_id = ?")->execute($params);
        log_activity($db, $sellerId, 'update_store_info', 'seller', $sellerId, "Seller updated store info");
        echo json_encode(['message' => 'Store info updated.']);
        exit;
    }

    // ── Profile photo ──────────────────────────────────────────────────────
    if ($action === 'profile_photo') {
        if (empty($data['image'])) { http_response_code(400); echo json_encode(['message' => 'Image required.']); exit; }
        $path = saveImage($data['image'], 'profiles', 'user_' . $sellerId);
        if (!$path) { http_response_code(400); echo json_encode(['message' => 'Invalid image.']); exit; }
        $db->prepare("UPDATE users SET profile_image = ? WHERE id = ?")->execute([$path, $sellerId]);
        log_activity($db, $sellerId, 'update_profile_photo', 'user', $sellerId, "Seller updated profile photo");
        echo json_encode(['message' => 'Profile photo updated.', 'url' => $path]);
        exit;
    }

    // ── Store logo ─────────────────────────────────────────────────────────
    if ($action === 'store_logo') {
        if (empty($data['image'])) { http_response_code(400); echo json_encode(['message' => 'Image required.']); exit; }
        $path = saveImage($data['image'], 'store_logos', 'logo_' . $sellerId);
        if (!$path) { http_response_code(400); echo json_encode(['message' => 'Invalid image.']); exit; }
        $db->prepare("UPDATE seller_profiles SET store_logo = ? WHERE user_id = ?")->execute([$path, $sellerId]);
        echo json_encode(['message' => 'Store logo updated.', 'url' => $path]);
        exit;
    }

    // ── Store banner ───────────────────────────────────────────────────────
    if ($action === 'store_banner') {
        if (empty($data['image'])) { http_response_code(400); echo json_encode(['message' => 'Image required.']); exit; }
        $path = saveImage($data['image'], 'store_banners', 'banner_' . $sellerId);
        if (!$path) { http_response_code(400); echo json_encode(['message' => 'Invalid image.']); exit; }
        $db->prepare("UPDATE seller_profiles SET store_banner = ? WHERE user_id = ?")->execute([$path, $sellerId]);
        echo json_encode(['message' => 'Store banner updated.', 'url' => $path]);
        exit;
    }

    // ── Change password ────────────────────────────────────────────────────
    if ($action === 'password') {
        if (empty($data['current_password']) || empty($data['new_password'])) {
            http_response_code(400);
            echo json_encode(['message' => 'Both current and new passwords are required.']);
            exit;
        }
        if (strlen($data['new_password']) < 6) {
            http_response_code(400);
            echo json_encode(['message' => 'New password must be at least 6 characters.']);
            exit;
        }
        $stmt = $db->prepare("SELECT password FROM users WHERE id = ?");
        $stmt->execute([$sellerId]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);
        if (!$row || !password_verify($data['current_password'], $row['password'])) {
            http_response_code(400);
            echo json_encode(['message' => 'Current password is incorrect.']);
            exit;
        }
        $db->prepare("UPDATE users SET password = ? WHERE id = ?")
           ->execute([password_hash($data['new_password'], PASSWORD_BCRYPT), $sellerId]);
        echo json_encode(['message' => 'Password changed successfully.']);
        exit;
    }

    http_response_code(400);
    echo json_encode(['message' => 'Unknown action.']);
    exit;
}

http_response_code(405);
echo json_encode(['message' => 'Method not allowed.']);
