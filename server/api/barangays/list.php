<?php
require_once '../config/cors.php';
require_once '../config/database.php';

$database = new Database();
$db = $database->getConnection();

$stmt = $db->query("SELECT * FROM barangays ORDER BY name ASC");
$barangays = $stmt->fetchAll(PDO::FETCH_ASSOC);

echo json_encode(["barangays" => $barangays]);
