<?php
/**
 * Seller Remittance Account API
 *
 * GET                          — list own remittance accounts + payout history
 * POST                         — add a new remittance account
 * PUT                          — update an existing account / set as primary
 * DELETE ?account_id=          — deactivate (soft-delete) an account
 */

require_once '../config/cors.php';
require_once '../config/database.php';
require_once '../middleware/auth.php';
require_once '../config/logger.php';

$database = new Database();
$db       = $database->getConnection();
$auth     = new AuthMiddleware($db);
$payload  = $auth->requireRole(['seller']);

$sellerId = (int)$payload['user_id'];
$method   = $_SERVER['REQUEST_METHOD'];

// ── Auto-migrate ──────────────────────────────────────────────────────────────
$migrations = [
    "CREATE TABLE IF NOT EXISTS seller_remittance_accounts (
        id             INT AUTO_INCREMENT PRIMARY KEY,
        seller_id      INT NOT NULL,
        type           ENUM('gcash','maya','bank','others') NOT NULL DEFAULT 'gcash',
        label          VARCHAR(100)  NOT NULL,
        account_name   VARCHAR(255)  NOT NULL,
        account_number VARCHAR(100)  NOT NULL,
        bank_name      VARCHAR(150)  NULL,
        qr_code_image  VARCHAR(500)  NULL,
        is_primary     BOOLEAN NOT NULL DEFAULT FALSE,
        is_active      BOOLEAN NOT NULL DEFAULT TRUE,
        created_at     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (seller_id) REFERENCES users(id) ON DELETE CASCADE,
        INDEX idx_seller (seller_id)
    )",
    "CREATE TABLE IF NOT EXISTS seller_payouts (
        id                   INT AUTO_INCREMENT PRIMARY KEY,
        seller_id            INT           NOT NULL,
        payout_period_start  DATE          NOT NULL,
        payout_period_end    DATE          NOT NULL,
        gross_amount         DECIMAL(12,2) NOT NULL DEFAULT 0.00,
        commission_amount    DECIMAL(12,2) NOT NULL DEFAULT 0.00,
        net_amount           DECIMAL(12,2) NOT NULL DEFAULT 0.00,
        order_count          INT           NOT NULL DEFAULT 0,
        remittance_account_id INT          NULL,
        payment_method       VARCHAR(100)  NULL,
        reference_number     VARCHAR(150)  NULL,
        receipt_image        VARCHAR(500)  NULL,
        status               ENUM('pending','processing','released','cancelled') NOT NULL DEFAULT 'pending',
        notes                TEXT          NULL,
        created_by           INT           NOT NULL,
        released_by          INT           NULL,
        released_at          TIMESTAMP     NULL,
        created_at           TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at           TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (seller_id)  REFERENCES users(id),
        FOREIGN KEY (created_by) REFERENCES users(id),
        INDEX idx_seller (seller_id),
        INDEX idx_status (status)
    )",
];
foreach ($migrations as $ddl) {
    try { $db->exec($ddl); } catch (Exception $e) {}
}

// ── Helper: save base64 image ─────────────────────────────────────────────────
function saveBase64Image($base64, $subdir) {
    if (empty($base64) || strpos($base64, 'data:') !== 0) return null;
    [$meta, $raw] = explode(',', $base64, 2);
    $mime  = explode(';', explode(':', $meta)[1])[0];
    $extMap = ['image/jpeg' => 'jpg', 'image/png' => 'png', 'image/webp' => 'webp'];
    $ext   = $extMap[$mime] ?? 'jpg';
    $dir   = __DIR__ . '/../../uploads/' . $subdir . '/';
    if (!is_dir($dir)) mkdir($dir, 0755, true);
    $fn = uniqid('', true) . '_' . time() . '.' . $ext;
    file_put_contents($dir . $fn, base64_decode($raw));
    return '/uploads/' . $subdir . '/' . $fn;
}

// ── Validate account ownership ────────────────────────────────────────────────
function getOwnAccount($db, $accountId, $sellerId) {
    $s = $db->prepare(
        "SELECT * FROM seller_remittance_accounts WHERE id = ? AND seller_id = ? AND is_active = 1"
    );
    $s->execute([$accountId, $sellerId]);
    return $s->fetch(PDO::FETCH_ASSOC);
}

// =============================================================================
// GET — accounts + payout history
// =============================================================================
if ($method === 'GET') {

    // Remittance accounts
    $aStmt = $db->prepare(
        "SELECT * FROM seller_remittance_accounts
         WHERE seller_id = ? AND is_active = 1
         ORDER BY is_primary DESC, created_at ASC"
    );
    $aStmt->execute([$sellerId]);
    $accounts = $aStmt->fetchAll(PDO::FETCH_ASSOC);

    // Payout history (most recent 50)
    $pStmt = $db->prepare(
        "SELECT
            py.*,
            sra.type         AS account_type,
            sra.label        AS account_label,
            sra.account_name AS account_holder,
            sra.account_number,
            sra.bank_name,
            adm.full_name    AS released_by_name
         FROM seller_payouts py
         LEFT JOIN seller_remittance_accounts sra ON sra.id = py.remittance_account_id
         LEFT JOIN users adm ON adm.id = py.released_by
         WHERE py.seller_id = ?
         ORDER BY py.created_at DESC
         LIMIT 50"
    );
    $pStmt->execute([$sellerId]);
    $payouts = $pStmt->fetchAll(PDO::FETCH_ASSOC);

    // Payout summary totals
    $sumStmt = $db->prepare(
        "SELECT
            COALESCE(SUM(CASE WHEN status = 'released'   THEN net_amount END), 0) AS total_received,
            COALESCE(SUM(CASE WHEN status = 'pending'    THEN net_amount END), 0) AS total_pending,
            COALESCE(SUM(CASE WHEN status = 'processing' THEN net_amount END), 0) AS total_processing,
            COUNT(CASE WHEN status = 'released'   THEN 1 END) AS released_count,
            COUNT(CASE WHEN status = 'pending'    THEN 1 END) AS pending_count,
            COUNT(CASE WHEN status = 'processing' THEN 1 END) AS processing_count
         FROM seller_payouts WHERE seller_id = ?"
    );
    $sumStmt->execute([$sellerId]);
    $summary = $sumStmt->fetch(PDO::FETCH_ASSOC);

    // Unpaid delivered orders estimate (what admin still owes)
    // Uses oi.commission_amount directly — stored at order creation time as price*qty*0.02
    $unpaidStmt = $db->prepare(
        "SELECT
            COUNT(DISTINCT o.id)                    AS unpaid_order_count,
            COALESCE(SUM(oi.item_subtotal),    0)   AS unpaid_gross,
            COALESCE(SUM(oi.commission_amount),0)   AS unpaid_commission,
            COALESCE(SUM(oi.item_subtotal),    0)
              - COALESCE(SUM(oi.commission_amount),0) AS unpaid_net
         FROM order_items oi
         JOIN orders o ON o.id = oi.order_id AND o.status = 'delivered'
         WHERE oi.seller_id = ?
           AND oi.order_id NOT IN (
               SELECT spo.order_id
               FROM seller_payout_orders spo
               JOIN seller_payouts py ON py.id = spo.payout_id
               WHERE py.seller_id = ? AND py.status != 'cancelled'
           )"
    );
    $unpaidStmt->execute([$sellerId, $sellerId]);
    $unpaid = $unpaidStmt->fetch(PDO::FETCH_ASSOC);

    echo json_encode([
        'accounts' => $accounts,
        'payouts'  => $payouts,
        'summary'  => $summary,
        'unpaid'   => $unpaid,
    ]);
    exit;
}

// =============================================================================
// POST — add remittance account
// =============================================================================
if ($method === 'POST') {
    $data = json_decode(file_get_contents('php://input'), true);

    // Validate required fields
    $required = ['label', 'account_name', 'account_number'];
    foreach ($required as $f) {
        if (empty(trim($data[$f] ?? ''))) {
            http_response_code(400);
            echo json_encode(['message' => "$f is required."]);
            exit;
        }
    }

    $type      = in_array($data['type'] ?? '', ['gcash','maya','bank','others'])
                 ? $data['type'] : 'gcash';
    $label     = trim($data['label']);
    $accName   = trim($data['account_name']);
    $accNum    = trim($data['account_number']);
    $bankName  = trim($data['bank_name'] ?? '');
    $isPrimary = !empty($data['is_primary']) ? 1 : 0;

    // Validate bank name when type is bank
    if ($type === 'bank' && empty($bankName)) {
        http_response_code(400);
        echo json_encode(['message' => 'bank_name is required for bank accounts.']);
        exit;
    }

    // Save optional QR image
    $qrPath = null;
    if (!empty($data['qr_code_image'])) {
        $qrPath = saveBase64Image($data['qr_code_image'], 'seller_qr_codes');
    }

    // Cap at 5 active accounts per seller
    $countStmt = $db->prepare(
        "SELECT COUNT(*) FROM seller_remittance_accounts WHERE seller_id = ? AND is_active = 1"
    );
    $countStmt->execute([$sellerId]);
    if ((int)$countStmt->fetchColumn() >= 5) {
        http_response_code(400);
        echo json_encode(['message' => 'Maximum 5 remittance accounts allowed. Remove one first.']);
        exit;
    }

    try {
        $db->beginTransaction();

        // If this is primary, unset any existing primary first
        if ($isPrimary) {
            $db->prepare(
                "UPDATE seller_remittance_accounts SET is_primary = 0 WHERE seller_id = ?"
            )->execute([$sellerId]);
        }

        $stmt = $db->prepare(
            "INSERT INTO seller_remittance_accounts
                (seller_id, type, label, account_name, account_number,
                 bank_name, qr_code_image, is_primary)
             VALUES (?,?,?,?,?,?,?,?)"
        );
        $stmt->execute([
            $sellerId, $type, $label, $accName, $accNum,
            $bankName ?: null, $qrPath, $isPrimary,
        ]);
        $newId = (int)$db->lastInsertId();

        $db->commit();
        echo json_encode([
            'message'    => 'Remittance account added.',
            'account_id' => $newId,
        ]);
    } catch (Exception $e) {
        $db->rollBack();
        http_response_code(500);
        echo json_encode(['message' => 'Failed to save account: ' . $e->getMessage()]);
    }
    exit;
}

// =============================================================================
// PUT — update account or set primary
// =============================================================================
if ($method === 'PUT') {
    $data      = json_decode(file_get_contents('php://input'), true);
    $accountId = (int)($data['account_id'] ?? 0);

    if (!$accountId) {
        http_response_code(400);
        echo json_encode(['message' => 'account_id is required.']);
        exit;
    }

    $account = getOwnAccount($db, $accountId, $sellerId);
    if (!$account) {
        http_response_code(404);
        echo json_encode(['message' => 'Account not found.']);
        exit;
    }

    $action = $data['action'] ?? 'update';

    try {
        $db->beginTransaction();

        if ($action === 'set_primary') {
            // Clear existing primary then set this one
            $db->prepare(
                "UPDATE seller_remittance_accounts SET is_primary = 0 WHERE seller_id = ?"
            )->execute([$sellerId]);
            $db->prepare(
                "UPDATE seller_remittance_accounts SET is_primary = 1 WHERE id = ?"
            )->execute([$accountId]);
            $message = 'Primary account updated.';

        } else {
            // Full field update
            $required = ['label', 'account_name', 'account_number'];
            foreach ($required as $f) {
                if (empty(trim($data[$f] ?? ''))) {
                    http_response_code(400);
                    echo json_encode(['message' => "$f is required."]);
                    $db->rollBack();
                    exit;
                }
            }

            $type     = in_array($data['type'] ?? '', ['gcash','maya','bank','others'])
                        ? $data['type'] : $account['type'];
            $bankName = trim($data['bank_name'] ?? '');
            if ($type === 'bank' && empty($bankName)) {
                http_response_code(400);
                echo json_encode(['message' => 'bank_name is required for bank accounts.']);
                $db->rollBack();
                exit;
            }

            $isPrimary = !empty($data['is_primary']) ? 1 : 0;
            if ($isPrimary) {
                $db->prepare(
                    "UPDATE seller_remittance_accounts SET is_primary = 0 WHERE seller_id = ?"
                )->execute([$sellerId]);
            }

            // Update QR image only if a new one is provided
            $qrPath = $account['qr_code_image'];
            if (!empty($data['qr_code_image']) && strpos($data['qr_code_image'], 'data:') === 0) {
                $qrPath = saveBase64Image($data['qr_code_image'], 'seller_qr_codes');
            }

            $db->prepare(
                "UPDATE seller_remittance_accounts
                 SET type = ?, label = ?, account_name = ?, account_number = ?,
                     bank_name = ?, qr_code_image = ?, is_primary = ?, updated_at = NOW()
                 WHERE id = ? AND seller_id = ?"
            )->execute([
                $type, trim($data['label']),
                trim($data['account_name']), trim($data['account_number']),
                $bankName ?: null, $qrPath, $isPrimary,
                $accountId, $sellerId,
            ]);
            $message = 'Account updated.';
        }

        $db->commit();
        echo json_encode(['message' => $message]);
    } catch (Exception $e) {
        $db->rollBack();
        http_response_code(500);
        echo json_encode(['message' => 'Update failed: ' . $e->getMessage()]);
    }
    exit;
}

// =============================================================================
// DELETE — soft-delete (deactivate) an account
// =============================================================================
if ($method === 'DELETE') {
    $accountId = (int)($_GET['account_id'] ?? 0);
    if (!$accountId) {
        http_response_code(400);
        echo json_encode(['message' => 'account_id required.']);
        exit;
    }

    $account = getOwnAccount($db, $accountId, $sellerId);
    if (!$account) {
        http_response_code(404);
        echo json_encode(['message' => 'Account not found.']);
        exit;
    }

    // Prevent deleting primary if it is the only active account
    $countStmt = $db->prepare(
        "SELECT COUNT(*) FROM seller_remittance_accounts WHERE seller_id = ? AND is_active = 1"
    );
    $countStmt->execute([$sellerId]);
    $activeCount = (int)$countStmt->fetchColumn();

    if ($account['is_primary'] && $activeCount === 1) {
        http_response_code(400);
        echo json_encode(['message' => 'Cannot remove your only active payout account.']);
        exit;
    }

    $db->prepare(
        "UPDATE seller_remittance_accounts
         SET is_active = 0, is_primary = 0, updated_at = NOW()
         WHERE id = ? AND seller_id = ?"
    )->execute([$accountId, $sellerId]);

    // If we just deactivated the primary, promote the next one automatically
    if ($account['is_primary'] && $activeCount > 1) {
        $db->prepare(
            "UPDATE seller_remittance_accounts
             SET is_primary = 1
             WHERE seller_id = ? AND is_active = 1
             ORDER BY created_at ASC LIMIT 1"
        )->execute([$sellerId]);
    }

    echo json_encode(['message' => 'Account removed.']);
    exit;
}

http_response_code(405);
echo json_encode(['message' => 'Method not allowed.']);
