<?php
class Database {
    private $host = "localhost";
    private $db_name = "gssvbcrs_bago_marketplace";
    private $username = "gssvbcrs_bago_marketplace_user";
    private $password = "gssvbcrs_bago_marketplace_pass";
    public $conn;

    public function getConnection() {
        $this->conn = null;
        try {
            $this->conn = new PDO(
                "mysql:host=" . $this->host . ";dbname=" . $this->db_name,
                $this->username,
                $this->password
            );
            $this->conn->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
            $this->conn->exec("set names utf8mb4");
        } catch(PDOException $exception) {
            http_response_code(500);
            echo json_encode(["message" => "Database connection failed."]);
            exit;
        }
        return $this->conn;
    }
}
