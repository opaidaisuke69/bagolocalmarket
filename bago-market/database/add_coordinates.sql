-- ═══════════════════════════════════════════════════════════════════════════
-- Add GPS coordinate columns for precise distance-based shipping fees
-- Run once against bago_marketplace
-- ═══════════════════════════════════════════════════════════════════════════
USE bago_marketplace;

-- seller_profiles: store pickup location
ALTER TABLE seller_profiles
  ADD COLUMN IF NOT EXISTS latitude  DECIMAL(10,8) NULL AFTER complete_address,
  ADD COLUMN IF NOT EXISTS longitude DECIMAL(11,8) NULL AFTER latitude;

-- buyer_profiles: home/default location
ALTER TABLE buyer_profiles
  ADD COLUMN IF NOT EXISTS latitude  DECIMAL(10,8) NULL AFTER complete_address,
  ADD COLUMN IF NOT EXISTS longitude DECIMAL(11,8) NULL AFTER latitude;

-- addresses: per-address pin (most accurate — used for shipping fee calc)
ALTER TABLE addresses
  ADD COLUMN IF NOT EXISTS latitude  DECIMAL(10,8) NULL AFTER delivery_notes,
  ADD COLUMN IF NOT EXISTS longitude DECIMAL(11,8) NULL AFTER latitude;
