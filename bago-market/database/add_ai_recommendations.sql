-- AI Recommendations Cache Table
-- Run this migration to add OpenRouter AI recommendation caching

USE bago_marketplace;

-- Cache table for AI-generated recommendations (avoids repeated API calls)
CREATE TABLE IF NOT EXISTS ai_recommendation_cache (
    id            INT AUTO_INCREMENT PRIMARY KEY,
    cache_key     VARCHAR(128) NOT NULL UNIQUE,   -- md5(user_id + type + context_hash)
    user_id       INT NULL,
    rec_type      VARCHAR(50)  NOT NULL,
    product_ids   JSON         NOT NULL,          -- ordered list of recommended product IDs
    ai_reasoning  TEXT         NULL,              -- LLM explanation (for debugging)
    model_used    VARCHAR(100) NULL,              -- which OpenRouter model answered
    created_at    TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
    expires_at    TIMESTAMP    NULL,              -- cache TTL
    INDEX idx_key        (cache_key),
    INDEX idx_user_type  (user_id, rec_type),
    INDEX idx_expires    (expires_at)
);

-- Store OpenRouter config (optional override table)
CREATE TABLE IF NOT EXISTS ai_config (
    id          INT AUTO_INCREMENT PRIMARY KEY,
    config_key  VARCHAR(100) NOT NULL UNIQUE,
    config_val  TEXT         NOT NULL,
    updated_at  TIMESTAMP    DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Default config values
INSERT INTO ai_config (config_key, config_val) VALUES
    ('openrouter_model',   'openrouter/auto'),
    ('cache_ttl_minutes',  '30'),
    ('max_products_context', '50'),
    ('ai_enabled',         '1')
ON DUPLICATE KEY UPDATE config_val = VALUES(config_val);
