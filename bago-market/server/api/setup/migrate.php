<?php
/**
 * One-time migration runner.
 * Access once at: /BagoMarketPlace/bago-market/server/api/setup/migrate.php
 * DELETE THIS FILE after running.
 */
require_once '../config/database.php';

header('Content-Type: application/json');

$database = new Database();
$db = $database->getConnection();
$results = [];

$migrations = [
    'seller_valid_id_type column' => "ALTER TABLE seller_profiles ADD COLUMN IF NOT EXISTS valid_id_type VARCHAR(50) NULL AFTER verification_document",
    'seller_valid_id_image column' => "ALTER TABLE seller_profiles ADD COLUMN IF NOT EXISTS valid_id_image VARCHAR(500) NULL AFTER valid_id_type",

    'seller_sample_products table' => "
        CREATE TABLE IF NOT EXISTS seller_sample_products (
            id INT AUTO_INCREMENT PRIMARY KEY,
            seller_id INT NOT NULL,
            image_path VARCHAR(500) NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (seller_id) REFERENCES seller_profiles(id) ON DELETE CASCADE,
            INDEX idx_seller_sp (seller_id)
        )
    ",

    'rider_profiles table' => "
        CREATE TABLE IF NOT EXISTS rider_profiles (
            id INT AUTO_INCREMENT PRIMARY KEY,
            user_id INT NOT NULL UNIQUE,
            birthdate DATE NOT NULL,
            sex ENUM('male','female','other') NOT NULL,
            driver_license_image VARCHAR(500) NOT NULL,
            motorcycle_registration_image VARCHAR(500) NOT NULL,
            approval_status ENUM('pending','approved','rejected') DEFAULT 'pending',
            approved_at TIMESTAMP NULL,
            approved_by INT NULL,
            rejection_reason TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        )
    ",

    'email_verification_tokens table' => "
        CREATE TABLE IF NOT EXISTS email_verification_tokens (
            id INT AUTO_INCREMENT PRIMARY KEY,
            user_id INT NOT NULL,
            token VARCHAR(64) NOT NULL UNIQUE,
            expires_at TIMESTAMP NOT NULL,
            used_at TIMESTAMP NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
            INDEX idx_token_evt (token),
            INDEX idx_user_evt (user_id)
        )
    ",

    'password_reset_tokens table' => "
        CREATE TABLE IF NOT EXISTS password_reset_tokens (
            id INT AUTO_INCREMENT PRIMARY KEY,
            user_id INT NOT NULL,
            token VARCHAR(64) NOT NULL UNIQUE,
            expires_at TIMESTAMP NOT NULL,
            used_at TIMESTAMP NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
            INDEX idx_token_prt (token),
            INDEX idx_user_prt (user_id)
        )
    ",

    'rider role in users ENUM' => "ALTER TABLE users MODIFY COLUMN role ENUM('buyer','seller','admin','rider') NOT NULL DEFAULT 'buyer'",

    'email_verified_at column' => "ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified_at TIMESTAMP NULL AFTER status",
];

foreach ($migrations as $name => $sql) {
    try {
        $db->exec(trim($sql));
        $results[$name] = 'OK';
    } catch (Exception $e) {
        $results[$name] = 'SKIP: ' . $e->getMessage();
    }
}

echo json_encode([
    "success" => true,
    "message" => "Migration complete. DELETE this file now.",
    "results" => $results,
], JSON_PRETTY_PRINT);
