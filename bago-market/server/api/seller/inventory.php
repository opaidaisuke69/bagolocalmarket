<?php
/**
 * Seller Inventory API
 *
 * GET  ?search=&category=&stock_filter=&page=
 * PUT                                          — update single product / variation stock
 * POST action=bulk_update                      — bulk [{product_id, stock, variation_id?}…]
 */

error_reporting(E_ALL);
ini_set('display_errors', 0);
ini_set('log_errors', 1);

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

// ── Ensure product_variations exists (graceful) ───────────────────────────
$hasVariations = false;
try {
    $db->query("SELECT 1 FROM product_variations LIMIT 1");
    $hasVariations = true;
} catch (Exception $e) {
    $hasVariations = false;
}

// ── Quick sanity: verify seller has any products at all ───────────────────
// (helps debug auth vs no-products issues)
$debugTotal = 0;
try {
    $dStmt = $db->prepare("SELECT COUNT(*) FROM products WHERE seller_id = ? AND deleted_at IS NULL");
    $dStmt->execute([$sellerId]);
    $debugTotal = (int)$dStmt->fetchColumn();
} catch (Exception $e) {}

// =============================================================================
// GET — inventory list
// =============================================================================
if ($method === 'GET') {
    $page        = max(1, (int)($_GET['page']        ?? 1));
    $limit       = 50;
    $offset      = ($page - 1) * $limit;
    $search      = trim($_GET['search']       ?? '');
    $category    = trim($_GET['category']     ?? '');
    $stockFilter = trim($_GET['stock_filter'] ?? '');

    // Build WHERE — only join categories when filtering by name
    $whereParts = ["p.seller_id = ?", "p.deleted_at IS NULL"];
    $params     = [$sellerId];

    if ($search !== '') {
        $whereParts[] = "p.name LIKE ?";
        $params[]     = "%$search%";
    }
    if ($stockFilter === 'out') {
        $whereParts[] = "p.stock = 0";
    } elseif ($stockFilter === 'low') {
        $whereParts[] = "p.stock > 0 AND p.stock <= 10";
    } elseif ($stockFilter === 'ok') {
        $whereParts[] = "p.stock > 10";
    }

    $where = implode(' AND ', $whereParts);

    // Category filter needs the JOIN
    $joinCategory = '';
    if ($category !== '') {
        $joinCategory  = "LEFT JOIN categories c ON c.id = p.category_id";
        $whereParts[]  = "c.name = ?";
        $params[]      = $category;
        $where         = implode(' AND ', $whereParts);
    }

    // Count
    try {
        $cStmt = $db->prepare(
            "SELECT COUNT(*) FROM products p $joinCategory WHERE $where"
        );
        $cStmt->execute($params);
        $total = (int)$cStmt->fetchColumn();
    } catch (Exception $e) {
        http_response_code(500);
        echo json_encode(['message' => 'Count query failed: ' . $e->getMessage()]);
        exit;
    }

    // Products — always LEFT JOIN categories so we get the name
    try {
        $pStmt = $db->prepare(
            "SELECT
                p.id,
                p.name,
                p.price,
                p.stock,
                p.sold_count,
                p.approval_status,
                p.is_available,
                p.created_at,
                c.name AS category,
                c.id   AS category_id,
                (SELECT image_url
                 FROM product_images
                 WHERE product_id = p.id AND is_primary = 1
                 LIMIT 1) AS image
             FROM products p
             LEFT JOIN categories c ON c.id = p.category_id
             WHERE $where
             ORDER BY p.stock ASC, p.name ASC
             LIMIT $limit OFFSET $offset"
        );
        $pStmt->execute($params);
        $products = $pStmt->fetchAll(PDO::FETCH_ASSOC);
    } catch (Exception $e) {
        http_response_code(500);
        echo json_encode(['message' => 'Products query failed: ' . $e->getMessage()]);
        exit;
    }

    // Cast types & attach variations
    foreach ($products as &$p) {
        $p['stock']      = (int)$p['stock'];
        $p['sold_count'] = (int)$p['sold_count'];
        $p['price']      = (float)$p['price'];
        $p['variations'] = [];

        if ($hasVariations) {
            try {
                $vStmt = $db->prepare(
                    "SELECT id, product_id,
                            CONCAT(name, ' - ', value) AS label,
                            name, value, stock, price_adjustment
                     FROM product_variations
                     WHERE product_id = ?
                     ORDER BY name ASC, value ASC"
                );
                $vStmt->execute([$p['id']]);
                $vars = $vStmt->fetchAll(PDO::FETCH_ASSOC);
                foreach ($vars as &$v) {
                    $v['stock']            = (int)$v['stock'];
                    $v['price_adjustment'] = (float)$v['price_adjustment'];
                }
                unset($v);
                $p['variations'] = $vars;
            } catch (Exception $e) {
                $p['variations'] = [];
            }
        }
    }
    unset($p);

    // Category list for filter dropdown
    $categories = [];
    try {
        $catStmt = $db->prepare(
            "SELECT DISTINCT c.id, c.name
             FROM products p
             JOIN categories c ON c.id = p.category_id
             WHERE p.seller_id = ? AND p.deleted_at IS NULL
             ORDER BY c.name"
        );
        $catStmt->execute([$sellerId]);
        $categories = $catStmt->fetchAll(PDO::FETCH_ASSOC);
    } catch (Exception $e) { /* non-fatal */ }

    // Summary stats
    $stats = [
        'total_products' => 0, 'total_units' => 0, 'total_sold' => 0,
        'out_of_stock' => 0, 'low_stock' => 0, 'healthy' => 0,
    ];
    try {
        $stStmt = $db->prepare(
            "SELECT
                COUNT(*)                                   AS total_products,
                COALESCE(SUM(p.stock),      0)             AS total_units,
                COALESCE(SUM(p.sold_count), 0)             AS total_sold,
                COUNT(CASE WHEN p.stock = 0  THEN 1 END)  AS out_of_stock,
                COUNT(CASE WHEN p.stock > 0
                           AND p.stock <= 10 THEN 1 END)  AS low_stock,
                COUNT(CASE WHEN p.stock > 10 THEN 1 END)  AS healthy
             FROM products p
             WHERE p.seller_id = ? AND p.deleted_at IS NULL"
        );
        $stStmt->execute([$sellerId]);
        $stats = $stStmt->fetch(PDO::FETCH_ASSOC);
    } catch (Exception $e) { /* non-fatal */ }

    echo json_encode([
        'products'    => $products,
        'total'       => $total,
        'total_pages' => max(1, (int)ceil($total / $limit)),
        'page'        => $page,
        'categories'  => $categories,
        'stats'       => $stats,
        'debug'       => ['seller_id' => $sellerId, 'all_products_count' => $debugTotal, 'has_variations_table' => $hasVariations],
    ]);
    exit;
}

// =============================================================================
// PUT — single stock update
// =============================================================================
if ($method === 'PUT') {
    $data = json_decode(file_get_contents('php://input'), true);

    $productId   = (int)($data['product_id']   ?? 0);
    $variationId = (int)($data['variation_id'] ?? 0);
    $newStock    = (int)($data['stock']         ?? -1);

    if (!$productId || $newStock < 0) {
        http_response_code(400);
        echo json_encode(['message' => 'product_id and stock (>=0) required.']);
        exit;
    }

    // Ownership check
    $own = $db->prepare(
        "SELECT id FROM products WHERE id = ? AND seller_id = ? AND deleted_at IS NULL"
    );
    $own->execute([$productId, $sellerId]);
    if (!$own->fetch()) {
        http_response_code(403);
        echo json_encode(['message' => 'Product not found.']);
        exit;
    }

    try {
        if ($variationId && $hasVariations) {
            $db->prepare(
                "UPDATE product_variations SET stock = ? WHERE id = ? AND product_id = ?"
            )->execute([$newStock, $variationId, $productId]);

            // Re-sync base product stock
            $db->prepare(
                "UPDATE products
                 SET stock = (SELECT COALESCE(SUM(stock),0)
                              FROM product_variations WHERE product_id = ?)
                 WHERE id = ?"
            )->execute([$productId, $productId]);
        } else {
            $db->prepare(
                "UPDATE products SET stock = ? WHERE id = ? AND seller_id = ?"
            )->execute([$newStock, $productId, $sellerId]);
        }
        echo json_encode(['message' => 'Stock updated.']);
        log_activity($db, $sellerId, 'update_stock', 'product', $productId,
            "Updated stock for product #$productId" . ($variationId ? " variation #$variationId" : '') . " → $newStock units");
    } catch (Exception $e) {
        http_response_code(500);
        echo json_encode(['message' => 'Update failed: ' . $e->getMessage()]);
    }
    exit;
}

// =============================================================================
// POST — bulk update
// =============================================================================
if ($method === 'POST') {
    $data   = json_decode(file_get_contents('php://input'), true);
    $action = $data['action'] ?? '';

    if ($action !== 'bulk_update') {
        http_response_code(400);
        echo json_encode(['message' => 'action=bulk_update required.']);
        exit;
    }

    $items  = $data['items'] ?? [];
    $count  = 0;
    $errors = [];

    try {
        $db->beginTransaction();

        foreach ($items as $item) {
            $pid  = (int)($item['product_id']   ?? 0);
            $vid  = (int)($item['variation_id'] ?? 0);
            $stk  = (int)($item['stock']         ?? -1);

            if (!$pid || $stk < 0) { $errors[] = "Invalid (pid=$pid)"; continue; }

            $own = $db->prepare(
                "SELECT id FROM products WHERE id = ? AND seller_id = ? AND deleted_at IS NULL"
            );
            $own->execute([$pid, $sellerId]);
            if (!$own->fetch()) { $errors[] = "Product #$pid not found"; continue; }

            if ($vid && $hasVariations) {
                $db->prepare(
                    "UPDATE product_variations SET stock = ? WHERE id = ? AND product_id = ?"
                )->execute([$stk, $vid, $pid]);
                $db->prepare(
                    "UPDATE products
                     SET stock = (SELECT COALESCE(SUM(stock),0)
                                  FROM product_variations WHERE product_id = ?)
                     WHERE id = ?"
                )->execute([$pid, $pid]);
            } else {
                $db->prepare(
                    "UPDATE products SET stock = ? WHERE id = ? AND seller_id = ?"
                )->execute([$stk, $pid, $sellerId]);
            }
            $count++;
        }

        $db->commit();
        log_activity($db, $sellerId, 'bulk_update_stock', 'product', null,
            "Bulk stock update: $count product(s) updated" . (!empty($errors) ? " (" . count($errors) . " errors)" : ''));
        echo json_encode(['message' => "$count item(s) updated.", 'errors' => $errors]);
    } catch (Exception $e) {
        $db->rollBack();
        http_response_code(500);
        echo json_encode(['message' => 'Bulk update failed: ' . $e->getMessage()]);
    }
    exit;
}

http_response_code(405);
echo json_encode(['message' => 'Method not allowed.']);
