<?php
require_once '../config/cors.php';
require_once '../config/database.php';
require_once '../middleware/auth.php';

$database = new Database();
$db = $database->getConnection();
$auth = new AuthMiddleware($db);
$payload = $auth->requireRole(['admin']);

$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'GET') {
    $status = isset($_GET['status']) ? $_GET['status'] : '';
    $search = isset($_GET['search']) ? trim($_GET['search']) : '';
    $page   = max(1, (int)($_GET['page']  ?? 1));
    $limit  = max(1, min(100, (int)($_GET['limit'] ?? 20)));
    $offset = ($page - 1) * $limit;

    $where  = "WHERE p.deleted_at IS NULL";
    $params = [];

    if (!empty($status)) {
        $where .= " AND p.approval_status = ?";
        $params[] = $status;
    }
    if (!empty($search)) {
        $where .= " AND (p.name LIKE ? OR sp.store_name LIKE ? OR u.full_name LIKE ?)";
        $s = "%$search%";
        $params[] = $s; $params[] = $s; $params[] = $s;
    }

    // Total for current filter
    $stmt = $db->prepare("SELECT COUNT(*) as total FROM products p LEFT JOIN users u ON p.seller_id = u.id LEFT JOIN seller_profiles sp ON p.seller_id = sp.user_id $where");
    $stmt->execute($params);
    $total = (int)$stmt->fetch(PDO::FETCH_ASSOC)['total'];

    // Counts per status tab (no search filter so they reflect global state)
    $baseWhere = "WHERE p.deleted_at IS NULL";
    $searchParams = [];
    if (!empty($search)) {
        $baseWhere .= " AND (p.name LIKE ? OR sp.store_name LIKE ? OR u.full_name LIKE ?)";
        $s = "%$search%";
        $searchParams[] = $s; $searchParams[] = $s; $searchParams[] = $s;
    }
    $countStmt = $db->prepare(
        "SELECT
            SUM(p.approval_status = 'pending')  AS pending,
            SUM(p.approval_status = 'approved') AS approved,
            SUM(p.approval_status = 'rejected') AS rejected,
            SUM(p.approval_status = 'hidden')   AS hidden,
            SUM(p.approval_status = 'removed')  AS removed,
            COUNT(*)                             AS all_count
         FROM products p
         LEFT JOIN users u ON p.seller_id = u.id
         LEFT JOIN seller_profiles sp ON p.seller_id = sp.user_id
         $baseWhere"
    );
    $countStmt->execute($searchParams);
    $countsRow = $countStmt->fetch(PDO::FETCH_ASSOC);
    $counts = [
        'pending'  => (int)($countsRow['pending']   ?? 0),
        'approved' => (int)($countsRow['approved']  ?? 0),
        'rejected' => (int)($countsRow['rejected']  ?? 0),
        'hidden'   => (int)($countsRow['hidden']    ?? 0),
        'removed'  => (int)($countsRow['removed']   ?? 0),
        'all'      => (int)($countsRow['all_count'] ?? 0),
    ];

    $query = "SELECT p.id, p.name, p.price, p.stock, p.sold_count, p.approval_status,
        p.approval_reason, p.created_at,
        c.name as category_name, u.full_name as seller_name,
        sp.store_name, b.name as barangay_name,
        (SELECT image_url FROM product_images WHERE product_id = p.id AND is_primary = 1 LIMIT 1) as primary_image,
        p.description
        FROM products p
        LEFT JOIN categories c ON p.category_id = c.id
        LEFT JOIN users u ON p.seller_id = u.id
        LEFT JOIN seller_profiles sp ON p.seller_id = sp.user_id
        LEFT JOIN barangays b ON p.barangay_id = b.id
        $where
        ORDER BY p.created_at DESC
        LIMIT $limit OFFSET $offset";

    $stmt = $db->prepare($query);
    $stmt->execute($params);
    $products = $stmt->fetchAll(PDO::FETCH_ASSOC);

    echo json_encode([
        "products"    => $products,
        "total"       => $total,
        "page"        => $page,
        "total_pages" => ceil($total / max(1, $limit)),
        "counts"      => $counts,
    ]);

} elseif ($method === 'PUT') {
    $data = json_decode(file_get_contents("php://input"));

    if (empty($data->product_id) || empty($data->action)) {
        http_response_code(400);
        echo json_encode(["message" => "Product ID and action are required."]);
        exit;
    }

    $validActions = ['approve', 'reject', 'hide', 'remove'];
    if (!in_array($data->action, $validActions)) {
        http_response_code(400);
        echo json_encode(["message" => "Invalid action."]);
        exit;
    }

    $statusMap = [
        'approve' => 'approved',
        'reject' => 'rejected',
        'hide' => 'hidden',
        'remove' => 'removed'
    ];

    $newStatus = $statusMap[$data->action];
    $reason = $data->reason ?? '';

    $stmt = $db->prepare("UPDATE products SET approval_status = ?, approval_reason = ?, approved_by = ?, approved_at = NOW() WHERE id = ?");
    $stmt->execute([$newStatus, $reason, $payload['user_id'], $data->product_id]);

    // Log action
    $stmt = $db->prepare("INSERT INTO admin_logs (admin_id, action, target_type, target_id, details, ip_address) VALUES (?, ?, 'product', ?, ?, ?)");
    $stmt->execute([$payload['user_id'], 'product_' . $data->action, $data->product_id, $reason, $_SERVER['REMOTE_ADDR'] ?? '']);

    // Notify seller
    $stmt = $db->prepare("SELECT seller_id, name FROM products WHERE id = ?");
    $stmt->execute([$data->product_id]);
    $product = $stmt->fetch(PDO::FETCH_ASSOC);

    if ($product) {
        $messages = [
            'approve' => "Your product \"{$product['name']}\" has been approved.",
            'reject' => "Your product \"{$product['name']}\" has been rejected. Reason: $reason",
            'hide' => "Your product \"{$product['name']}\" has been hidden.",
            'remove' => "Your product \"{$product['name']}\" has been removed."
        ];
        $stmt = $db->prepare("INSERT INTO notifications (user_id, title, message, type) VALUES (?, 'Product Update', ?, 'product')");
        $stmt->execute([$product['seller_id'], $messages[$data->action]]);
    }

    echo json_encode(["message" => "Product " . $data->action . "d successfully."]);
}
