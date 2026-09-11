-- ============================================================
--  Migration: fix_admin_logs_constraint.sql
--  Purpose  : Make admin_logs.admin_id nullable and remove the
--             FOREIGN KEY constraint that was silently blocking
--             activity-log inserts from non-admin actors
--             (buyers, sellers, riders) and anonymous/system
--             calls (null actor).
--
--  Safe to run multiple times — every step is guarded so it
--  will not error if the schema is already in the target state.
-- ============================================================

-- Step 1: Drop the foreign key constraint on admin_logs.admin_id.
--         MySQL requires the FK to be dropped before the column
--         definition can be changed.
--         The block below finds the constraint name dynamically
--         so it works regardless of the auto-generated name
--         assigned by MySQL at table-creation time.

SET @fk_name = (
    SELECT CONSTRAINT_NAME
    FROM   information_schema.KEY_COLUMN_USAGE
    WHERE  TABLE_SCHEMA          = DATABASE()
      AND  TABLE_NAME            = 'admin_logs'
      AND  COLUMN_NAME           = 'admin_id'
      AND  REFERENCED_TABLE_NAME IS NOT NULL
    LIMIT 1
);

SET @drop_fk = IF(
    @fk_name IS NOT NULL,
    CONCAT('ALTER TABLE admin_logs DROP FOREIGN KEY `', @fk_name, '`'),
    'SELECT "No FK to drop — already clean" AS info'
);

PREPARE stmt FROM @drop_fk;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Step 2: Make admin_id nullable so any user role (or a NULL
--         system actor) can write log entries without violating
--         the NOT NULL constraint.

ALTER TABLE admin_logs
    MODIFY COLUMN admin_id INT NULL;

-- Step 3: (Optional) add the missing indexes if the table was
--         created via an older schema that lacked them.

ALTER TABLE admin_logs
    ADD INDEX IF NOT EXISTS idx_admin   (admin_id),
    ADD INDEX IF NOT EXISTS idx_action  (action),
    ADD INDEX IF NOT EXISTS idx_created (created_at);

-- Done.
SELECT 'admin_logs migration complete' AS result;
