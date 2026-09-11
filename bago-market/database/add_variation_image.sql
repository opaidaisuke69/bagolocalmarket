-- Add image_url and hex columns to product_variations for color variant support
ALTER TABLE product_variations 
  ADD COLUMN IF NOT EXISTS image_url VARCHAR(500) NULL AFTER stock,
  ADD COLUMN IF NOT EXISTS hex VARCHAR(7) NULL AFTER image_url;
