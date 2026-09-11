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
    // Return last 15 distinct search queries for the user
    $stmt = $db->prepare(
        "SELECT query, MAX(created_at) as last_searched
         FROM search_history WHERE user_id = ?
         GROUP BY query ORDER BY last_searched DESC LIMIT 15"
    );
    $stmt->execute([$payload['user_id']]);
    $rows    = $stmt->fetchAll(PDO::FETCH_ASSOC);
    $history = array_column($rows, 'query');
    echo json_encode(["history" => $history]);

} elseif ($method === 'DELETE') {
    $body  = json_decode(file_get_contents('php://input'), true) ?? [];
    $query = isset($body['query']) ? trim($body['query']) : '';

    if (!empty($query)) {
        // Remove a single search term
        $stmt = $db->prepare(
            "DELETE FROM search_history WHERE user_id = ? AND query = ?"
        );
        $stmt->execute([$payload['user_id'], $query]);
    } else {
        // Clear all history for the user
        $stmt = $db->prepare(
            "DELETE FROM search_history WHERE user_id = ?"
        );
        $stmt->execute([$payload['user_id']]);
    }
    echo json_encode(["success" => true]);
} else {
    http_response_code(405);
    echo json_encode(["message" => "Method not allowed"]);
}
