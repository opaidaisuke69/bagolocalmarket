<?php
require_once '../config/cors.php';
require_once '../config/database.php';

$database = new Database();
$db = $database->getConnection();

$limit = isset($_GET['limit']) ? min((int)$_GET['limit'], 20) : 10;

// Aggregate search terms across ALL users over the last 30 days.
// Score = number of distinct users who searched the term × recency weight.
// Filter out very short or generic junk (< 3 chars).
$stmt = $db->prepare(
    "SELECT
        query,
        COUNT(DISTINCT user_id)                              AS unique_searchers,
        COUNT(*)                                             AS total_searches,
        MAX(created_at)                                      AS last_searched_at,
        SUM(results_count)                                   AS total_results
     FROM search_history
     WHERE
        created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
        AND CHAR_LENGTH(query) >= 3
        AND results_count > 0
     GROUP BY query
     ORDER BY unique_searchers DESC, total_searches DESC
     LIMIT ?"
);
$stmt->bindValue(1, $limit, PDO::PARAM_INT);
$stmt->execute();
$rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

// Shape the response
$popular = array_map(function ($row) {
    return [
        'query'            => $row['query'],
        'search_count'     => (int)$row['total_searches'],
        'unique_searchers' => (int)$row['unique_searchers'],
    ];
}, $rows);

echo json_encode([
    'popular' => $popular,
    'total'   => count($popular),
]);
