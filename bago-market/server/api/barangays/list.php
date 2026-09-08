<?php
require_once '../config/cors.php';
require_once '../config/database.php';

$database = new Database();
$db = $database->getConnection();

// ── Auto-migrate: ensure distance_zone & shipping_fee columns exist ──────────
try {
    $db->exec("ALTER TABLE barangays
        ADD COLUMN IF NOT EXISTS distance_zone TINYINT NOT NULL DEFAULT 2,
        ADD COLUMN IF NOT EXISTS shipping_fee  DECIMAL(8,2) NOT NULL DEFAULT 60.00");

    // Only seed zones when all rows still have the default value (fresh migration)
    $check = $db->query("SELECT COUNT(*) FROM barangays WHERE distance_zone != 2")->fetchColumn();
    if ((int)$check === 0) {
        $db->exec("UPDATE barangays SET distance_zone=1, shipping_fee=40.00
                   WHERE name IN ('Población','Dulao','Caridad','Ilijan','Jorge L. Araneta')");
        $db->exec("UPDATE barangays SET distance_zone=2, shipping_fee=60.00
                   WHERE name IN ('Abuanan','Alianza','Atipuluan','Balingasag','Binubuhan',
                                  'Busay','Calumangan','Lag-Asan','Napoles','Sagasa','Sampinit')");
        $db->exec("UPDATE barangays SET distance_zone=3, shipping_fee=90.00
                   WHERE name IN ('Bagroy','Malingin','Pacol','Taloc')");
        $db->exec("UPDATE barangays SET distance_zone=4, shipping_fee=130.00
                   WHERE name IN ('Ma-ao','Mailum','Tabunan')");
    }
} catch (Exception $e) {
    // Columns may already exist — safe to ignore
}

$stmt = $db->query("SELECT id, name, distance_zone, shipping_fee FROM barangays ORDER BY name ASC");
$barangays = $stmt->fetchAll(PDO::FETCH_ASSOC);

// Cast numeric types
foreach ($barangays as &$b) {
    $b['distance_zone'] = (int)$b['distance_zone'];
    $b['shipping_fee']  = (float)$b['shipping_fee'];
}

echo json_encode(["barangays" => $barangays]);
