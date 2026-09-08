<?php
require_once __DIR__ . '/../../vendor/autoload.php';

use PHPMailer\PHPMailer\PHPMailer;
use PHPMailer\PHPMailer\Exception;

class Mailer {

    // ── URL helpers ────────────────────────────────────────────────────────────
    // Returns the Apache/PHP server URL — where the API lives
    private static function getApiUrl(): string {
        $scheme   = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') ? 'https' : 'http';
        $hostname = strtok($_SERVER['HTTP_HOST'] ?? 'localhost', ':');
        $isLocal  = in_array($hostname, ['localhost', '127.0.0.1'])
            || preg_match('/^(10\.|192\.168\.|172\.(1[6-9]|2[0-9]|3[01])\.)/', $hostname);

        if ($isLocal) {
            // Always use localhost in dev so the email link opens on the dev machine
            // even when the API was called from a LAN IP (phone on same network)
            $scriptDir = dirname($_SERVER['SCRIPT_NAME'] ?? '');
            $parts     = explode('/', rtrim($scriptDir, '/'));
            $trimmed   = array_slice($parts, 0, max(1, count($parts) - 3));
            $subPath   = implode('/', $trimmed);
            return 'http://localhost' . $subPath;
        }

        return $scheme . '://' . $hostname; // production
    }

    // Returns the React frontend URL — Vite on :5173 locally, same domain on prod
    private static function getFrontendUrl(): string {
        $scheme   = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') ? 'https' : 'http';
        $hostname = strtok($_SERVER['HTTP_HOST'] ?? 'localhost', ':');
        $isLocal  = in_array($hostname, ['localhost', '127.0.0.1'])
            || preg_match('/^(10\.|192\.168\.|172\.(1[6-9]|2[0-9]|3[01])\.)/', $hostname);

        return $isLocal
            ? 'http://localhost:5173'       // Vite dev server always on localhost
            : $scheme . '://' . $hostname;  // production
    }

    // ── SMTP factory ──────────────────────────────────────────────────────────
    private static function make(): PHPMailer {
        $mail = new PHPMailer(true);
        $mail->isSMTP();
        $mail->Host       = 'mail.quickycloud.com';
        $mail->SMTPAuth   = true;
        $mail->Username   = 'localmarket-noreply@quickycloud.com';
        $mail->Password   = 'localmarket01';
        $mail->SMTPSecure = PHPMailer::ENCRYPTION_SMTPS; // SSL port 465
        $mail->Port       = 465;
        $mail->setFrom('localmarket-noreply@quickycloud.com', 'Bago City Marketplace');
        $mail->isHTML(true);
        $mail->CharSet = 'UTF-8';
        return $mail;
    }

    // ── Shared HTML wrapper ───────────────────────────────────────────────────
    private static function wrap(string $content): string {
        return '
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width,initial-scale=1">
          <style>
            body { margin:0; padding:0; background:#f3f4f6; font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif; }
            .container { max-width:560px; margin:32px auto; background:#fff; border-radius:16px; overflow:hidden; box-shadow:0 4px 24px rgba(0,0,0,.08); }
            .header  { background:linear-gradient(135deg,#0F2D69,#1a3f8f); padding:32px 40px; text-align:center; }
            .header h1 { color:#fff; margin:0; font-size:22px; font-weight:800; letter-spacing:.3px; }
            .header p  { color:rgba(255,255,255,.6); margin:8px 0 0; font-size:13px; }
            .body    { padding:36px 40px; }
            .btn     { display:inline-block; background:#0F2D69; color:#fff!important; text-decoration:none;
                       padding:14px 32px; border-radius:12px; font-weight:700; font-size:15px; margin:24px 0; }
            .footer  { background:#f9fafb; padding:20px 40px; text-align:center; color:#9ca3af; font-size:12px; border-top:1px solid #f0f0f0; }
            p  { color:#374151; font-size:14px; line-height:1.7; margin:0 0 12px; }
            .note { background:#fef9ec; border:1px solid #fde68a; border-radius:10px; padding:14px 18px; font-size:13px; color:#92400e; margin-top:20px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>🛒 Bago City Marketplace</h1>
              <p>Your local community marketplace</p>
            </div>
            <div class="body">' . $content . '</div>
            <div class="footer">
              © ' . date('Y') . ' Bago City Marketplace · Bago City, Negros Occidental<br>
              This email was sent automatically. Please do not reply.
            </div>
          </div>
        </body>
        </html>';
    }

    // ── Email Verification ────────────────────────────────────────────────────
    public static function sendVerification(string $toEmail, string $toName, string $token): bool {
        // Link goes directly to the PHP endpoint on Apache.
        // PHP verifies the token then redirects to the React page — works even without Vite.
        $apiBase = self::getApiUrl();
        $link    = $apiBase . '/server/api/auth/verify-email.php?token=' . urlencode($token);

        $content = '
          <p>Hi <strong>' . htmlspecialchars($toName) . '</strong>,</p>
          <p>Thanks for registering at Bago City Marketplace! Click the button below to verify your email address and activate your account.</p>
          <div style="text-align:center;">
            <a href="' . $link . '" class="btn">Verify Email Address</a>
          </div>
          <p>Or copy and paste this link into your browser:</p>
          <p style="word-break:break-all;font-size:12px;color:#6b7280;">' . $link . '</p>
          <div class="note">⏰ This link expires in <strong>24 hours</strong>. If you did not create an account, you can safely ignore this email.</div>';

        try {
            $mail = self::make();
            $mail->addAddress($toEmail, $toName);
            $mail->Subject = 'Verify your email — Bago City Marketplace';
            $mail->Body    = self::wrap($content);
            $mail->AltBody = "Hi $toName,\n\nVerify your email:\n$link\n\nThis link expires in 24 hours.";
            $mail->send();
            return true;
        } catch (Exception $e) {
            error_log('Mailer::sendVerification error: ' . $e->getMessage());
            return false;
        }
    }

    // ── Password Reset ────────────────────────────────────────────────────────
    public static function sendPasswordReset(string $toEmail, string $toName, string $token, string $appType = 'web'): bool {
        // Reset links go to the React frontend page (user needs to enter new password in a form)
        $frontend = self::getFrontendUrl();
        $webLink  = $frontend . '/reset-password?token=' . urlencode($token);
        if ($appType === 'rider') {
            $webLink .= '&app=rider';
        }

        $content = '
          <p>Hi <strong>' . htmlspecialchars($toName) . '</strong>,</p>
          <p>We received a request to reset your password. Click the button below to set a new password.</p>
          <div style="text-align:center;">
            <a href="' . $webLink . '" class="btn">Reset Password</a>
          </div>
          <p>Or copy this link:</p>
          <p style="word-break:break-all;font-size:12px;color:#6b7280;">' . $webLink . '</p>
          <div class="note">⏰ This link expires in <strong>1 hour</strong>. If you did not request a password reset, you can safely ignore this email — your password will not change.</div>';

        try {
            $mail = self::make();
            $mail->addAddress($toEmail, $toName);
            $mail->Subject = 'Reset your password — Bago City Marketplace';
            $mail->Body    = self::wrap($content);
            $mail->AltBody = "Hi $toName,\n\nReset your password:\n$webLink\n\nThis link expires in 1 hour.";
            $mail->send();
            return true;
        } catch (Exception $e) {
            error_log('Mailer::sendPasswordReset error: ' . $e->getMessage());
            return false;
        }
    }
}
