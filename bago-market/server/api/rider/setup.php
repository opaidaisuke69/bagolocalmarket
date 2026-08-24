<?php
require_once '../config/database.php';

$database = new Database();
$db = $database->getConnection();

$results = [];

try {
    // 1. Add rider role to users ENUM
    $db->exec("ALTER TABLE users MODIFY COLUMN role ENUM('buyer', 'seller', 'admin', 'rider') NOT NULL DEFAULT 'buyer'");
    $results[] = "Rider role added to users table";

    // 2. Add columns to deliveries table
    try {
        $db->exec("ALTER TABLE deliveries ADD COLUMN rider_id INT NULL AFTER order_id");
        $results[] = "Added rider_id column";
    } catch (Exception $e) {
        $results[] = "rider_id already exists";
    }

    try {
        $db->exec("ALTER TABLE deliveries ADD COLUMN pickup_proof TEXT NULL AFTER status");
        $results[] = "Added pickup_proof column";
    } catch (Exception $e) {
        $results[] = "pickup_proof already exists";
    }

    try {
        $db->exec("ALTER TABLE deliveries ADD COLUMN delivery_proof TEXT NULL AFTER pickup_proof");
        $results[] = "Added delivery_proof column";
    } catch (Exception $e) {
        $results[] = "delivery_proof already exists";
    }

    try {
        $db->exec("ALTER TABLE deliveries ADD COLUMN picked_up_at TIMESTAMP NULL AFTER delivery_proof");
        $results[] = "Added picked_up_at column";
    } catch (Exception $e) {
        $results[] = "picked_up_at already exists";
    }

    try {
        $db->exec("ALTER TABLE deliveries ADD COLUMN delivered_at TIMESTAMP NULL AFTER picked_up_at");
        $results[] = "Added delivered_at column";
    } catch (Exception $e) {
        $results[] = "delivered_at already exists";
    }

    // 3. Update deliveries status ENUM to include new statuses
    try {
        $db->exec("ALTER TABLE deliveries MODIFY COLUMN status ENUM('preparing', 'ready', 'shipped', 'picked_up', 'out_for_delivery', 'delivered') DEFAULT 'preparing'");
        $results[] = "Updated deliveries status ENUM";
    } catch (Exception $e) {
        $results[] = "Status ENUM update: " . $e->getMessage();
    }

    // 4. Create rider account if not exists
    $stmt = $db->prepare("SELECT id FROM users WHERE email = 'rider@bago.com'");
    $stmt->execute();
    if ($stmt->rowCount() === 0) {
        $password = password_hash('rider123', PASSWORD_BCRYPT);
        $stmt = $db->prepare("INSERT INTO users (email, password, full_name, contact_number, role, status) VALUES (?, ?, ?, ?, 'rider', 'active')");
        $stmt->execute(['rider@bago.com', $password, 'Bago Rider 1', '09123456789']);
        $results[] = "Rider account created";
    } else {
        $results[] = "Rider account already exists";
    }

    // 5. Add 'out_for_delivery' to orders status if not present
    try {
        $db->exec("ALTER TABLE orders MODIFY COLUMN status ENUM('pending', 'confirmed', 'processing', 'shipped', 'out_for_delivery', 'delivered', 'cancelled', 'refunded') DEFAULT 'pending'");
        $results[] = "Updated orders status ENUM with out_for_delivery";
    } catch (Exception $e) {
        $results[] = "Orders status ENUM: " . $e->getMessage();
    }

    echo json_encode([
        "success" => true,
        "results" => $results,
        "rider_credentials" => ["email" => "rider@bago.com", "password" => "rider123"]
    ]);
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(["error" => $e->getMessage(), "results" => $results]);
}
