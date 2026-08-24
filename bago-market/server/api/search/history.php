<?php
require_once '../config/cors.php';
require_once '../config/database.php';
require_once '../middleware/auth.php';

$database = new Database();
$db = $database->getConnection();
$auth = new AuthMiddleware($db);
$payload = $auth->requireAuth();

$stmt = $db->prepare("SELECT DISTINCT query, MAX(created_at) as last_searched FROM search_history WHERE user_id = ? GROUP BY query ORDER BY last_searched DESC LIMIT 10");
$stmt->execute([$payload['user_id']]);
$history = $stmt->fetchAll(PDO::FETCH_ASSOC);

echo json_encode(["history" => $history]);
