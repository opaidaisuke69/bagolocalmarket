<?php
// Set PHP timezone to Asia/Manila for all date/time operations
date_default_timezone_set('Asia/Manila');

class Database {
    private $host     = "localhost";
    private $db_name  = "bago_marketplace";
    private $username = "root";
    private $password = "";
    public  $conn;

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
            // Sync MySQL session timezone with PHP
            $this->conn->exec("SET time_zone = '+08:00'");
        } catch (PDOException $exception) {
            http_response_code(500);
            echo json_encode(["message" => "Database connection failed."]);
            exit;
        }
        return $this->conn;
    }
}
