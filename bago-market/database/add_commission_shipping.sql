-- Commission & Distance-based Shipping Fee Migration
-- Run this against bago_marketplace database

USE bago_marketplace;

-- ── 1. Add shipping zones to barangays ───────────────────────────────────────
-- Zone 1 (₱40)  = Población and adjacent barangays (city center, ~0-3km)
-- Zone 2 (₱60)  = Mid-range barangays (~3-7km)
-- Zone 3 (₱90)  = Far barangays (~7-15km)
-- Zone 4 (₱130) = Remote barangays (Ma-ao, Mailum, Tabunan, etc. >15km)

ALTER TABLE barangays
    ADD COLUMN IF NOT EXISTS distance_zone TINYINT NOT NULL DEFAULT 2
        COMMENT '1=near(0-3km), 2=mid(3-7km), 3=far(7-15km), 4=remote(>15km)',
    ADD COLUMN IF NOT EXISTS shipping_fee DECIMAL(8,2) NOT NULL DEFAULT 60.00
        COMMENT 'Rider shipping fee for deliveries to this barangay';

-- Set zones based on approximate distance from Bago City Poblacion
UPDATE barangays SET distance_zone = 1, shipping_fee = 40.00
WHERE name IN ('Población', 'Dulao', 'Caridad', 'Ilijan', 'Jorge L. Araneta');

UPDATE barangays SET distance_zone = 2, shipping_fee = 60.00
WHERE name IN ('Abuanan', 'Alianza', 'Atipuluan', 'Balingasag', 'Binubuhan',
               'Busay', 'Calumangan', 'Lag-Asan', 'Napoles', 'Sagasa', 'Sampinit');

UPDATE barangays SET distance_zone = 3, shipping_fee = 90.00
WHERE name IN ('Bagroy', 'Malingin', 'Pacol', 'Taloc');

UPDATE barangays SET distance_zone = 4, shipping_fee = 130.00
WHERE name IN ('Ma-ao', 'Mailum', 'Tabunan');

-- ── 2. Add commission & shipping columns to orders ───────────────────────────
ALTER TABLE orders
    ADD COLUMN IF NOT EXISTS commission_rate  DECIMAL(5,4) NOT NULL DEFAULT 0.0200
        COMMENT 'Platform commission rate (e.g. 0.02 = 2%)',
    ADD COLUMN IF NOT EXISTS commission_amount DECIMAL(10,2) NOT NULL DEFAULT 0.00
        COMMENT 'Total platform commission collected on this order',
    ADD COLUMN IF NOT EXISTS rider_earning    DECIMAL(10,2) NOT NULL DEFAULT 0.00
        COMMENT 'Shipping fee that goes to the rider';

-- ── 3. Add per-item commission breakdown to order_items ──────────────────────
ALTER TABLE order_items
    ADD COLUMN IF NOT EXISTS item_subtotal       DECIMAL(10,2) NOT NULL DEFAULT 0.00
        COMMENT 'price × quantity (seller earnings)',
    ADD COLUMN IF NOT EXISTS commission_amount   DECIMAL(10,2) NOT NULL DEFAULT 0.00
        COMMENT '2% platform commission on this line item',
    ADD COLUMN IF NOT EXISTS item_total          DECIMAL(10,2) NOT NULL DEFAULT 0.00
        COMMENT 'item_subtotal + commission_amount (buyer pays per item)';

-- ── 4. Admin commission summary view ─────────────────────────────────────────
CREATE OR REPLACE VIEW v_commission_summary AS
SELECT
    o.id              AS order_id,
    o.order_number,
    o.created_at,
    o.status,
    u_buyer.full_name AS buyer_name,
    b.name            AS delivery_barangay,
    b.distance_zone,
    o.subtotal,
    o.commission_amount,
    o.rider_earning,
    o.delivery_fee,
    o.total_amount
FROM orders o
JOIN users u_buyer ON o.buyer_id = u_buyer.id
JOIN addresses a   ON o.address_id = a.id
JOIN barangays b   ON a.barangay_id = b.id;
