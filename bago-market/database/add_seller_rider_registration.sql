-- Migration: Enhanced Seller Registration + Rider Profiles + Email Verification
-- Run this against the bago_marketplace database

USE bago_marketplace;

-- 1. Add new columns to seller_profiles for enhanced registration
ALTER TABLE seller_profiles
  ADD COLUMN IF NOT EXISTS valid_id_type VARCHAR(50) NULL AFTER verification_document,
  ADD COLUMN IF NOT EXISTS valid_id_image VARCHAR(500) NULL AFTER valid_id_type;

-- 2. Create seller_sample_products table (at least 5 images required)
CREATE TABLE IF NOT EXISTS seller_sample_products (
    id INT AUTO_INCREMENT PRIMARY KEY,
    seller_id INT NOT NULL,
    image_path VARCHAR(500) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (seller_id) REFERENCES seller_profiles(id) ON DELETE CASCADE,
    INDEX idx_seller (seller_id)
);

-- 3. Create rider_profiles table
CREATE TABLE IF NOT EXISTS rider_profiles (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL UNIQUE,
    birthdate DATE NOT NULL,
    sex ENUM('male', 'female', 'other') NOT NULL,
    driver_license_image VARCHAR(500) NOT NULL,
    motorcycle_registration_image VARCHAR(500) NOT NULL,
    approval_status ENUM('pending', 'approved', 'rejected') DEFAULT 'pending',
    approved_at TIMESTAMP NULL,
    approved_by INT NULL,
    rejection_reason TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (approved_by) REFERENCES users(id),
    INDEX idx_approval (approval_status)
);

-- 4. Create email_verification_tokens table
CREATE TABLE IF NOT EXISTS email_verification_tokens (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    token VARCHAR(64) NOT NULL UNIQUE,
    expires_at TIMESTAMP NOT NULL,
    used_at TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_token (token),
    INDEX idx_user (user_id)
);

-- 5. Ensure rider role exists in users ENUM
ALTER TABLE users MODIFY COLUMN role ENUM('buyer', 'seller', 'admin', 'rider') NOT NULL DEFAULT 'buyer';

-- 6. Password reset tokens table
CREATE TABLE IF NOT EXISTS password_reset_tokens (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    token VARCHAR(64) NOT NULL UNIQUE,
    expires_at TIMESTAMP NOT NULL,
    used_at TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_token (token),
    INDEX idx_user (user_id)
);
