<?php
/**
 * Admin Categories API
 *
 * GET                                            — list all categories with product count
 * POST  { name, description, icon, sort_order, is_active }   — create
 * PUT   { id, name?, description?, icon?, sort_order?, is_active? }  — update
 * DELETE ?id=                                   — soft-delete (set deleted_at)
 */

require_once '../config/cors.php';
require_once '../config/database.php';
require_once '../middleware/auth.php';

$database = new Database();
$db       = $database->getConnection();
$auth     = new AuthMiddleware($db);
$payload  = $auth->requireRole(['admin']);

$method = $_SERVER['REQUEST_METHOD'];

// ── Auto-migrate: ensure icon & deleted_at columns exist ─────────────────────
foreach ([
    "ALTER TABLE categories ADD COLUMN IF NOT EXISTS icon VARCHAR(50) NULL DEFAULT NULL",
    "ALTER TABLE categories ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP NULL DEFAULT NULL",
] as $ddl) {
    try { $db->exec($ddl); } catch (Exception $e) {}
}

// ── GET ───────────────────────────────────────────────────────────────────────
if ($method === 'GET') {
    $stmt = $db->query(
        "SELECT c.*,
            (SELECT COUNT(*) FROM products p
             WHERE p.category_id = c.id AND p.deleted_at IS NULL) AS product_count
         FROM categories c
         WHERE c.deleted_at IS NULL
         ORDER BY c.sort_order ASC, c.name ASC"
    );
    $categories = $stmt->fetchAll(PDO::FETCH_ASSOC);

    // Cast types
    foreach ($categories as &$cat) {
        $cat['is_active']     = (bool)$cat['is_active'];
        $cat['sort_order']    = (int)$cat['sort_order'];
        $cat['product_count'] = (int)$cat['product_count'];
    }

    echo json_encode(['categories' => $categories]);
    exit;
}

// ── POST — create ─────────────────────────────────────────────────────────────
if ($method === 'POST') {
    $data = json_decode(file_get_contents('php://input'));

    if (empty($data->name) || !trim($data->name)) {
        http_response_code(400);
        echo json_encode(['message' => 'Category name is required.']);
        exit;
    }

    $name       = trim($data->name);
    $desc       = isset($data->description)  ? trim($data->description) : null;
    $icon       = isset($data->icon)         ? trim($data->icon)        : null;
    $sortOrder  = isset($data->sort_order)   ? (int)$data->sort_order   : 0;
    $isActive   = isset($data->is_active)    ? (bool)$data->is_active   : true;

    // Check duplicate
    $check = $db->prepare('SELECT id FROM categories WHERE name = ? AND deleted_at IS NULL');
    $check->execute([$name]);
    if ($check->rowCount() > 0) {
        http_response_code(409);
        echo json_encode(['message' => 'A category with that name already exists.']);
        exit;
    }

    $stmt = $db->prepare(
        'INSERT INTO categories (name, description, icon, sort_order, is_active, created_at)
         VALUES (?, ?, ?, ?, ?, NOW())'
    );
    $stmt->execute([$name, $desc, $icon, $sortOrder, $isActive ? 1 : 0]);
    $newId = $db->lastInsertId();

    // Log
    try {
        $db->prepare("INSERT INTO admin_logs (admin_id, action, target_type, target_id, details, ip_address) VALUES (?,?,?,?,?,?)")
           ->execute([$payload['user_id'], 'create', 'category', $newId, "Created category: $name", $_SERVER['REMOTE_ADDR'] ?? '']);
    } catch (Exception $e) {}

    echo json_encode(['message' => 'Category created.', 'id' => (int)$newId]);
    exit;
}

// ── PUT — update ──────────────────────────────────────────────────────────────
if ($method === 'PUT') {
    $data = json_decode(file_get_contents('php://input'));
    $id   = isset($data->id) ? (int)$data->id : 0;

    if (!$id) {
        http_response_code(400);
        echo json_encode(['message' => 'Category ID required.']);
        exit;
    }

    $check = $db->prepare('SELECT id FROM categories WHERE id = ? AND deleted_at IS NULL');
    $check->execute([$id]);
    if ($check->rowCount() === 0) {
        http_response_code(404);
        echo json_encode(['message' => 'Category not found.']);
        exit;
    }

    $sets   = [];
    $params = [];

    if (isset($data->name)) {
        $sets[]   = 'name = ?';
        $params[] = trim($data->name);
    }
    if (isset($data->description)) {
        $sets[]   = 'description = ?';
        $params[] = trim($data->description);
    }
    if (isset($data->icon)) {
        $sets[]   = 'icon = ?';
        $params[] = trim($data->icon);
    }
    if (isset($data->sort_order)) {
        $sets[]   = 'sort_order = ?';
        $params[] = (int)$data->sort_order;
    }
    if (isset($data->is_active)) {
        $sets[]   = 'is_active = ?';
        $params[] = $data->is_active ? 1 : 0;
    }

    if (empty($sets)) {
        echo json_encode(['message' => 'Nothing to update.']);
        exit;
    }

    $sets[]   = 'updated_at = NOW()';
    $params[] = $id;

    $db->prepare('UPDATE categories SET ' . implode(', ', $sets) . ' WHERE id = ?')
       ->execute($params);

    try {
        $db->prepare("INSERT INTO admin_logs (admin_id, action, target_type, target_id, details, ip_address) VALUES (?,?,?,?,?,?)")
           ->execute([$payload['user_id'], 'update', 'category', $id, 'Updated category', $_SERVER['REMOTE_ADDR'] ?? '']);
    } catch (Exception $e) {}

    echo json_encode(['message' => 'Category updated.']);
    exit;
}

// ── DELETE — soft-delete ──────────────────────────────────────────────────────
if ($method === 'DELETE') {
    $id = isset($_GET['id']) ? (int)$_GET['id'] : 0;

    if (!$id) {
        http_response_code(400);
        echo json_encode(['message' => 'Category ID required.']);
        exit;
    }

    // Prevent deleting if products exist
    $stmt = $db->prepare('SELECT COUNT(*) AS cnt FROM products WHERE category_id = ? AND deleted_at IS NULL');
    $stmt->execute([$id]);
    $cnt = (int)$stmt->fetch(PDO::FETCH_ASSOC)['cnt'];

    if ($cnt > 0) {
        // Nullify category on products instead of blocking
        $db->prepare('UPDATE products SET category_id = NULL WHERE category_id = ?')->execute([$id]);
    }

    $db->prepare('UPDATE categories SET deleted_at = NOW() WHERE id = ?')->execute([$id]);

    try {
        $db->prepare("INSERT INTO admin_logs (admin_id, action, target_type, target_id, details, ip_address) VALUES (?,?,?,?,?,?)")
           ->execute([$payload['user_id'], 'delete', 'category', $id, "Deleted category (had $cnt products)", $_SERVER['REMOTE_ADDR'] ?? '']);
    } catch (Exception $e) {}

    echo json_encode(['message' => 'Category deleted.']);
    exit;
}

http_response_code(405);
echo json_encode(['message' => 'Method not allowed.']);
