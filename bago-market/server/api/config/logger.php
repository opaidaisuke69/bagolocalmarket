<?php
/**
 * Shared activity logger — writes to admin_logs table.
 *
 * Automatically creates the table if it doesn't exist (safe for all deployments).
 *
 * Usage:
 *   log_activity($db, $userId, 'login',   'user',    $userId,  'User logged in');
 *   log_activity($db, null,    'register','user',    $newId,   'New buyer registered');
 *
 * Parameters:
 *   $db         PDO    — active database connection
 *   $actorId    int|null — user performing the action (any role or null for system/anon)
 *   $action     string — snake_case verb e.g. 'login', 'create_product', 'place_order'
 *   $targetType string — entity type   e.g. 'user', 'product', 'order', 'seller'
 *   $targetId   int|null — primary key of the affected row
 *   $details    string — human-readable sentence logged as the activity description
 *   $ip         string — IP address (auto-detected from REMOTE_ADDR if empty)
 *
 * All failures are silently swallowed — logging MUST NEVER crash the main request.
 */

/** @var bool — tracks whether the table has been verified this PHP process lifetime */
$_logTableVerified = false;

function log_activity(
    PDO    $db,
           $actorId,
    string $action,
    string $targetType,
           $targetId  = null,
    string $details   = '',
    string $ip        = ''
): void {
    global $_logTableVerified;

    try {
        // ── Auto-create table once per process ───────────────────────────────
        if (!$_logTableVerified) {
            $db->exec(
                "CREATE TABLE IF NOT EXISTS admin_logs (
                    id          INT AUTO_INCREMENT PRIMARY KEY,
                    admin_id    INT          NULL,
                    action      VARCHAR(100) NOT NULL,
                    target_type VARCHAR(50)  NULL,
                    target_id   INT          NULL,
                    details     TEXT         NULL,
                    ip_address  VARCHAR(45)  NULL,
                    created_at  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    INDEX idx_admin   (admin_id),
                    INDEX idx_action  (action),
                    INDEX idx_created (created_at)
                )"
            );

            // ── Migrate old schema: admin_id was NOT NULL with a FK to users(id).
            // That constraint silently blocks inserts from non-admin actors and
            // from system/anonymous calls (null actor).  We must:
            //   1. Drop the FK constraint (MySQL requires this before modifying the column).
            //   2. Make admin_id nullable.
            // Both steps are wrapped individually so a partial-success state is
            // handled gracefully on the next request.
            try {
                // Find the FK constraint name for admin_logs.admin_id dynamically
                // so we are not hard-coding a generated name that differs per server.
                $fkStmt = $db->query(
                    "SELECT CONSTRAINT_NAME
                     FROM information_schema.KEY_COLUMN_USAGE
                     WHERE TABLE_SCHEMA = DATABASE()
                       AND TABLE_NAME   = 'admin_logs'
                       AND COLUMN_NAME  = 'admin_id'
                       AND REFERENCED_TABLE_NAME IS NOT NULL
                     LIMIT 1"
                );
                $fkRow = $fkStmt ? $fkStmt->fetch(\PDO::FETCH_ASSOC) : null;
                if ($fkRow && !empty($fkRow['CONSTRAINT_NAME'])) {
                    $fkName = $fkRow['CONSTRAINT_NAME'];
                    $db->exec("ALTER TABLE admin_logs DROP FOREIGN KEY `$fkName`");
                }
            } catch (Throwable $e) {
                error_log('[log_activity] drop FK: ' . $e->getMessage());
            }

            try {
                // Make the column nullable — safe to run even if already nullable.
                $db->exec("ALTER TABLE admin_logs MODIFY COLUMN admin_id INT NULL");
            } catch (Throwable $e) {
                error_log('[log_activity] modify column: ' . $e->getMessage());
            }

            $_logTableVerified = true;
        }

        // ── Insert log row ────────────────────────────────────────────────────
        $stmt = $db->prepare(
            "INSERT INTO admin_logs
                (admin_id, action, target_type, target_id, details, ip_address)
             VALUES (?, ?, ?, ?, ?, ?)"
        );
        $stmt->execute([
            $actorId  ?: null,
            $action,
            $targetType ?: null,
            $targetId ?: null,
            $details,
            $ip ?: ($_SERVER['REMOTE_ADDR'] ?? ''),
        ]);

    } catch (Throwable $e) {
        // Never let logging crash the request
        error_log('[log_activity] ' . $e->getMessage());
    }
}
