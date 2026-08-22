-- Add 'rider' to the role ENUM
ALTER TABLE users MODIFY COLUMN role ENUM('buyer', 'seller', 'admin', 'rider') NOT NULL DEFAULT 'buyer';

-- Create a sample rider account (password: rider123)
INSERT INTO users (email, password, full_name, contact_number, role, status) 
VALUES ('rider@bago.com', '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'Bago Rider 1', '09123456789', 'rider', 'active');

-- Note: The password hash above is for "password" (default Laravel hash)
-- You may need to create a proper hash. Use this PHP to generate: password_hash('rider123', PASSWORD_BCRYPT)
