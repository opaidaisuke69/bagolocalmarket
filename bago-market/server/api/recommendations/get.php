<?php
/**
 * AI Recommendations Engine — v3 (OpenRouter Edition)
 * ─────────────────────────────────────────────────────
 * GET /recommendations/get.php
 *   ?type=for_you|because_viewed|cart_picks|trending_barangay|similar|general
 *   &limit=12
 *   &product_id=X   (required for type=similar)
 *
 * AI Layer (OpenRouter):
 *   Types upgraded to AI:  for_you, similar
 *   Types kept as SQL:     because_viewed, cart_picks, trending_barangay, general
 *   Fallback:              All types fall back to SQL if AI is unavailable/errors
 *
 * AI Model: openrouter/auto  (free model routing via OpenRouter)
 * Cache:    30-minute result cache in ai_recommendation_cache table
 */
require_once '../config/cors.php';
require_once '../config/database.php';
require_once '../middleware/auth.php';
require_once __DIR__ . '/ai_engine.php';

// ── DB + Auth ─────────────────────────────────────────────────────────────────
$database = new Database();
$db       = $database->getConnection();

// Auto-migrate helper tables
try {
    $db->exec("CREATE TABLE IF NOT EXISTS product_interactions (
        id               INT AUTO_INCREMENT PRIMARY KEY,
        user_id          INT NOT NULL,
        product_id       INT NOT NULL,
        interaction_type ENUM('view','click','search','add_to_cart','remove_from_cart',
                              'add_to_wishlist','purchase','category_view') NOT NULL,
        metadata         JSON NULL,
        created_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_user      (user_id),
        INDEX idx_product   (product_id),
        INDEX idx_type_user (user_id, interaction_type),
        INDEX idx_created   (created_at)
    )");
    $db->exec("CREATE TABLE IF NOT EXISTS recommendation_logs (
        id                  INT AUTO_INCREMENT PRIMARY KEY,
        user_id             INT NOT NULL,
        product_id          INT NOT NULL,
        recommendation_type VARCHAR(50) NOT NULL,
        score               DECIMAL(6,4) DEFAULT 0,
        created_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_user (user_id),
        INDEX idx_type (recommendation_type)
    )");
} catch (Exception $e) { /* already exists */ }

$auth    = new AuthMiddleware($db);
$payload = $auth->validateToken();   // nullable — works for guests too

$type      = isset($_GET['type'])       ? $_GET['type']                : 'general';
$limit     = isset($_GET['limit'])      ? min((int)$_GET['limit'], 40) : 12;
$productId = isset($_GET['product_id']) ? (int)$_GET['product_id']     : 0;
$userId    = $payload ? (int)$payload['user_id'] : 0;

$recommendations = [];
$source          = 'sql';

// ── Route to AI or SQL engine ─────────────────────────────────────────────────
if ($payload) {
    switch ($type) {
        // ── AI-powered types ────────────────────────────────────────────────
        case 'for_you':
            $aiResult = getAIRecommendations($db, $userId, 'for_you', $limit);
            if (!empty($aiResult['products'])) {
                $recommendations = $aiResult['products'];
                $source          = $aiResult['source'];
            } else {
                // SQL fallback
                $recommendations = getForYouRecommendations($db, $userId, $limit);
                $source          = 'sql';
            }
            break;

        case 'similar':
            if ($productId > 0) {
                $aiResult = getAIRecommendations($db, $userId, 'similar', $limit, $productId);
                if (!empty($aiResult['products'])) {
                    $recommendations = $aiResult['products'];
                    $source          = $aiResult['source'];
                } else {
                    $recommendations = getSimilarProducts($db, $productId, $userId, $limit);
                    $source          = 'sql';
                }
            } else {
                $aiResult = getAIRecommendations($db, $userId, 'for_you', $limit);
                $recommendations = !empty($aiResult['products'])
                    ? $aiResult['products']
                    : getForYouRecommendations($db, $userId, $limit);
                $source = $recommendations === ($aiResult['products'] ?? []) ? ($aiResult['source'] ?? 'sql') : 'sql';
            }
            break;

        // ── SQL-powered types (no AI overhead needed) ───────────────────────
        case 'because_viewed':
            $recommendations = getBecauseViewedRecommendations($db, $userId, $limit);
            break;

        case 'cart_picks':
            $recommendations = getCartBasedRecommendations($db, $userId, $limit);
            break;

        case 'trending_barangay':
            $recommendations = getTrendingInBarangay($db, $userId, $limit);
            break;

        default:
            $recommendations = getPopularRecommendations($db, $limit);
    }
} else {
    // Guest user
    switch ($type) {
        case 'similar':
            $recommendations = $productId > 0
                ? getSimilarProducts($db, $productId, null, $limit)
                : getPopularRecommendations($db, $limit);
            break;
        default:
            $recommendations = getPopularRecommendations($db, $limit);
    }
    $source = 'sql';
}

echo json_encode([
    'recommendations' => $recommendations,
    'type'            => $type,
    'count'           => count($recommendations),
    'source'          => $source,  // 'ai' | 'cache' | 'sql' | 'sql_fallback'
]);

// ═════════════════════════════════════════════════════════════════════════════
// SQL Engine Functions (v2 — retained as fallback and for non-AI types)
// ═════════════════════════════════════════════════════════════════════════════

function productSelectFragment(): string {
    return "p.id, p.name, p.price, p.rating, p.sold_count, p.view_count,
            p.category_id, p.seller_id, p.created_at,
            (SELECT image_url FROM product_images WHERE product_id = p.id AND is_primary = 1 LIMIT 1) AS primary_image,
            c.name   AS category_name, c.slug AS category_slug,
            sp.store_name,
            u.full_name AS seller_name,
            b.name   AS barangay_name";
}

function productJoins(): string {
    return "LEFT JOIN categories      c  ON p.category_id = c.id
            LEFT JOIN users           u  ON p.seller_id   = u.id
            LEFT JOIN seller_profiles sp ON p.seller_id   = sp.user_id
            LEFT JOIN barangays       b  ON p.barangay_id = b.id";
}

function baseWhereClause(): string {
    return "p.approval_status = 'approved' AND p.is_available = 1 AND p.deleted_at IS NULL";
}

// ── 1. FOR YOU (SQL) ──────────────────────────────────────────────────────────
function getForYouRecommendations(PDO $db, int $userId, int $limit): array {
    $stmt = $db->prepare(
        "SELECT p.category_id,
                SUM(CASE
                    WHEN pi.interaction_type = 'purchase'         THEN 5
                    WHEN pi.interaction_type = 'add_to_cart'      THEN 3
                    WHEN pi.interaction_type = 'add_to_wishlist'  THEN 2.5
                    WHEN pi.interaction_type = 'category_view'    THEN 2
                    WHEN pi.interaction_type = 'click'            THEN 1.5
                    ELSE 1 END
                * POW(0.9, DATEDIFF(NOW(), pi.created_at) / 7.0)) AS score
         FROM product_interactions pi
         JOIN products p ON pi.product_id = p.id
         WHERE pi.user_id = ? AND pi.created_at > DATE_SUB(NOW(), INTERVAL 60 DAY)
         GROUP BY p.category_id
         ORDER BY score DESC LIMIT 8"
    );
    $stmt->execute([$userId]);
    $catRows = $stmt->fetchAll(PDO::FETCH_ASSOC);

    if (empty($catRows)) return getPopularRecommendations($db, $limit);

    $excludeStmt = $db->prepare(
        "SELECT DISTINCT oi.product_id FROM order_items oi
         JOIN orders o ON oi.order_id = o.id
         WHERE o.buyer_id = ? AND o.status IN ('delivered','shipped','out_for_delivery')"
    );
    $excludeStmt->execute([$userId]);
    $excludeIds = array_column($excludeStmt->fetchAll(PDO::FETCH_ASSOC), 'product_id');

    $sellerStmt = $db->prepare(
        "SELECT p.seller_id FROM product_interactions pi
         JOIN products p ON pi.product_id = p.id
         WHERE pi.user_id = ?
           AND pi.interaction_type IN ('view','click','add_to_cart','purchase')
           AND pi.created_at > DATE_SUB(NOW(), INTERVAL 30 DAY)
         GROUP BY p.seller_id ORDER BY COUNT(*) DESC LIMIT 5"
    );
    $sellerStmt->execute([$userId]);
    $affinitySellerIds = array_column($sellerStmt->fetchAll(PDO::FETCH_ASSOC), 'seller_id');

    $addrStmt = $db->prepare(
        "SELECT a.barangay_id FROM addresses a
         WHERE a.user_id = ? AND a.deleted_at IS NULL
         ORDER BY a.is_default DESC, a.created_at DESC LIMIT 1"
    );
    $addrStmt->execute([$userId]);
    $addr = $addrStmt->fetch(PDO::FETCH_ASSOC);
    if (!$addr) {
        $bp = $db->prepare("SELECT barangay_id FROM buyer_profiles WHERE user_id = ?");
        $bp->execute([$userId]);
        $addr = $bp->fetch(PDO::FETCH_ASSOC);
    }
    $userBarangayId = $addr ? (int)$addr['barangay_id'] : 0;

    $categoryIds     = array_column($catRows, 'category_id');
    $catPlaceholders = implode(',', array_fill(0, count($categoryIds), '?'));

    $excludeClause = '';
    $params        = $categoryIds;
    if (!empty($excludeIds)) {
        $excludeClause = 'AND p.id NOT IN (' . implode(',', array_fill(0, count($excludeIds), '?')) . ')';
        $params        = array_merge($params, $excludeIds);
    }

    $catScoreCase = 'CASE p.category_id';
    foreach ($catRows as $cr) {
        $catScoreCase .= sprintf(' WHEN %d THEN %.4f', $cr['category_id'], min((float)$cr['score'] / 10.0, 1.0));
    }
    $catScoreCase .= ' ELSE 0 END';

    $sellerIn   = empty($affinitySellerIds) ? '0' : implode(',', array_map('intval', $affinitySellerIds));
    $sellerCase = "CASE WHEN p.seller_id IN ($sellerIn) THEN 0.15 ELSE 0 END";
    $locBoost   = $userBarangayId > 0
        ? "CASE WHEN p.barangay_id = $userBarangayId THEN 0.10 ELSE 0 END"
        : '0';

    $frag  = productSelectFragment();
    $joins = productJoins();
    $where = baseWhereClause();

    $query = "SELECT $frag,
                ($catScoreCase * 0.45
                 + (p.rating / 5.0) * 0.20
                 + $sellerCase
                 + $locBoost
                 + IF(p.created_at > DATE_SUB(NOW(), INTERVAL 30 DAY), 0.10, 0)) AS rec_score
              FROM products p $joins
              WHERE $where AND p.category_id IN ($catPlaceholders) $excludeClause
              ORDER BY rec_score DESC, p.sold_count DESC
              LIMIT $limit";

    $stmt = $db->prepare($query);
    $stmt->execute($params);
    $results = $stmt->fetchAll(PDO::FETCH_ASSOC);

    if (!empty($results)) {
        $logStmt = $db->prepare(
            "INSERT INTO recommendation_logs (user_id, product_id, recommendation_type, score)
             VALUES (?, ?, 'for_you', ?)"
        );
        foreach ($results as $r) {
            try { $logStmt->execute([$userId, $r['id'], $r['rec_score'] ?? 0]); } catch (Exception $e) {}
        }
    }

    return $results;
}

// ── 2. BECAUSE YOU VIEWED (SQL) ───────────────────────────────────────────────
function getBecauseViewedRecommendations(PDO $db, int $userId, int $limit): array {
    $stmt = $db->prepare(
        "SELECT DISTINCT p.id AS viewed_id, p.category_id, p.price
         FROM product_interactions pi
         JOIN products p ON pi.product_id = p.id
         WHERE pi.user_id = ? AND pi.interaction_type IN ('view','click')
           AND p.approval_status = 'approved'
         ORDER BY pi.created_at DESC LIMIT 5"
    );
    $stmt->execute([$userId]);
    $viewed = $stmt->fetchAll(PDO::FETCH_ASSOC);

    if (empty($viewed)) return getPopularRecommendations($db, $limit);

    $viewedIds       = array_column($viewed, 'viewed_id');
    $categoryIds     = array_unique(array_column($viewed, 'category_id'));
    $avgPrice        = array_sum(array_column($viewed, 'price')) / count($viewed);
    $minPrice        = $avgPrice * 0.4;
    $maxPrice        = $avgPrice * 1.6;
    $catPlaceholders = implode(',', array_fill(0, count($categoryIds), '?'));
    $excPlaceholders = implode(',', array_fill(0, count($viewedIds), '?'));

    $frag  = productSelectFragment();
    $joins = productJoins();
    $where = baseWhereClause();

    $stmt = $db->prepare(
        "SELECT $frag FROM products p $joins
         WHERE $where AND p.category_id IN ($catPlaceholders)
           AND p.id NOT IN ($excPlaceholders) AND p.price BETWEEN ? AND ?
         ORDER BY p.rating DESC, p.sold_count DESC LIMIT $limit"
    );
    $stmt->execute(array_merge($categoryIds, $viewedIds, [$minPrice, $maxPrice]));
    return $stmt->fetchAll(PDO::FETCH_ASSOC);
}

// ── 3. CART-BASED PICKS (SQL) ─────────────────────────────────────────────────
function getCartBasedRecommendations(PDO $db, int $userId, int $limit): array {
    $cartStmt = $db->prepare(
        "SELECT p.id, p.category_id, p.price
         FROM cart_items ci
         JOIN carts ca ON ci.cart_id = ca.id
         JOIN products p ON ci.product_id = p.id
         WHERE ca.user_id = ? AND p.approval_status = 'approved' AND p.deleted_at IS NULL"
    );
    $cartStmt->execute([$userId]);
    $cartItems = $cartStmt->fetchAll(PDO::FETCH_ASSOC);

    $recentStmt = $db->prepare(
        "SELECT DISTINCT p.id, p.category_id, p.price
         FROM product_interactions pi
         JOIN products p ON pi.product_id = p.id
         WHERE pi.user_id = ? AND pi.interaction_type = 'add_to_cart'
           AND pi.created_at > DATE_SUB(NOW(), INTERVAL 14 DAY)
           AND p.approval_status = 'approved'
         ORDER BY pi.created_at DESC LIMIT 5"
    );
    $recentStmt->execute([$userId]);
    $recentCart = $recentStmt->fetchAll(PDO::FETCH_ASSOC);

    $allItems = array_merge($cartItems, $recentCart);
    if (empty($allItems)) return getForYouRecommendations($db, $userId, $limit);

    $cartIds      = array_unique(array_column($allItems, 'id'));
    $categoryIds  = array_unique(array_column($allItems, 'category_id'));
    $avgPrice     = array_sum(array_column($allItems, 'price')) / count($allItems);
    $minPrice     = $avgPrice * 0.35;
    $maxPrice     = $avgPrice * 1.65;

    $catPh  = implode(',', array_fill(0, count($categoryIds), '?'));
    $cartPh = implode(',', array_fill(0, count($cartIds), '?'));

    $frag  = productSelectFragment();
    $joins = productJoins();
    $where = baseWhereClause();

    $stmt = $db->prepare(
        "SELECT $frag FROM products p $joins
         WHERE $where AND p.category_id IN ($catPh) AND p.id NOT IN ($cartPh)
           AND p.price BETWEEN ? AND ?
         ORDER BY p.rating DESC, p.sold_count DESC LIMIT $limit"
    );
    $stmt->execute(array_merge($categoryIds, $cartIds, [$minPrice, $maxPrice]));
    $results = $stmt->fetchAll(PDO::FETCH_ASSOC);

    if (count($results) < 4) {
        $stmt = $db->prepare(
            "SELECT $frag FROM products p $joins
             WHERE $where AND p.category_id IN ($catPh) AND p.id NOT IN ($cartPh)
             ORDER BY p.rating DESC, p.sold_count DESC LIMIT $limit"
        );
        $stmt->execute(array_merge($categoryIds, $cartIds));
        $results = $stmt->fetchAll(PDO::FETCH_ASSOC);
    }

    return $results;
}

// ── 4. SIMILAR PRODUCTS (SQL) ─────────────────────────────────────────────────
function getSimilarProducts(PDO $db, int $productId, ?int $userId, int $limit): array {
    $stmt = $db->prepare("SELECT category_id, price, seller_id FROM products WHERE id = ? AND deleted_at IS NULL");
    $stmt->execute([$productId]);
    $product = $stmt->fetch(PDO::FETCH_ASSOC);
    if (!$product) return getPopularRecommendations($db, $limit);

    $priceMin = $product['price'] * 0.50;
    $priceMax = $product['price'] * 1.50;

    $frag  = productSelectFragment();
    $joins = productJoins();
    $where = baseWhereClause();

    $stmt = $db->prepare(
        "SELECT $frag FROM products p $joins
         WHERE $where AND p.id != ? AND p.category_id = ? AND p.price BETWEEN ? AND ?
         ORDER BY p.rating DESC, p.sold_count DESC LIMIT $limit"
    );
    $stmt->execute([$productId, $product['category_id'], $priceMin, $priceMax]);
    $results = $stmt->fetchAll(PDO::FETCH_ASSOC);

    if (count($results) < 4) {
        $stmt = $db->prepare(
            "SELECT $frag FROM products p $joins
             WHERE $where AND p.id != ? AND p.category_id = ?
             ORDER BY p.rating DESC, p.sold_count DESC LIMIT $limit"
        );
        $stmt->execute([$productId, $product['category_id']]);
        $results = $stmt->fetchAll(PDO::FETCH_ASSOC);
    }

    return $results;
}

// ── 5. TRENDING IN BARANGAY (SQL) ─────────────────────────────────────────────
function getTrendingInBarangay(PDO $db, int $userId, int $limit): array {
    $stmt = $db->prepare(
        "SELECT a.barangay_id FROM addresses a
         WHERE a.user_id = ? AND a.deleted_at IS NULL
         ORDER BY a.is_default DESC, a.created_at DESC LIMIT 1"
    );
    $stmt->execute([$userId]);
    $addr = $stmt->fetch(PDO::FETCH_ASSOC);
    if (!$addr) {
        $stmt = $db->prepare("SELECT barangay_id FROM buyer_profiles WHERE user_id = ?");
        $stmt->execute([$userId]);
        $addr = $stmt->fetch(PDO::FETCH_ASSOC);
    }
    if (!$addr || !$addr['barangay_id']) return getPopularRecommendations($db, $limit);

    $barangayId = (int)$addr['barangay_id'];
    $frag  = productSelectFragment();
    $joins = productJoins();
    $where = baseWhereClause();

    $stmt = $db->prepare(
        "SELECT $frag, COUNT(oi.id) AS order_count
         FROM products p $joins
         JOIN order_items oi ON oi.product_id = p.id
         JOIN orders     o  ON oi.order_id    = o.id
         JOIN addresses  a  ON o.address_id   = a.id
         WHERE $where AND a.barangay_id = ?
           AND o.created_at > DATE_SUB(NOW(), INTERVAL 30 DAY)
           AND o.status NOT IN ('cancelled','refunded')
         GROUP BY p.id ORDER BY order_count DESC, p.rating DESC LIMIT $limit"
    );
    $stmt->execute([$barangayId]);
    $results = $stmt->fetchAll(PDO::FETCH_ASSOC);

    if (count($results) < 4) {
        $stmt = $db->prepare(
            "SELECT $frag FROM products p $joins
             WHERE $where AND p.barangay_id = ?
             ORDER BY p.sold_count DESC, p.rating DESC LIMIT $limit"
        );
        $stmt->execute([$barangayId]);
        $results = $stmt->fetchAll(PDO::FETCH_ASSOC);
    }

    return !empty($results) ? $results : getPopularRecommendations($db, $limit);
}

// ── 6. POPULAR FALLBACK (SQL) ─────────────────────────────────────────────────
function getPopularRecommendations(PDO $db, int $limit): array {
    $frag  = productSelectFragment();
    $joins = productJoins();
    $where = baseWhereClause();

    $stmt = $db->prepare(
        "SELECT $frag,
                (0.5 * LEAST(p.sold_count / 100.0, 1.0)
                 + 0.3 * (p.rating / 5.0)
                 + 0.2 * IF(p.created_at > DATE_SUB(NOW(), INTERVAL 14 DAY), 1, 0)) AS pop_score
         FROM products p $joins WHERE $where
         ORDER BY pop_score DESC, p.sold_count DESC LIMIT $limit"
    );
    $stmt->execute();
    return $stmt->fetchAll(PDO::FETCH_ASSOC);
}
