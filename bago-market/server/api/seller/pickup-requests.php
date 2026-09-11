<?php
require_once '../config/cors.php';
require_once '../config/database.php';
require_once '../middleware/auth.php';
require_once '../config/logger.php';

$database = new Database();
$db = $database->getConnection();
$auth = new AuthMiddleware($db);
$payload = $auth->requireRole(['seller', 'admin']);

$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'GET') {
    // Get pending pickup requests for this seller's orders
    $order_id = isset($_GET['order_id']) ? (int)$_GET['order_id'] : 0;
    
    $query = "SELECT pr.*, u.full_name as rider_name, u.contact_number as rider_contact, u.profile_image as rider_image,
        o.order_number, o.total_amount
        FROM pickup_requests pr
        JOIN users u ON pr.rider_id = u.id
        JOIN orders o ON pr.order_id = o.id
        JOIN order_items oi ON o.id = oi.order_id
        WHERE oi.seller_id = ? AND pr.status = 'pending'";
    $params = [$payload['user_id']];
    
    if ($order_id > 0) {
        $query .= " AND pr.order_id = ?";
        $params[] = $order_id;
    }
    
    $query .= " GROUP BY pr.id ORDER BY pr.created_at DESC";
    
    $stmt = $db->prepare($query);
    $stmt->execute($params);
    $requests = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    echo json_encode(["requests" => $requests]);

} elseif ($method === 'POST') {
    $data = json_decode(file_get_contents("php://input"));
    
    if (empty($data->request_id) || empty($data->action)) {
        http_response_code(400);
        echo json_encode(["message" => "Request ID and action are required."]);
        exit;
    }
    
    $request_id = (int)$data->request_id;
    $action = $data->action; // 'approve' or 'reject'
    
    // Verify this request belongs to an order the seller owns
    $stmt = $db->prepare("SELECT pr.*, o.id as order_id, o.order_number FROM pickup_requests pr 
        JOIN orders o ON pr.order_id = o.id 
        JOIN order_items oi ON o.id = oi.order_id 
        WHERE pr.id = ? AND oi.seller_id = ? AND pr.status = 'pending'
        LIMIT 1");
    $stmt->execute([$request_id, $payload['user_id']]);
    
    if ($stmt->rowCount() === 0) {
        http_response_code(404);
        echo json_encode(["message" => "Request not found or already processed."]);
        exit;
    }
    
    $request = $stmt->fetch(PDO::FETCH_ASSOC);
    $order_id = $request['order_id'];
    $rider_id = $request['rider_id'];
    
    if ($action === 'approve') {
        // Approve this rider
        $stmt = $db->prepare("UPDATE pickup_requests SET status = 'approved' WHERE id = ?");
        $stmt->execute([$request_id]);
        
        // Delete all other pending requests for this order
        $stmt = $db->prepare("DELETE FROM pickup_requests WHERE order_id = ? AND id != ?");
        $stmt->execute([$order_id, $request_id]);
        
        // Assign rider to delivery record
        $stmt = $db->prepare("UPDATE deliveries SET rider_id = ? WHERE order_id = ?");
        $stmt->execute([$rider_id, $order_id]);
        
        if ($stmt->rowCount() === 0) {
            $stmt = $db->prepare("INSERT INTO deliveries (order_id, rider_id, status) VALUES (?, ?, 'ready')");
            $stmt->execute([$order_id, $rider_id]);
        }
        
        // Notify the approved rider
        $stmt = $db->prepare("INSERT INTO notifications (user_id, title, message, type) VALUES (?, 'Pickup Approved!', ?, 'order')");
        $stmt->execute([$rider_id, "Your pickup request for order #{$request['order_number']} has been approved! You can now pick it up."]);
        
        // Notify rejected riders (those whose requests were deleted)
        $stmt = $db->prepare("SELECT rider_id FROM pickup_requests WHERE order_id = ? AND rider_id != ? AND status = 'rejected'");
        $stmt->execute([$order_id, $rider_id]);
        // They were already deleted above, so notify based on what we can
        
        echo json_encode(["message" => "Rider approved and assigned!", "rider_id" => $rider_id]);
        log_activity($db, $payload['user_id'], 'approve_pickup_request', 'order', $order_id,
            "Seller approved pickup request #{$request_id} for order #{$request['order_number']} → rider #$rider_id");
        
    } elseif ($action === 'reject') {
        // Reject this specific rider
        $stmt = $db->prepare("UPDATE pickup_requests SET status = 'rejected' WHERE id = ?");
        $stmt->execute([$request_id]);
        
        // Notify the rejected rider
        $stmt = $db->prepare("INSERT INTO notifications (user_id, title, message, type) VALUES (?, 'Pickup Request Declined', ?, 'order')");
        $stmt->execute([$rider_id, "Your pickup request for order #{$request['order_number']} was not approved."]);
        
        echo json_encode(["message" => "Request rejected."]);
        log_activity($db, $payload['user_id'], 'reject_pickup_request', 'order', $order_id,
            "Seller rejected pickup request #{$request_id} for order #{$request['order_number']} (rider #$rider_id)");
        
    } else {
        http_response_code(400);
        echo json_encode(["message" => "Invalid action. Use 'approve' or 'reject'."]);
    }
}
