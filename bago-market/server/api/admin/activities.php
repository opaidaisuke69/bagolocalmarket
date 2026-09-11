<?php
require_once '../config/cors.php';
require_once '../config/database.php';
require_once '../middleware/auth.php';

$database = new Database();
$db       = $database->getConnection();
$auth     = new AuthMiddleware($db);
$payload  = $auth->requireRole(['admin']);

$page   = max(1, (int)($_GET['page']  ?? 1));
$limit  = max(1, min(100, (int)($_GET['limit'] ?? 50)));
$search = isset($_GET['search']) ? trim($_GET['search']) : '';
$action = isset($_GET['action_filter']) ? trim($_GET['action_filter']) : '';
$target = isset($_GET['target_type'])   ? trim($_GET['target_type'])   : '';
$since  = isset($_GET['since'])         ? (int)$_GET['since']          : 0; // Unix ts for real-time polling

// When polling for new rows (since= is set) always start from row 0 so we
// never skip rows regardless of what page the client is currently viewing.
$offset = ($since > 0) ? 0 : ($page - 1) * $limit;

$where  = [];
$params = [];

if ($search !== '') {
    $where[]  = '(u.full_name LIKE ? OR al.action LIKE ? OR al.target_type LIKE ? OR al.details LIKE ?)';
    $s = "%$search%";
    $params[] = $s; $params[] = $s; $params[] = $s; $params[] = $s;
}
if ($action !== '') {
    $where[]  = 'al.action = ?';
    $params[] = $action;
}
if ($target !== '') {
    $where[]  = 'al.target_type = ?';
    $params[] = $target;
}
if ($since > 0) {
    $where[]  = 'UNIX_TIMESTAMP(al.created_at) > ?';
    $params[] = $since;
}

$whereSQL = $where ? ('WHERE ' . implode(' AND ', $where)) : '';

// Total count
$countStmt = $db->prepare(
    "SELECT COUNT(*) AS total
     FROM admin_logs al
     LEFT JOIN users u ON al.admin_id = u.id
     $whereSQL"
);
$countStmt->execute($params);
$total = (int)$countStmt->fetch(PDO::FETCH_ASSOC)['total'];

// Rows — when using since= for real-time, skip pagination and return newest first
$dataStmt = $db->prepare(
    "SELECT al.id, al.action, al.target_type, al.target_id, al.details,
            al.ip_address, al.created_at,
            u.full_name, u.role
     FROM admin_logs al
     LEFT JOIN users u ON al.admin_id = u.id
     $whereSQL
     ORDER BY al.created_at DESC
     LIMIT $limit OFFSET $offset"
);
$dataStmt->execute($params);
$activities = $dataStmt->fetchAll(PDO::FETCH_ASSOC);

// Distinct action types (for filter dropdown — always full list, no search filter)
$actionStmt = $db->query("SELECT DISTINCT action FROM admin_logs WHERE action IS NOT NULL ORDER BY action ASC");
$allActions = array_column($actionStmt->fetchAll(PDO::FETCH_ASSOC), 'action');

// Distinct target types
$targetStmt = $db->query("SELECT DISTINCT target_type FROM admin_logs WHERE target_type IS NOT NULL ORDER BY target_type ASC");
$allTargets = array_column($targetStmt->fetchAll(PDO::FETCH_ASSOC), 'target_type');

// Latest timestamp (so frontend knows what to poll after).
// When the current result is empty (e.g. no new rows since last poll) fall
// back to the absolute newest row in the table so the client timestamp is
// never reset to 0, which would cause the next poll to return everything.
$latestTs = 0;
if (!empty($activities)) {
    $latestTs = strtotime($activities[0]['created_at']);
} else {
    try {
        $tsRow = $db->query("SELECT UNIX_TIMESTAMP(MAX(created_at)) AS ts FROM admin_logs")->fetch(PDO::FETCH_ASSOC);
        if ($tsRow && $tsRow['ts']) {
            $latestTs = (int)$tsRow['ts'];
        }
    } catch (Throwable $e) { /* table may not exist yet */ }
}

echo json_encode([
    'activities'  => $activities,
    'total'       => $total,
    'page'        => $page,
    'total_pages' => ceil($total / $limit),
    'all_actions' => $allActions,
    'all_targets' => $allTargets,
    'latest_ts'   => $latestTs,
]);
