-- Add missing columns to deliveries table for rider proof system
ALTER TABLE deliveries 
    ADD COLUMN rider_id INT NULL AFTER order_id,
    ADD COLUMN pickup_proof VARCHAR(500) NULL AFTER actual_delivery,
    ADD COLUMN delivery_proof VARCHAR(500) NULL AFTER pickup_proof,
    ADD COLUMN picked_up_at TIMESTAMP NULL AFTER delivery_proof,
    ADD COLUMN delivered_at TIMESTAMP NULL AFTER picked_up_at;

-- Add foreign key for rider
ALTER TABLE deliveries
    ADD CONSTRAINT fk_delivery_rider FOREIGN KEY (rider_id) REFERENCES users(id) ON DELETE SET NULL;

-- Update status ENUM to include 'picked_up'
ALTER TABLE deliveries 
    MODIFY COLUMN status ENUM('preparing', 'ready', 'picked_up', 'shipped', 'out_for_delivery', 'delivered') DEFAULT 'preparing';
