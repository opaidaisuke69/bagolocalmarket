<?php
/**
 * Admin Platform Settings API
 *
 * GET  — return all settings as key-value map
 * PUT  — save/update settings (partial update supported)
 */

require_once '../config/cors.php';
require_once '../config/database.php';
require_once '../middleware/auth.php';

$database = new Database();
$db       = $database->getConnection();
$auth     = new AuthMiddleware($db);
$payload  = $auth->requireRole(['admin']);

// ── Auto-create platform_settings table ──────────────────────────────────────
try {
    $db->exec(
        "CREATE TABLE IF NOT EXISTS platform_settings (
            id          INT AUTO_INCREMENT PRIMARY KEY,
            `key`       VARCHAR(100)  NOT NULL UNIQUE,
            `value`     TEXT          NULL,
            `type`      ENUM('string','number','boolean','json') NOT NULL DEFAULT 'string',
            updated_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        )"
    );
} catch (Exception $e) {}

// ── Seed defaults (INSERT IGNORE so they are not overwritten) ─────────────────
$defaults = [
    ['platform_name',          'Bago Shop Express',  'string'],
    ['platform_email',         '',                    'string'],
    ['platform_contact',       '',                    'string'],
    ['commission_rate',        '2',                   'number'],
    ['min_order_amount',       '0',                   'number'],
    ['max_order_amount',       '0',                   'number'],
    ['shipping_base_fee',      '50',                  'number'],
    ['shipping_per_km',        '10',                  'number'],
    ['free_shipping_threshold','0',                   'number'],
    ['maintenance_mode',       '0',                   'boolean'],
    ['allow_new_sellers',      '1',                   'boolean'],
    ['allow_new_buyers',       '1',                   'boolean'],
    ['order_auto_cancel_days', '3',                   'number'],
    ['payout_min_amount',      '500',                 'number'],
];
$ins = $db->prepare("INSERT IGNORE INTO platform_settings (`key`, `value`, `type`) VALUES (?,?,?)");
foreach ($defaults as $d) {
    try { $ins->execute($d); } catch (Exception $e) {}
}

$method = $_SERVER['REQUEST_METHOD'];

// ── GET ───────────────────────────────────────────────────────────────────────
if ($method === 'GET') {
    $stmt = $db->query("SELECT `key`, `value`, `type` FROM platform_settings ORDER BY `key`");
    $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

    $settings = [];
    foreach ($rows as $r) {
        switch ($r['type']) {
            case 'number':  $settings[$r['key']] = (float)$r['value']; break;
            case 'boolean': $settings[$r['key']] = (bool)(int)$r['value']; break;
            default:        $settings[$r['key']] = $r['value'];
        }
    }

    echo json_encode(['settings' => $settings]);
    exit;
}

// ── PUT — partial update ──────────────────────────────────────────────────────
if ($method === 'PUT') {
    $data = json_decode(file_get_contents('php://input'), true);

    if (!is_array($data) || empty($data)) {
        http_response_code(400);
        echo json_encode(['message' => 'No settings provided.']);
        exit;
    }

    // Allowed keys (whitelist to prevent arbitrary column injection)
    $allowed = [
        'platform_name', 'platform_email', 'platform_contact',
        'commission_rate', 'min_order_amount', 'max_order_amount',
        'shipping_base_fee', 'shipping_per_km', 'free_shipping_threshold',
        'maintenance_mode', 'allow_new_sellers', 'allow_new_buyers',
        'order_auto_cancel_days', 'payout_min_amount',
    ];

    $upsert = $db->prepare(
        "INSERT INTO platform_settings (`key`, `value`, `type`)
         VALUES (?, ?, ?)
         ON DUPLICATE KEY UPDATE `value` = VALUES(`value`), updated_at = NOW()"
    );

    $typeMap = [
        'commission_rate' => 'number', 'min_order_amount' => 'number',
        'max_order_amount' => 'number', 'shipping_base_fee' => 'number',
        'shipping_per_km' => 'number', 'free_shipping_threshold' => 'number',
        'order_auto_cancel_days' => 'number', 'payout_min_amount' => 'number',
        'maintenance_mode' => 'boolean', 'allow_new_sellers' => 'boolean',
        'allow_new_buyers' => 'boolean',
    ];

    $saved = 0;
    foreach ($data as $key => $value) {
        if (!in_array($key, $allowed)) continue;

        $type    = $typeMap[$key] ?? 'string';
        $dbValue = match($type) {
            'boolean' => ($value ? '1' : '0'),
            'number'  => (string)(float)$value,
            default   => (string)$value,
        };

        $upsert->execute([$key, $dbValue, $type]);
        $saved++;
    }

    // Log
    try {
        $db->prepare("INSERT INTO admin_logs (admin_id, action, target_type, target_id, details, ip_address) VALUES (?,?,?,?,?,?)")
           ->execute([$payload['user_id'], 'update', 'settings', 0, "Updated $saved platform settings", $_SERVER['REMOTE_ADDR'] ?? '']);
    } catch (Exception $e) {}

    echo json_encode(['message' => "$saved setting(s) saved."]);
    exit;
}

http_response_code(405);
echo json_encode(['message' => 'Method not allowed.']);
