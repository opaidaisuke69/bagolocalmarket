<?php
require_once '../config/cors.php';
require_once '../config/database.php';
require_once '../middleware/auth.php';

$database = new Database();
$db       = $database->getConnection();
$auth     = new AuthMiddleware($db);
$payload  = $auth->requireRole(['admin']);

$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'GET') {
    $status = isset($_GET['status']) ? $_GET['status'] : '';
    $search = isset($_GET['search']) ? $_GET['search'] : '';
    $page   = isset($_GET['page'])   ? (int)$_GET['page']  : 1;
    $limit  = isset($_GET['limit'])  ? (int)$_GET['limit'] : 20;
    $offset = ($page - 1) * $limit;

    $where  = "WHERE u.role = 'rider' AND u.deleted_at IS NULL";
    $params = [];

    if (!empty($status)) {
        $where .= " AND rp.approval_status = ?";
        $params[] = $status;
    }
    if (!empty($search)) {
        $where .= " AND (u.full_name LIKE ? OR u.email LIKE ?)";
        $params[] = "%$search%";
        $params[] = "%$search%";
    }

    $countStmt = $db->prepare(
        "SELECT COUNT(*) as total
         FROM users u
         LEFT JOIN rider_profiles rp ON u.id = rp.user_id
         $where"
    );
    $countStmt->execute($params);
    $total = $countStmt->fetch(PDO::FETCH_ASSOC)['total'];

    $stmt = $db->prepare(
        "SELECT u.id, u.full_name, u.email, u.contact_number, u.status AS account_status, u.created_at,
                rp.birthdate, rp.sex,
                rp.driver_license_image, rp.motorcycle_registration_image,
                rp.approval_status, rp.approved_at, rp.rejection_reason,
                (SELECT COUNT(*) FROM deliveries d
                 JOIN orders o ON d.order_id = o.id
                 WHERE d.rider_id = u.id AND o.status = 'delivered') AS total_deliveries,
                (SELECT COALESCE(SUM(o.rider_earning),0) FROM orders o
                 JOIN deliveries d ON d.order_id = o.id
                 WHERE d.rider_id = u.id AND o.status = 'delivered') AS total_earned
         FROM users u
         LEFT JOIN rider_profiles rp ON u.id = rp.user_id
         $where
         ORDER BY u.created_at DESC
         LIMIT $limit OFFSET $offset"
    );
    $stmt->execute($params);
    $riders = $stmt->fetchAll(PDO::FETCH_ASSOC);

    echo json_encode([
        "riders"      => $riders,
        "total"       => (int)$total,
        "page"        => $page,
        "total_pages" => ceil($total / max(1, $limit)),
    ]);

} elseif ($method === 'PUT') {
    $data = json_decode(file_get_contents("php://input"));

    if (empty($data->rider_id) || empty($data->action)) {
        http_response_code(400);
        echo json_encode(["message" => "rider_id and action are required."]);
        exit;
    }

    $validActions = ['approve', 'reject', 'ban', 'suspend', 'reactivate'];
    if (!in_array($data->action, $validActions)) {
        http_response_code(400);
        echo json_encode(["message" => "Invalid action."]);
        exit;
    }

    $reason = isset($data->reason) ? $data->reason : '';

    try {
        $db->beginTransaction();

        switch ($data->action) {
            case 'approve':
                // Auto-create rider_profiles table if missing
                try {
                    $db->exec("CREATE TABLE IF NOT EXISTS rider_profiles (
                        id INT AUTO_INCREMENT PRIMARY KEY,
                        user_id INT NOT NULL UNIQUE,
                        birthdate DATE NULL,
                        sex ENUM('male','female','other') NULL,
                        driver_license_image VARCHAR(500) NULL,
                        motorcycle_registration_image VARCHAR(500) NULL,
                        approval_status ENUM('pending','approved','rejected') DEFAULT 'pending',
                        approved_at TIMESTAMP NULL,
                        approved_by INT NULL,
                        rejection_reason TEXT NULL,
                        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
                    )");
                    // Ensure row exists for this rider before updating
                    $db->prepare("INSERT IGNORE INTO rider_profiles (user_id, approval_status) VALUES (?, 'pending')")
                       ->execute([$data->rider_id]);
                } catch (Exception $e) { /* table exists */ }

                $stmt = $db->prepare(
                    "UPDATE rider_profiles SET approval_status='approved', approved_at=NOW(), approved_by=? WHERE user_id=?"
                );
                $stmt->execute([$payload['user_id'], $data->rider_id]);
                $stmt = $db->prepare("UPDATE users SET status='active' WHERE id=?");
                $stmt->execute([$data->rider_id]);
                $msg = "Rider approved.";
                break;

            case 'reject':
                if (empty($reason)) $reason = 'Application does not meet requirements.';
                $stmt = $db->prepare(
                    "UPDATE rider_profiles SET approval_status='rejected', rejection_reason=? WHERE user_id=?"
                );
                $stmt->execute([$reason, $data->rider_id]);
                $msg = "Rider application rejected.";
                break;

            case 'ban':
                $stmt = $db->prepare("UPDATE users SET status='banned' WHERE id=?");
                $stmt->execute([$data->rider_id]);
                $msg = "Rider banned.";
                break;

            case 'suspend':
                $stmt = $db->prepare("UPDATE users SET status='suspended' WHERE id=?");
                $stmt->execute([$data->rider_id]);
                $msg = "Rider suspended.";
                break;

            case 'reactivate':
                $stmt = $db->prepare("UPDATE users SET status='active' WHERE id=?");
                $stmt->execute([$data->rider_id]);
                $msg = "Rider reactivated.";
                break;
        }

        // Admin log — non-fatal
        try {
            $stmt = $db->prepare(
                "INSERT INTO admin_logs (admin_id, action, target_type, target_id, details, ip_address)
                 VALUES (?, ?, 'rider', ?, ?, ?)"
            );
            $stmt->execute([
                $payload['user_id'],
                'rider_' . $data->action,
                $data->rider_id,
                $reason,
                isset($_SERVER['REMOTE_ADDR']) ? $_SERVER['REMOTE_ADDR'] : '',
            ]);
        } catch (Exception $logEx) { /* log table may differ */ }

        // Notify rider — non-fatal
        try {
            $stmt = $db->prepare(
                "INSERT INTO notifications (user_id, title, message, type) VALUES (?, 'Account Update', ?, 'account')"
            );
            $stmt->execute([$data->rider_id, $msg]);
        } catch (Exception $notifEx) { /* notifications table may differ */ }

        $db->commit();
        echo json_encode(["message" => $msg]);

    } catch (Exception $e) {
        $db->rollBack();
        http_response_code(500);
        echo json_encode(["message" => "Action failed: " . $e->getMessage()]);
    }
}
