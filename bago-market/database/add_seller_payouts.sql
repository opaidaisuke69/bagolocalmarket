-- ============================================================
-- Seller Payout & Remittance Migration
-- Run against bago_marketplace database
-- ============================================================
USE bago_marketplace;

-- ── 1. Seller remittance accounts (set by seller themselves) ─────────────────
-- Stores the bank / e-wallet details where the admin should send payouts.
CREATE TABLE IF NOT EXISTS seller_remittance_accounts (
    id             INT AUTO_INCREMENT PRIMARY KEY,
    seller_id      INT NOT NULL,
    type           ENUM('gcash','maya','bank','others') NOT NULL DEFAULT 'gcash',
    label          VARCHAR(100)  NOT NULL COMMENT 'e.g. GCash, BDO Savings',
    account_name   VARCHAR(255)  NOT NULL,
    account_number VARCHAR(100)  NOT NULL,
    bank_name      VARCHAR(150)  NULL     COMMENT 'Required when type = bank',
    qr_code_image  VARCHAR(500)  NULL     COMMENT 'Optional uploaded QR code',
    is_primary     BOOLEAN       NOT NULL DEFAULT FALSE,
    is_active      BOOLEAN       NOT NULL DEFAULT TRUE,
    created_at     TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at     TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (seller_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_seller (seller_id),
    INDEX idx_primary (seller_id, is_primary)
);

-- ── 2. Seller payout records (created by admin when distributing) ─────────────
-- Tracks each payout the admin sends to a seller.
CREATE TABLE IF NOT EXISTS seller_payouts (
    id               INT AUTO_INCREMENT PRIMARY KEY,
    seller_id        INT           NOT NULL,
    payout_period_start  DATE      NOT NULL,
    payout_period_end    DATE      NOT NULL,
    gross_amount     DECIMAL(12,2) NOT NULL DEFAULT 0.00 COMMENT 'Total seller revenue before commission',
    commission_amount DECIMAL(12,2) NOT NULL DEFAULT 0.00 COMMENT '2% platform commission',
    net_amount       DECIMAL(12,2) NOT NULL DEFAULT 0.00 COMMENT 'Amount actually sent to seller (gross - commission)',
    order_count      INT           NOT NULL DEFAULT 0,
    remittance_account_id INT      NULL     COMMENT 'Which account the payout was sent to',
    payment_method   VARCHAR(100)  NULL     COMMENT 'GCash, Maya, BDO, etc.',
    reference_number VARCHAR(150)  NULL     COMMENT 'Transaction / reference number',
    receipt_image    VARCHAR(500)  NULL     COMMENT 'Proof of payout sent by admin',
    status           ENUM('pending','processing','released','cancelled') NOT NULL DEFAULT 'pending',
    notes            TEXT          NULL,
    created_by       INT           NOT NULL COMMENT 'Admin user who created the payout',
    released_by      INT           NULL,
    released_at      TIMESTAMP     NULL,
    created_at       TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at       TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (seller_id)            REFERENCES users(id),
    FOREIGN KEY (created_by)           REFERENCES users(id),
    FOREIGN KEY (released_by)          REFERENCES users(id),
    FOREIGN KEY (remittance_account_id) REFERENCES seller_remittance_accounts(id) ON DELETE SET NULL,
    INDEX idx_seller (seller_id),
    INDEX idx_status (status),
    INDEX idx_period (payout_period_start, payout_period_end)
);

-- ── 3. Link payout ↔ orders (which orders are included in a payout) ───────────
CREATE TABLE IF NOT EXISTS seller_payout_orders (
    id         INT AUTO_INCREMENT PRIMARY KEY,
    payout_id  INT NOT NULL,
    order_id   INT NOT NULL,
    UNIQUE KEY uq_payout_order (payout_id, order_id),
    FOREIGN KEY (payout_id) REFERENCES seller_payouts(id) ON DELETE CASCADE,
    FOREIGN KEY (order_id)  REFERENCES orders(id)
);

-- ── 4. Helpful view: pending seller earnings (delivered, not yet paid out) ────
CREATE OR REPLACE VIEW v_seller_pending_earnings AS
SELECT
    sp.user_id                                    AS seller_id,
    sp.store_name,
    u.full_name                                   AS seller_name,
    u.email                                       AS seller_email,
    COUNT(DISTINCT o.id)                          AS order_count,
    COALESCE(SUM(oi.item_subtotal), 0)            AS gross_amount,
    COALESCE(SUM(o.commission_amount * (oi.item_subtotal / NULLIF(o.subtotal,0))), 0)
                                                  AS commission_amount,
    COALESCE(SUM(oi.item_subtotal), 0)
      - COALESCE(SUM(o.commission_amount * (oi.item_subtotal / NULLIF(o.subtotal,0))), 0)
                                                  AS net_amount,
    MIN(o.created_at)                             AS earliest_order,
    MAX(o.created_at)                             AS latest_order
FROM seller_profiles sp
JOIN users u            ON u.id = sp.user_id
JOIN order_items oi     ON oi.seller_id = sp.user_id
JOIN orders o           ON o.id = oi.order_id
                       AND o.status = 'delivered'
WHERE oi.order_id NOT IN (
    SELECT spo.order_id
    FROM seller_payout_orders spo
    JOIN seller_payouts py ON py.id = spo.payout_id
    WHERE py.seller_id = sp.user_id
      AND py.status NOT IN ('cancelled')
)
GROUP BY sp.user_id, sp.store_name, u.full_name, u.email;
