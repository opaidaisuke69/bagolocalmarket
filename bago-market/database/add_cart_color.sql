-- Add color_variation_id to cart_items to track color selection separately from size/unit variant
ALTER TABLE cart_items
  ADD COLUMN IF NOT EXISTS color_variation_id INT NULL AFTER variation_id,
  ADD CONSTRAINT fk_cart_color FOREIGN KEY (color_variation_id) REFERENCES product_variations(id) ON DELETE SET NULL;
