<?php
/**
 * OpenRouter AI Recommendation Engine  — v5
 * ──────────────────────────────────────────
 * PHP 7.4 compatible (no match(), no named args, no union types).
 *
 * CANDIDATE POOL STRATEGY (key fix over v4):
 *   The pool is built in four guaranteed slices so important products
 *   are ALWAYS present for the LLM to pick from:
 *
 *   Slice A — Products from user's interested categories (personalised)
 *   Slice B — Global best-selling products (top sold_count, all categories)
 *   Slice C — Global highest-rated products (rating >= 4.0, all categories)
 *   Slice D — Newest approved products (recency diversity)
 *
 *   Slices are merged, deduped, and capped at MAX_CANDIDATE_POOL.
 *   This guarantees best-sellers and high-rated items always reach the LLM.
 *
 * USER SIGNALS sent in the prompt:
 *   1. Recently viewed / browsed products  (view + click)
 *   2. Checkout / purchased category       (order_items)
 *   3. Add-to-cart category               (cart + add_to_cart interactions)
 *   4. Category affinity weighted score    (all interaction types)
 *   5. Most buyable (best-selling) in their categories
 *   6. High-rating products in their categories
 */



// Signal weights for category affinity
define('W_PURCHASE',       6.0);
define('W_CHECKOUT',       5.0);
define('W_ADD_TO_CART',    3.5);
define('W_WISHLIST',       2.5);
define('W_CATEGORY_VIEW',  2.0);
define('W_CLICK',          1.5);
define('W_VIEW',           1.0);

// ── Cache table ─────────────────────────────────────────────────────────────
function aiEnsureCacheTable(PDO $db) {
    try {
        $db->exec("CREATE TABLE IF NOT EXISTS ai_recommendation_cache (
            id           INT AUTO_INCREMENT PRIMARY KEY,
            cache_key    VARCHAR(128) NOT NULL,
            user_id      INT NULL,
            rec_type     VARCHAR(50)  NOT NULL,
            product_ids  TEXT         NOT NULL,
            ai_reasoning TEXT         NULL,
            model_used   VARCHAR(100) NULL,
            created_at   TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
            expires_at   TIMESTAMP    NULL,
            UNIQUE KEY uq_key    (cache_key),
            INDEX idx_user_type  (user_id, rec_type),
            INDEX idx_expires    (expires_at)
        )");
    } catch (Exception $e) {}
}

function aiGetCache(PDO $db, $cacheKey) {
    try {
        $stmt = $db->prepare(
            "SELECT product_ids FROM ai_recommendation_cache
             WHERE cache_key = ? AND (expires_at IS NULL OR expires_at > NOW())"
        );
        $stmt->execute(array($cacheKey));
        $row = $stmt->fetch(PDO::FETCH_ASSOC);
        if ($row) {
            $ids = json_decode($row['product_ids'], true);
            return is_array($ids) ? $ids : null;
        }
    } catch (Exception $e) {}
    return null;
}

function aiSetCache(PDO $db, $cacheKey, $userId, $recType, $productIds, $reasoning = '', $model = '') {
    try {
        $expires = date('Y-m-d H:i:s', strtotime('+' . AI_CACHE_TTL . ' minutes'));
        $stmt = $db->prepare(
            "INSERT INTO ai_recommendation_cache
               (cache_key, user_id, rec_type, product_ids, ai_reasoning, model_used, expires_at)
             VALUES (?,?,?,?,?,?,?)
             ON DUPLICATE KEY UPDATE
               product_ids  = VALUES(product_ids),
               ai_reasoning = VALUES(ai_reasoning),
               model_used   = VALUES(model_used),
               created_at   = NOW(),
               expires_at   = VALUES(expires_at)"
        );
        $stmt->execute(array($cacheKey, $userId, $recType,
            json_encode($productIds), $reasoning, $model, $expires));
    } catch (Exception $e) {}
}

// ── OpenRouter call ─────────────────────────────────────────────────────────
function callOpenRouter($prompt, $maxTokens = 800) {
    $payload = json_encode(array(
        'model'       => OPENROUTER_MODEL,
        'messages'    => array(
            array(
                'role'    => 'system',
                'content' => 'You are a content-based product recommendation engine for BagoMarketPlace, '
                           . 'a local e-commerce marketplace in Bago City, Philippines. '
                           . 'You receive user behaviour data and a product list. '
                           . 'Return ONLY valid JSON with no markdown, no prose.',
            ),
            array('role' => 'user', 'content' => $prompt),
        ),
        'max_tokens'  => $maxTokens,
        'temperature' => 0.2,
    ));

    $ch = curl_init(OPENROUTER_BASE_URL . '/chat/completions');
    curl_setopt_array($ch, array(
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_POST           => true,
        CURLOPT_POSTFIELDS     => $payload,
        CURLOPT_TIMEOUT        => 20,
        CURLOPT_HTTPHEADER     => array(
            'Authorization: Bearer ' . OPENROUTER_API_KEY,
            'Content-Type: application/json',
            'HTTP-Referer: https://bagomarket.local',
            'X-Title: BagoMarketPlace Recommendations',
        ),
    ));

    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    if (!$response || $httpCode !== 200) return null;

    $decoded   = json_decode($response, true);
    $content   = isset($decoded['choices'][0]['message']['content'])
                    ? $decoded['choices'][0]['message']['content'] : null;
    $usedModel = isset($decoded['model']) ? $decoded['model'] : OPENROUTER_MODEL;

    if (!$content) return null;

    $content = preg_replace('/^```(?:json)?\s*/i', '', trim($content));
    $content = preg_replace('/\s*```$/', '', $content);

    $parsed = json_decode($content, true);
    if (!is_array($parsed)) return null;

    return array('data' => $parsed, 'model' => $usedModel);
}

// ════════════════════════════════════════════════════════════════════════════
// USER CONTEXT  — gather all 6 signals
// ════════════════════════════════════════════════════════════════════════════
function buildUserContext(PDO $db, $userId) {

    // Signal 1: Recently viewed / browsed (view + click)
    $stmt = $db->prepare(
        "SELECT p.id, p.name, p.price, p.rating, p.sold_count,
                c.id AS category_id, c.name AS category,
                pi.interaction_type
         FROM product_interactions pi
         JOIN products   p ON pi.product_id = p.id
         JOIN categories c ON p.category_id = c.id
         WHERE pi.user_id = ?
           AND pi.interaction_type IN ('view','click')
           AND pi.created_at > DATE_SUB(NOW(), INTERVAL 30 DAY)
           AND p.deleted_at IS NULL
         ORDER BY pi.created_at DESC
         LIMIT " . MAX_RECENT_PRODUCTS
    );
    $stmt->execute(array($userId));
    $recentViewed = $stmt->fetchAll(PDO::FETCH_ASSOC);

    // Signal 2: Purchased / checked-out products
    $stmt = $db->prepare(
        "SELECT DISTINCT p.id, p.name, p.price,
                c.id AS category_id, c.name AS category
         FROM order_items oi
         JOIN orders     o  ON oi.order_id   = o.id
         JOIN products   p  ON oi.product_id = p.id
         JOIN categories c  ON p.category_id = c.id
         WHERE o.buyer_id = ? AND o.status NOT IN ('cancelled')
         ORDER BY o.created_at DESC
         LIMIT 20"
    );
    $stmt->execute(array($userId));
    $purchased = $stmt->fetchAll(PDO::FETCH_ASSOC);

    // Signal 3: Add-to-cart (live cart + recent interaction log)
    $stmt = $db->prepare(
        "SELECT p.id, p.name, p.price,
                c.id AS category_id, c.name AS category
         FROM cart_items ci
         JOIN carts      ca ON ci.cart_id    = ca.id
         JOIN products   p  ON ci.product_id = p.id
         JOIN categories c  ON p.category_id = c.id
         WHERE ca.user_id = ? AND p.deleted_at IS NULL"
    );
    $stmt->execute(array($userId));
    $cartLive = $stmt->fetchAll(PDO::FETCH_ASSOC);

    $stmt = $db->prepare(
        "SELECT DISTINCT p.id, p.name, p.price,
                c.id AS category_id, c.name AS category
         FROM product_interactions pi
         JOIN products   p ON pi.product_id = p.id
         JOIN categories c ON p.category_id = c.id
         WHERE pi.user_id = ?
           AND pi.interaction_type = 'add_to_cart'
           AND pi.created_at > DATE_SUB(NOW(), INTERVAL 14 DAY)
           AND p.deleted_at IS NULL
         ORDER BY pi.created_at DESC LIMIT 15"
    );
    $stmt->execute(array($userId));
    $cartInteraction = $stmt->fetchAll(PDO::FETCH_ASSOC);

    // Deduplicate cart items
    $allCartItems = array();
    foreach (array_merge($cartLive, $cartInteraction) as $item) {
        $allCartItems[$item['id']] = $item;
    }
    $allCartItems = array_values($allCartItems);

    // Signal 4: Category affinity (all interaction types, last 60 days)
    $stmt = $db->prepare(
        "SELECT p.category_id, c.name AS category, pi.interaction_type, COUNT(*) AS cnt
         FROM product_interactions pi
         JOIN products   p ON pi.product_id = p.id
         JOIN categories c ON p.category_id = c.id
         WHERE pi.user_id = ?
           AND pi.created_at > DATE_SUB(NOW(), INTERVAL 60 DAY)
         GROUP BY p.category_id, c.name, pi.interaction_type"
    );
    $stmt->execute(array($userId));
    $catRows = $stmt->fetchAll(PDO::FETCH_ASSOC);

    // Build weighted affinity map
    $catAffinity = array();
    foreach ($catRows as $row) {
        $cid  = $row['category_id'];
        $type = $row['interaction_type'];
        if ($type === 'purchase')            $w = W_PURCHASE;
        elseif ($type === 'add_to_cart')     $w = W_ADD_TO_CART;
        elseif ($type === 'add_to_wishlist') $w = W_WISHLIST;
        elseif ($type === 'category_view')   $w = W_CATEGORY_VIEW;
        elseif ($type === 'click')           $w = W_CLICK;
        else                                 $w = W_VIEW;
        if (!isset($catAffinity[$cid])) {
            $catAffinity[$cid] = array('name' => $row['category'], 'score' => 0.0);
        }
        $catAffinity[$cid]['score'] += $w * (int)$row['cnt'];
    }
    // Extra boost from purchases and cart
    foreach ($purchased as $p) {
        $cid = $p['category_id'];
        if (!isset($catAffinity[$cid])) $catAffinity[$cid] = array('name' => $p['category'], 'score' => 0.0);
        $catAffinity[$cid]['score'] += W_CHECKOUT;
    }
    foreach ($allCartItems as $item) {
        $cid = $item['category_id'];
        if (!isset($catAffinity[$cid])) $catAffinity[$cid] = array('name' => $item['category'], 'score' => 0.0);
        $catAffinity[$cid]['score'] += W_ADD_TO_CART;
    }
    uasort($catAffinity, function($a, $b) { return $b['score'] <=> $a['score']; });

    $topCatIds = array_slice(array_keys($catAffinity), 0, 6);

    // Signal 5: Best-selling in interested categories
    $bestSelling = array();
    if (!empty($topCatIds)) {
        $ph = implode(',', array_fill(0, count($topCatIds), '?'));
        $stmt = $db->prepare(
            "SELECT p.id, p.name, p.price, p.sold_count, p.rating, c.name AS category
             FROM products p JOIN categories c ON p.category_id = c.id
             WHERE p.category_id IN ($ph)
               AND p.approval_status = 'approved' AND p.is_available = 1 AND p.deleted_at IS NULL
             ORDER BY p.sold_count DESC LIMIT 10"
        );
        $stmt->execute($topCatIds);
        $bestSelling = $stmt->fetchAll(PDO::FETCH_ASSOC);
    }

    // Signal 6: High-rated in interested categories
    $highRated = array();
    if (!empty($topCatIds)) {
        $ph = implode(',', array_fill(0, count($topCatIds), '?'));
        $stmt = $db->prepare(
            "SELECT p.id, p.name, p.price, p.sold_count, p.rating, p.rating_count, c.name AS category
             FROM products p JOIN categories c ON p.category_id = c.id
             WHERE p.category_id IN ($ph)
               AND p.approval_status = 'approved' AND p.is_available = 1 AND p.deleted_at IS NULL
               AND p.rating >= 4.0
             ORDER BY p.rating DESC, p.rating_count DESC LIMIT 10"
        );
        $stmt->execute($topCatIds);
        $highRated = $stmt->fetchAll(PDO::FETCH_ASSOC);
    }

    // Already-delivered product IDs to exclude
    $stmt = $db->prepare(
        "SELECT DISTINCT oi.product_id FROM order_items oi
         JOIN orders o ON oi.order_id = o.id
         WHERE o.buyer_id = ? AND o.status = 'delivered'"
    );
    $stmt->execute(array($userId));
    $excludeIds = array_column($stmt->fetchAll(PDO::FETCH_ASSOC), 'product_id');

    return array(
        'recent_viewed' => $recentViewed,
        'purchased'     => $purchased,
        'cart_items'    => $allCartItems,
        'cat_affinity'  => $catAffinity,
        'top_cat_ids'   => $topCatIds,
        'best_selling'  => $bestSelling,
        'high_rated'    => $highRated,
        'exclude_ids'   => $excludeIds,
    );
}

// ════════════════════════════════════════════════════════════════════════════
// CANDIDATE POOL — four guaranteed slices so best-sellers & high-rated
// are ALWAYS in the pool regardless of user history
// ════════════════════════════════════════════════════════════════════════════
function getCandidatePool(PDO $db, $ctx) {
    $frag       = aiProductSelectFrag();
    $joins      = aiProductJoins();
    $baseWhere  = "p.approval_status = 'approved' AND p.is_available = 1 AND p.deleted_at IS NULL";
    $excludeIds = $ctx['exclude_ids'];
    $catIds     = $ctx['top_cat_ids'];

    $excClause  = '';
    $excParams  = array();
    if (!empty($excludeIds)) {
        $excPh     = implode(',', array_fill(0, count($excludeIds), '?'));
        $excClause = "AND p.id NOT IN ($excPh)";
        $excParams = $excludeIds;
    }

    $allRows  = array();
    $seenIds  = array();

    // ── Slice A: User's interested categories ────────────────────────────
    if (!empty($catIds)) {
        $catPh  = implode(',', array_fill(0, count($catIds), '?'));
        $params = array_merge($catIds, $excParams);
        $stmt   = $db->prepare(
            "SELECT $frag FROM products p $joins
             WHERE $baseWhere AND p.category_id IN ($catPh) $excClause
             ORDER BY
               (p.rating / 5.0) * 0.4
               + LEAST(p.sold_count / GREATEST((SELECT MAX(sold_count) FROM products WHERE deleted_at IS NULL), 1), 1.0) * 0.4
               + IF(p.created_at > DATE_SUB(NOW(), INTERVAL 14 DAY), 0.2, 0)
             DESC
             LIMIT " . SLICE_USER_CAT
        );
        $stmt->execute($params);
        foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) as $r) {
            if (!isset($seenIds[$r['id']])) { $allRows[] = $r; $seenIds[$r['id']] = 1; }
        }
    }

    // ── Slice B: Global best-selling (highest sold_count, any category) ──
    $params = $excParams;
    $stmt   = $db->prepare(
        "SELECT $frag FROM products p $joins
         WHERE $baseWhere $excClause
         ORDER BY p.sold_count DESC
         LIMIT " . SLICE_BEST_SELL
    );
    $stmt->execute($params);
    foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) as $r) {
        if (!isset($seenIds[$r['id']])) { $allRows[] = $r; $seenIds[$r['id']] = 1; }
    }

    // ── Slice C: Global highest-rated (rating >= 4.0, any category) ──────
    $params = $excParams;
    $stmt   = $db->prepare(
        "SELECT $frag FROM products p $joins
         WHERE $baseWhere AND p.rating >= 4.0 $excClause
         ORDER BY p.rating DESC, p.rating_count DESC
         LIMIT " . SLICE_HIGH_RATED
    );
    $stmt->execute($params);
    foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) as $r) {
        if (!isset($seenIds[$r['id']])) { $allRows[] = $r; $seenIds[$r['id']] = 1; }
    }

    // ── Slice D: Newest products (diversity / freshness) ─────────────────
    $params = $excParams;
    $stmt   = $db->prepare(
        "SELECT $frag FROM products p $joins
         WHERE $baseWhere $excClause
         ORDER BY p.created_at DESC
         LIMIT " . SLICE_NEWEST
    );
    $stmt->execute($params);
    foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) as $r) {
        if (!isset($seenIds[$r['id']])) { $allRows[] = $r; $seenIds[$r['id']] = 1; }
    }

    return array_slice($allRows, 0, MAX_CANDIDATE_POOL);
}

// ── Similar products candidate pool ─────────────────────────────────────────
function getSimilarCandidates(PDO $db, $productId) {
    $stmt = $db->prepare("SELECT category_id, price FROM products WHERE id = ? AND deleted_at IS NULL");
    $stmt->execute(array($productId));
    $ref = $stmt->fetch(PDO::FETCH_ASSOC);
    if (!$ref) return array();

    $frag  = aiProductSelectFrag();
    $joins = aiProductJoins();
    $where = "p.approval_status = 'approved' AND p.is_available = 1 AND p.deleted_at IS NULL";

    $priceMin = $ref['price'] * 0.4;
    $priceMax = $ref['price'] * 1.6;

    $stmt = $db->prepare(
        "SELECT $frag FROM products p $joins
         WHERE $where AND p.id != ? AND p.category_id = ? AND p.price BETWEEN ? AND ?
         ORDER BY p.rating DESC, p.sold_count DESC
         LIMIT " . MAX_CANDIDATE_POOL
    );
    $stmt->execute(array($productId, $ref['category_id'], $priceMin, $priceMax));
    $results = $stmt->fetchAll(PDO::FETCH_ASSOC);

    if (count($results) < 6) {
        $stmt = $db->prepare(
            "SELECT $frag FROM products p $joins
             WHERE $where AND p.id != ? AND p.category_id = ?
             ORDER BY p.rating DESC, p.sold_count DESC LIMIT " . MAX_CANDIDATE_POOL
        );
        $stmt->execute(array($productId, $ref['category_id']));
        $results = $stmt->fetchAll(PDO::FETCH_ASSOC);
    }

    return $results;
}

// ── SQL helpers ──────────────────────────────────────────────────────────────
function aiProductSelectFrag() {
    return "p.id, p.name, p.description, p.price, p.rating, p.rating_count,
            p.sold_count, p.view_count, p.stock, p.`condition`, p.brand, p.created_at,
            c.name AS category_name, c.slug AS category_slug,
            sp.store_name, u.full_name AS seller_name, b.name AS barangay_name,
            (SELECT image_url FROM product_images
             WHERE product_id = p.id AND is_primary = 1 LIMIT 1) AS primary_image";
}

function aiProductJoins() {
    return "LEFT JOIN categories      c  ON p.category_id = c.id
            LEFT JOIN users           u  ON p.seller_id   = u.id
            LEFT JOIN seller_profiles sp ON p.seller_id   = sp.user_id
            LEFT JOIN barangays       b  ON p.barangay_id = b.id";
}

function hydrateProducts(PDO $db, $ids) {
    if (empty($ids)) return array();
    $phs   = implode(',', array_fill(0, count($ids), '?'));
    $frag  = aiProductSelectFrag();
    $joins = aiProductJoins();
    $stmt  = $db->prepare(
        "SELECT $frag FROM products p $joins
         WHERE p.id IN ($phs) AND p.deleted_at IS NULL"
    );
    $stmt->execute($ids);
    $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);
    $map  = array();
    foreach ($rows as $r) { $map[(int)$r['id']] = $r; }
    $out  = array();
    foreach ($ids as $id) { if (isset($map[(int)$id])) $out[] = $map[(int)$id]; }
    return $out;
}

// ── Build the user profile text for the prompt ───────────────────────────────
function buildUserSummaryText($ctx) {
    $lines = array();

    // Category affinity ranking
    if (!empty($ctx['cat_affinity'])) {
        $cats = array();
        $rank = 1;
        foreach ($ctx['cat_affinity'] as $cid => $info) {
            $cats[] = "#{$rank} {$info['name']} (score=" . round($info['score'], 1) . ")";
            if (++$rank > 6) break;
        }
        $lines[] = 'Category interest ranking: ' . implode(', ', $cats);
    }

    // Recently viewed
    if (!empty($ctx['recent_viewed'])) {
        $names = array();
        foreach ($ctx['recent_viewed'] as $p) {
            $names[] = "{$p['name']} [{$p['category']}]";
        }
        $lines[] = 'Recently viewed: ' . implode(', ', array_slice(array_unique($names), 0, 8));
    }

    // Cart items
    if (!empty($ctx['cart_items'])) {
        $names = array_column($ctx['cart_items'], 'name');
        $cats  = array_unique(array_column($ctx['cart_items'], 'category'));
        $lines[] = 'In cart: ' . implode(', ', array_slice($names, 0, 5));
        $lines[] = 'Cart categories: ' . implode(', ', $cats);
    }

    // Purchases
    if (!empty($ctx['purchased'])) {
        $names = array_column($ctx['purchased'], 'name');
        $cats  = array_unique(array_column($ctx['purchased'], 'category'));
        $lines[] = 'Purchased: ' . implode(', ', array_slice($names, 0, 6));
        $lines[] = 'Purchased categories: ' . implode(', ', $cats);
    }

    // Best-selling in their categories (Signal 5)
    if (!empty($ctx['best_selling'])) {
        $items = array();
        foreach ($ctx['best_selling'] as $p) {
            $items[] = "ID:{$p['id']} {$p['name']} (sold={$p['sold_count']},rating={$p['rating']})";
        }
        $lines[] = 'Best-selling in your categories (PRIORITISE THESE): ' . implode(', ', array_slice($items, 0, 8));
    }

    // High-rated in their categories (Signal 6)
    if (!empty($ctx['high_rated'])) {
        $items = array();
        foreach ($ctx['high_rated'] as $p) {
            $items[] = "ID:{$p['id']} {$p['name']} (rating={$p['rating']},reviews={$p['rating_count']})";
        }
        $lines[] = 'Top-rated in your categories (PRIORITISE THESE): ' . implode(', ', array_slice($items, 0, 8));
    }

    if (empty($lines)) {
        return 'New user with no history. Pick based on highest sold_count first, then highest rating.';
    }

    return implode("\n", $lines);
}

// ════════════════════════════════════════════════════════════════════════════
// PUBLIC ENTRY POINT
// ════════════════════════════════════════════════════════════════════════════
function getAIRecommendations(PDO $db, $userId, $type, $limit, $productId = 0) {
    aiEnsureCacheTable($db);

    $bucket   = floor(time() / max(AI_CACHE_TTL * 60, 1));
    $cacheKey = md5("v5_{$userId}_{$type}_{$productId}_{$bucket}");

    if (AI_CACHE_TTL > 0) {
        $cachedIds = aiGetCache($db, $cacheKey);
        if ($cachedIds !== null) {
            return array(
                'products' => hydrateProducts($db, array_slice($cachedIds, 0, $limit)),
                'source'   => 'cache',
            );
        }
    }

    // Build candidates and user context
    if ($type === 'similar' && $productId > 0) {
        $candidates  = getSimilarCandidates($db, $productId);
        $userSummary = "User is viewing product ID {$productId}. Recommend the most similar items.";
    } elseif ($userId > 0) {
        $ctx         = buildUserContext($db, $userId);
        $candidates  = getCandidatePool($db, $ctx);
        $userSummary = buildUserSummaryText($ctx);
    } else {
        return array('products' => array(), 'source' => 'sql');
    }

    if (empty($candidates)) {
        return array('products' => array(), 'source' => 'sql');
    }

    // Build product table for prompt
    // Flag products that are best-sellers or high-rated so LLM knows to prioritise
    $bestSellingIds = array();
    $highRatedIds   = array();
    if ($userId > 0 && isset($ctx)) {
        foreach ($ctx['best_selling'] as $p) { $bestSellingIds[$p['id']] = true; }
        foreach ($ctx['high_rated']   as $p) { $highRatedIds[$p['id']]   = true; }
    }

    $lines = array();
    foreach ($candidates as $p) {
        $rating    = number_format((float)($p['rating']      ?? 0), 1);
        $ratingCnt = (int)($p['rating_count'] ?? 0);
        $price     = number_format((float)($p['price']       ?? 0), 0);
        $sold      = (int)($p['sold_count']   ?? 0);
        $cat       = isset($p['category_name']) ? $p['category_name'] : '';
        $cond      = isset($p['condition'])     ? $p['condition']     : 'new';
        $desc      = mb_substr(strip_tags(isset($p['description']) ? $p['description'] : ''), 0, 50);

        // Append tags so LLM knows which products are notable
        $tags = array();
        if (isset($bestSellingIds[$p['id']])) $tags[] = 'BEST_SELLER';
        if (isset($highRatedIds[$p['id']]))   $tags[] = 'HIGH_RATED';
        $tagStr = !empty($tags) ? ' [' . implode(',', $tags) . ']' : '';

        $lines[] = "ID:{$p['id']}|{$p['name']}{$tagStr}|{$cat}|P{$price}|r:{$rating}({$ratingCnt})|sold:{$sold}|{$cond}|{$desc}";
    }
    $productBlock = implode("\n", $lines);

    // Build prompt
    $prompt  = "=== USER PROFILE ===\n";
    $prompt .= $userSummary . "\n\n";
    $prompt .= "=== CANDIDATE PRODUCTS ===\n";
    $prompt .= "Format: ID|Name[tags]|Category|Price|rating(reviews)|sold|condition|description\n";
    $prompt .= "Tags: [BEST_SELLER] = top sold_count, [HIGH_RATED] = rating>=4.0\n";
    $prompt .= $productBlock . "\n\n";
    $prompt .= "=== TASK ===\n";
    $prompt .= "Select and rank exactly {$limit} product IDs as personalised recommendations.\n";
    $prompt .= "Ranking rules (apply in order):\n";
    $prompt .= "1. Products tagged [BEST_SELLER] in the user's top categories — always include these\n";
    $prompt .= "2. Products tagged [HIGH_RATED] in the user's top categories — always include these\n";
    $prompt .= "3. Products matching the user's recently viewed categories\n";
    $prompt .= "4. Products from the user's cart and purchased categories\n";
    $prompt .= "5. Fill remaining slots with highest sold_count globally\n";
    $prompt .= "6. Then highest rating globally\n";
    $prompt .= "Diversity rule: max 3 products per category.\n";
    $prompt .= "Return ONLY this JSON (no markdown):\n";
    $prompt .= "{\"recommended_ids\":[<exactly {$limit} IDs, best first>],\"reasoning\":\"<one sentence>\"}";

    $aiResult = callOpenRouter($prompt, 800);

    if ($aiResult !== null && !empty($aiResult['data']['recommended_ids'])) {
        $validPool = array_map('intval', array_column($candidates, 'id'));
        $rankedIds = array();
        foreach ($aiResult['data']['recommended_ids'] as $raw) {
            $id = (int)$raw;
            if (in_array($id, $validPool) && !in_array($id, $rankedIds)) {
                $rankedIds[] = $id;
            }
        }
        $rankedIds = array_slice($rankedIds, 0, $limit);

        if (!empty($rankedIds)) {
            // If LLM returned fewer than $limit, pad with best-sellers from pool
            if (count($rankedIds) < $limit) {
                // Sort candidates by sold_count desc for padding
                $sortedCandidates = $candidates;
                usort($sortedCandidates, function($a, $b) {
                    return (int)$b['sold_count'] - (int)$a['sold_count'];
                });
                foreach ($sortedCandidates as $c) {
                    if (count($rankedIds) >= $limit) break;
                    $id = (int)$c['id'];
                    if (!in_array($id, $rankedIds)) $rankedIds[] = $id;
                }
            }

            $reasoning = isset($aiResult['data']['reasoning']) ? $aiResult['data']['reasoning'] : '';
            $model     = isset($aiResult['model'])             ? $aiResult['model']             : OPENROUTER_MODEL;

            if (AI_CACHE_TTL > 0) {
                aiSetCache($db, $cacheKey, ($userId > 0 ? $userId : null), $type, $rankedIds, $reasoning, $model);
            }
            return array(
                'products' => hydrateProducts($db, $rankedIds),
                'source'   => 'ai',
                'model'    => $model,
            );
        }
    }

    // Fallback: return SQL pool sorted by sold_count desc, then rating desc
    usort($candidates, function($a, $b) {
        $soldDiff = (int)$b['sold_count'] - (int)$a['sold_count'];
        if ($soldDiff !== 0) return $soldDiff;
        return (float)$b['rating'] <=> (float)$a['rating'];
    });
    return array(
        'products' => array_slice($candidates, 0, $limit),
        'source'   => 'sql_fallback',
    );
}
