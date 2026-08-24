<?php
require_once '../config/cors.php';
require_once '../config/database.php';

$database = new Database();
$db = $database->getConnection();

$stmt = $db->query("SELECT c.*, 
    (SELECT COUNT(*) FROM products WHERE category_id = c.id AND approval_status = 'approved' AND is_available = 1 AND deleted_at IS NULL) as product_count
    FROM categories c WHERE c.is_active = 1 ORDER BY c.sort_order ASC, c.name ASC");
$categories = $stmt->fetchAll(PDO::FETCH_ASSOC);

echo json_encode(["categories" => $categories]);
