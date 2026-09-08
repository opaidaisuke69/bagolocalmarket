<?php
class AuthMiddleware {
    private $db;
    private $secret_key = "bago_marketplace_secret_key_2024";

    public function __construct($db) {
        $this->db = $db;
    }

    public function generateToken($user_id, $role) {
        $header = json_encode(['typ' => 'JWT', 'alg' => 'HS256']);
        $payload = json_encode([
            'user_id' => $user_id,
            'role' => $role,
            'iat' => time(),
            'exp' => time() + (365 * 24 * 60 * 60) // 1 year
        ]);

        $base64Header = str_replace(['+', '/', '='], ['-', '_', ''], base64_encode($header));
        $base64Payload = str_replace(['+', '/', '='], ['-', '_', ''], base64_encode($payload));

        $signature = hash_hmac('sha256', $base64Header . "." . $base64Payload, $this->secret_key, true);
        $base64Signature = str_replace(['+', '/', '='], ['-', '_', ''], base64_encode($signature));

        return $base64Header . "." . $base64Payload . "." . $base64Signature;
    }

    public function validateToken() {
        $headers = getallheaders();
        $authHeader = '';
        
        // Check for Authorization header (case-insensitive)
        foreach ($headers as $key => $value) {
            if (strtolower($key) === 'authorization') {
                $authHeader = $value;
                break;
            }
        }
        
        // Fallback: check $_SERVER
        if (empty($authHeader)) {
            if (isset($_SERVER['HTTP_AUTHORIZATION'])) {
                $authHeader = $_SERVER['HTTP_AUTHORIZATION'];
            } elseif (isset($_SERVER['REDIRECT_HTTP_AUTHORIZATION'])) {
                $authHeader = $_SERVER['REDIRECT_HTTP_AUTHORIZATION'];
            }
        }

        if (empty($authHeader) || !preg_match('/Bearer\s(\S+)/', $authHeader, $matches)) {
            return null;
        }

        $token = $matches[1];
        $parts = explode('.', $token);

        if (count($parts) !== 3) {
            return null;
        }

        list($base64Header, $base64Payload, $base64Signature) = $parts;

        $signature = hash_hmac('sha256', $base64Header . "." . $base64Payload, $this->secret_key, true);
        $expectedSignature = str_replace(['+', '/', '='], ['-', '_', ''], base64_encode($signature));

        if (!hash_equals($expectedSignature, $base64Signature)) {
            return null;
        }

        $payload = json_decode(base64_decode(str_replace(['-', '_'], ['+', '/'], $base64Payload)), true);

        if ($payload['exp'] < time()) {
            return null;
        }

        return $payload;
    }

    public function requireAuth() {
        $payload = $this->validateToken();
        if (!$payload) {
            http_response_code(401);
            echo json_encode(["message" => "Unauthorized"]);
            exit;
        }
        return $payload;
    }

    public function requireRole($roles) {
        $payload = $this->requireAuth();
        if (!in_array($payload['role'], (array)$roles)) {
            http_response_code(403);
            echo json_encode(["message" => "Forbidden"]);
            exit;
        }
        return $payload;
    }
}
