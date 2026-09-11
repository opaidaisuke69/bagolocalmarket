<?php
/**
 * Admin Warnings API
 *
 * GET  ?search=&severity=&page=&limit=   — paginated warning history
 *
 * (User actions: warn / ban / suspend / reactivate are handled by admin/users.php PUT)
 */

require_once '../config/cors.php';
require_once '../config/database.php';
require_once '../middleware/auth.php';

$database = new Database();
$db       = $database->getConnection();
$auth     = new AuthMiddleware($db);
$payload  = $auth->requireRole(['admin']);

$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'GET') {
    $search   = isset($_GET['search'])   ? trim($_GET['search'])   : '';
    $severity = isset($_GET['severity']) ? $_GET['severity']       : '';
    $page     = max(1, (int)($_GET['page']  ?? 1));
    $limit    = max(1, min(100, (int)($_GET['limit'] ?? 20)));
    $offset   = ($page - 1) * $limit;

    $where  = [];
    $params = [];

    if ($severity) {
        $where[]  = 'aw.severity = ?';
        $params[] = $severity;
    }
    if ($search) {
        $where[]  = '(u.full_name LIKE ? OR u.email LIKE ?)';
        $s = "%$search%";
        $params[] = $s; $params[] = $s;
    }

    $whereSQL = $where ? ('WHERE ' . implode(' AND ', $where)) : '';

    // Total
    $stmt = $db->prepare(
        "SELECT COUNT(*) AS total
         FROM account_warnings aw
         JOIN users u ON aw.user_id = u.id
         $whereSQL"
    );
    $stmt->execute($params);
    $total = (int)$stmt->fetch(PDO::FETCH_ASSOC)['total'];

    // Data
    $stmt = $db->prepare(
        "SELECT
            aw.id, aw.user_id, aw.severity, aw.reason, aw.created_at,
            u.full_name   AS user_name,
            u.email       AS user_email,
            u.role        AS user_role,
            admin.full_name AS issued_by_name
         FROM account_warnings aw
         JOIN users u     ON aw.user_id   = u.id
         LEFT JOIN users admin ON aw.issued_by = admin.id
         $whereSQL
         ORDER BY aw.created_at DESC
         LIMIT $limit OFFSET $offset"
    );
    $stmt->execute($params);
    $warnings = $stmt->fetchAll(PDO::FETCH_ASSOC);

    echo json_encode([
        'warnings'    => $warnings,
        'total'       => $total,
        'page'        => $page,
        'total_pages' => ceil($total / $limit),
    ]);
    exit;
}

http_response_code(405);
echo json_encode(['message' => 'Method not allowed.']);
