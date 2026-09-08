<?php
require_once '../config/cors.php';
require_once '../config/database.php';

// database.php sets Asia/Manila + MySQL +08:00

$database = new Database();
$db = $database->getConnection();

$token = $_GET['token'] ?? null;

// ── Detect whether the caller wants JSON (Axios/API call) or a browser redirect ──
// Axios sends Accept: application/json; browser links just send text/html
$wantsJson = false;
$accept = $_SERVER['HTTP_ACCEPT'] ?? '';
if (strpos($accept, 'application/json') !== false) {
    $wantsJson = true;
}
// Also treat it as JSON if called without a token (API usage)
// Always respond JSON when X-Requested-With is set
if (isset($_SERVER['HTTP_X_REQUESTED_WITH'])) {
    $wantsJson = true;
}

// Build the frontend base URL dynamically (same logic as mailer.php)
function getFrontendUrl(): string {
    $scheme   = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') ? 'https' : 'http';
    $hostname = strtok($_SERVER['HTTP_HOST'] ?? 'localhost', ':');
    $isLocal  = in_array($hostname, ['localhost', '127.0.0.1'])
        || preg_match('/^(10\.|192\.168\.|172\.(1[6-9]|2[0-9]|3[01])\.)/', $hostname);
    return $isLocal
        ? $scheme . '://' . $hostname . ':5173'
        : $scheme . '://' . $hostname;
}

function respond(int $code, string $msg, bool $json, string $status = 'error'): void {
    if ($json) {
        http_response_code($code);
        echo json_encode(['message' => $msg]);
    } else {
        // Redirect to React page with result encoded in query string
        $base = getFrontendUrl();
        $url  = $base . '/verify-email?result=' . urlencode($status) . '&msg=' . urlencode($msg);
        header('Location: ' . $url, true, 302);
    }
    exit;
}

if (empty($token)) {
    respond(400, 'Verification token is required.', $wantsJson, 'error');
}

// Look up token — use MySQL NOW() for expiry check (timezone-safe)
$stmt = $db->prepare("
    SELECT t.id, t.user_id, t.used_at,
           (t.expires_at < NOW()) AS is_expired
    FROM email_verification_tokens t
    WHERE t.token = ?
");
$stmt->execute([$token]);

if ($stmt->rowCount() === 0) {
    respond(404, 'Invalid verification link.', $wantsJson, 'error');
}

$row = $stmt->fetch(PDO::FETCH_ASSOC);

if ($row['used_at'] !== null) {
    // Token already used — check if email is actually verified
    $u = $db->prepare("SELECT email_verified_at FROM users WHERE id = ?");
    $u->execute([$row['user_id']]);
    $user = $u->fetch(PDO::FETCH_ASSOC);

    if ($user && $user['email_verified_at'] !== null) {
        respond(200, 'Your email is already verified. You can now log in.', $wantsJson, 'success');
    }
    respond(409, 'This link has already been used. Please request a new one.', $wantsJson, 'error');
}

if ((int)$row['is_expired'] === 1) {
    respond(410, 'Verification link has expired. Please request a new one.', $wantsJson, 'error');
}

// ── Verify ────────────────────────────────────────────────────────────────────
try {
    $db->beginTransaction();
    $db->prepare("UPDATE users SET email_verified_at = NOW() WHERE id = ?")->execute([$row['user_id']]);
    $db->prepare("UPDATE email_verification_tokens SET used_at = NOW() WHERE id = ?")->execute([$row['id']]);
    $db->commit();
    respond(200, 'Email verified successfully. You can now log in.', $wantsJson, 'success');
} catch (Exception $e) {
    $db->rollBack();
    respond(500, 'Verification failed. Please try again.', $wantsJson, 'error');
}
