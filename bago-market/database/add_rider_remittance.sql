-- Rider remittance & earnings schema
USE bago_marketplace;

-- Rider e-wallet / bank accounts
CREATE TABLE IF NOT EXISTS rider_payment_accounts (
    id          INT AUTO_INCREMENT PRIMARY KEY,
    rider_id    INT NOT NULL,
    type        ENUM('gcash','maya','bank','others') NOT NULL,
    label       VARCHAR(100) NOT NULL COMMENT 'e.g. GCash, BDO Savings',
    account_name   VARCHAR(255) NOT NULL,
    account_number VARCHAR(100) NOT NULL,
    qr_code_image  VARCHAR(500) NULL COMMENT 'uploaded QR code image path',
    is_primary  BOOLEAN DEFAULT FALSE,
    created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (rider_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_rider (rider_id)
);

-- Admin remittance QR codes (platform-wide, set by admin)
CREATE TABLE IF NOT EXISTS remittance_qr_codes (
    id          INT AUTO_INCREMENT PRIMARY KEY,
    label       VARCHAR(100) NOT NULL COMMENT 'e.g. GCash - Admin, Maya - Admin',
    type        ENUM('gcash','maya','bank','others') NOT NULL DEFAULT 'gcash',
    account_name   VARCHAR(255) NOT NULL,
    account_number VARCHAR(100) NOT NULL,
    qr_code_image  VARCHAR(500) NOT NULL,
    is_active   BOOLEAN DEFAULT TRUE,
    created_by  INT NULL,
    created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (created_by) REFERENCES users(id)
);

-- Rider remittance submissions
CREATE TABLE IF NOT EXISTS rider_remittances (
    id              INT AUTO_INCREMENT PRIMARY KEY,
    rider_id        INT NOT NULL,
    amount          DECIMAL(10,2) NOT NULL,
    period_start    DATE NOT NULL,
    period_end      DATE NOT NULL,
    receipt_image   VARCHAR(500) NOT NULL COMMENT 'proof of remittance',
    reference_number VARCHAR(100) NULL,
    payment_method  VARCHAR(100) NULL COMMENT 'GCash, Maya, bank transfer, etc.',
    status          ENUM('pending','verified','rejected') DEFAULT 'pending',
    verified_by     INT NULL,
    verified_at     TIMESTAMP NULL,
    rejection_reason TEXT NULL,
    notes           TEXT NULL,
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (rider_id)    REFERENCES users(id),
    FOREIGN KEY (verified_by) REFERENCES users(id),
    INDEX idx_rider  (rider_id),
    INDEX idx_status (status),
    INDEX idx_period (period_start, period_end)
);

-- Add remittance_qr_codes seeded data (placeholder — admin updates via dashboard)
INSERT IGNORE INTO remittance_qr_codes (label, type, account_name, account_number, qr_code_image, is_active)
VALUES ('GCash - Bago Market', 'gcash', 'Bago City Market Admin', '09XX-XXX-XXXX', '', 1);
