-- ═══════════════════════════════════════════════════════════════════════════
-- Bago City Barangay-to-Barangay Distance Seed (v2)
-- Formula: ₱25 base (0–5 km) + ₱5/km beyond 5 km, rounded up
--
-- Run this once against bago_marketplace to populate barangay_distances.
-- Safe to re-run: uses INSERT … ON DUPLICATE KEY UPDATE.
-- ═══════════════════════════════════════════════════════════════════════════

USE bago_marketplace;

-- ── 1. Ensure all 24 barangays exist (exact names used in the app) ────────────
INSERT IGNORE INTO barangays (name) VALUES
  ('Abuanan'),
  ('Alianza'),
  ('Atipuluan'),
  ('Bacong-Montilla'),
  ('Bagroy'),
  ('Balingasag'),
  ('Binubuhan'),
  ('Busay'),
  ('Calumangan'),
  ('Caridad'),
  ('Dulao'),
  ('Ilijan'),
  ('Jorge L. Araneta'),
  ('Lag-Asan'),
  ('Ma-ao Barrio'),
  ('Mailum'),
  ('Malingin'),
  ('Napoles'),
  ('Pacol'),
  ('Poblacion'),
  ('Sagasa'),
  ('Sampinit'),
  ('Tabunan'),
  ('Taloc');

-- ── 2. Ensure distance table exists ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS barangay_distances (
    id               INT AUTO_INCREMENT PRIMARY KEY,
    from_barangay_id INT NOT NULL,
    to_barangay_id   INT NOT NULL,
    distance_km      DECIMAL(6,2) NOT NULL DEFAULT 0.00,
    UNIQUE KEY uk_route (from_barangay_id, to_barangay_id),
    INDEX idx_from (from_barangay_id),
    INDEX idx_to   (to_barangay_id)
);

-- ── 3. Seed via stored procedure ──────────────────────────────────────────────
DROP PROCEDURE IF EXISTS seed_distances_v2;

DELIMITER $$
CREATE PROCEDURE seed_distances_v2()
BEGIN
    -- Upper-triangle distances from the matrix
    -- Columns/rows order: Abuanan, Alianza, Atipuluan, Bacong-Montilla, Bagroy,
    --   Balingasag, Binubuhan, Busay, Calumangan, Caridad, Dulao, Ilijan,
    --   Jorge L. Araneta, Lag-Asan, Ma-ao Barrio, Mailum, Malingin, Napoles,
    --   Pacol, Poblacion, Sagasa, Sampinit, Tabunan, Taloc

    INSERT INTO barangay_distances (from_barangay_id, to_barangay_id, distance_km)
    SELECT f.id, t.id, d.km
    FROM (
        -- Abuanan →
        SELECT 'Abuanan' fn, 'Alianza'          tn,  8.86 km UNION ALL
        SELECT 'Abuanan','Atipuluan',                  4.16 UNION ALL
        SELECT 'Abuanan','Bacong-Montilla',             4.82 UNION ALL
        SELECT 'Abuanan','Bagroy',                     13.99 UNION ALL
        SELECT 'Abuanan','Balingasag',                 16.14 UNION ALL
        SELECT 'Abuanan','Binubuhan',                   7.87 UNION ALL
        SELECT 'Abuanan','Busay',                      11.75 UNION ALL
        SELECT 'Abuanan','Calumangan',                 13.14 UNION ALL
        SELECT 'Abuanan','Caridad',                    10.33 UNION ALL
        SELECT 'Abuanan','Dulao',                       4.85 UNION ALL
        SELECT 'Abuanan','Ilijan',                     10.69 UNION ALL
        SELECT 'Abuanan','Jorge L. Araneta',            7.33 UNION ALL
        SELECT 'Abuanan','Lag-Asan',                   16.62 UNION ALL
        SELECT 'Abuanan','Ma-ao Barrio',                3.99 UNION ALL
        SELECT 'Abuanan','Mailum',                      9.48 UNION ALL
        SELECT 'Abuanan','Malingin',                    8.84 UNION ALL
        SELECT 'Abuanan','Napoles',                    10.32 UNION ALL
        SELECT 'Abuanan','Pacol',                      14.00 UNION ALL
        SELECT 'Abuanan','Poblacion',                  17.07 UNION ALL
        SELECT 'Abuanan','Sagasa',                     12.41 UNION ALL
        SELECT 'Abuanan','Sampinit',                   15.43 UNION ALL
        SELECT 'Abuanan','Tabunan',                     7.85 UNION ALL
        SELECT 'Abuanan','Taloc',                      10.10 UNION ALL
        -- Alianza →
        SELECT 'Alianza','Atipuluan',                   5.07 UNION ALL
        SELECT 'Alianza','Bacong-Montilla',             12.55 UNION ALL
        SELECT 'Alianza','Bagroy',                       6.16 UNION ALL
        SELECT 'Alianza','Balingasag',                  11.38 UNION ALL
        SELECT 'Alianza','Binubuhan',                    8.75 UNION ALL
        SELECT 'Alianza','Busay',                        8.66 UNION ALL
        SELECT 'Alianza','Calumangan',                  11.25 UNION ALL
        SELECT 'Alianza','Caridad',                      2.53 UNION ALL
        SELECT 'Alianza','Dulao',                        8.71 UNION ALL
        SELECT 'Alianza','Ilijan',                      13.88 UNION ALL
        SELECT 'Alianza','Jorge L. Araneta',             1.84 UNION ALL
        SELECT 'Alianza','Lag-Asan',                    11.35 UNION ALL
        SELECT 'Alianza','Ma-ao Barrio',                 6.76 UNION ALL
        SELECT 'Alianza','Mailum',                      13.10 UNION ALL
        SELECT 'Alianza','Malingin',                     2.61 UNION ALL
        SELECT 'Alianza','Napoles',                      5.61 UNION ALL
        SELECT 'Alianza','Pacol',                        7.30 UNION ALL
        SELECT 'Alianza','Poblacion',                   12.56 UNION ALL
        SELECT 'Alianza','Sagasa',                       4.13 UNION ALL
        SELECT 'Alianza','Sampinit',                    11.55 UNION ALL
        SELECT 'Alianza','Tabunan',                     11.22 UNION ALL
        SELECT 'Alianza','Taloc',                       11.10 UNION ALL
        -- Atipuluan →
        SELECT 'Atipuluan','Bacong-Montilla',            8.65 UNION ALL
        SELECT 'Atipuluan','Bagroy',                     9.83 UNION ALL
        SELECT 'Atipuluan','Balingasag',                12.49 UNION ALL
        SELECT 'Atipuluan','Binubuhan',                  8.29 UNION ALL
        SELECT 'Atipuluan','Busay',                      8.37 UNION ALL
        SELECT 'Atipuluan','Calumangan',                10.29 UNION ALL
        SELECT 'Atipuluan','Caridad',                    6.20 UNION ALL
        SELECT 'Atipuluan','Dulao',                      4.16 UNION ALL
        SELECT 'Atipuluan','Ilijan',                    12.61 UNION ALL
        SELECT 'Atipuluan','Jorge L. Araneta',           3.97 UNION ALL
        SELECT 'Atipuluan','Lag-Asan',                  12.85 UNION ALL
        SELECT 'Atipuluan','Ma-ao Barrio',               4.34 UNION ALL
        SELECT 'Atipuluan','Mailum',                    11.53 UNION ALL
        SELECT 'Atipuluan','Malingin',                   4.68 UNION ALL
        SELECT 'Atipuluan','Napoles',                    6.39 UNION ALL
        SELECT 'Atipuluan','Pacol',                      9.91 UNION ALL
        SELECT 'Atipuluan','Poblacion',                 13.52 UNION ALL
        SELECT 'Atipuluan','Sagasa',                     8.29 UNION ALL
        SELECT 'Atipuluan','Sampinit',                  12.00 UNION ALL
        SELECT 'Atipuluan','Tabunan',                    7.25 UNION ALL
        SELECT 'Atipuluan','Taloc',                      8.32 UNION ALL
        -- Bacong-Montilla →
        SELECT 'Bacong-Montilla','Bagroy',              18.27 UNION ALL
        SELECT 'Bacong-Montilla','Balingasag',          20.93 UNION ALL
        SELECT 'Bacong-Montilla','Binubuhan',            7.53 UNION ALL
        SELECT 'Bacong-Montilla','Busay',               16.57 UNION ALL
        SELECT 'Bacong-Montilla','Calumangan',          17.92 UNION ALL
        SELECT 'Bacong-Montilla','Caridad',             14.48 UNION ALL
        SELECT 'Bacong-Montilla','Dulao',                9.47 UNION ALL
        SELECT 'Bacong-Montilla','Ilijan',               7.71 UNION ALL
        SELECT 'Bacong-Montilla','Jorge L. Araneta',    10.77 UNION ALL
        SELECT 'Bacong-Montilla','Lag-Asan',            21.39 UNION ALL
        SELECT 'Bacong-Montilla','Ma-ao Barrio',         5.94 UNION ALL
        SELECT 'Bacong-Montilla','Mailum',               6.55 UNION ALL
        SELECT 'Bacong-Montilla','Malingin',            13.17 UNION ALL
        SELECT 'Bacong-Montilla','Napoles',             15.00 UNION ALL
        SELECT 'Bacong-Montilla','Pacol',               18.54 UNION ALL
        SELECT 'Bacong-Montilla','Poblacion',           21.88 UNION ALL
        SELECT 'Bacong-Montilla','Sagasa',              16.49 UNION ALL
        SELECT 'Bacong-Montilla','Sampinit',            20.25 UNION ALL
        SELECT 'Bacong-Montilla','Tabunan',             12.12 UNION ALL
        SELECT 'Bacong-Montilla','Taloc',               14.68 UNION ALL
        -- Bagroy →
        SELECT 'Bagroy','Balingasag',                    6.91 UNION ALL
        SELECT 'Bagroy','Binubuhan',                    14.87 UNION ALL
        SELECT 'Bagroy','Busay',                         6.90 UNION ALL
        SELECT 'Bagroy','Calumangan',                    9.31 UNION ALL
        SELECT 'Bagroy','Caridad',                       3.83 UNION ALL
        SELECT 'Bagroy','Dulao',                        11.86 UNION ALL
        SELECT 'Bagroy','Ilijan',                       20.02 UNION ALL
        SELECT 'Bagroy','Jorge L. Araneta',              7.96 UNION ALL
        SELECT 'Bagroy','Lag-Asan',                      6.45 UNION ALL
        SELECT 'Bagroy','Ma-ao Barrio',                 12.76 UNION ALL
        SELECT 'Bagroy','Mailum',                       19.26 UNION ALL
        SELECT 'Bagroy','Malingin',                      5.15 UNION ALL
        SELECT 'Bagroy','Napoles',                       4.86 UNION ALL
        SELECT 'Bagroy','Pacol',                         2.25 UNION ALL
        SELECT 'Bagroy','Poblacion',                     8.04 UNION ALL
        SELECT 'Bagroy','Sagasa',                        2.11 UNION ALL
        SELECT 'Bagroy','Sampinit',                      7.81 UNION ALL
        SELECT 'Bagroy','Tabunan',                      13.02 UNION ALL
        SELECT 'Bagroy','Taloc',                        11.41 UNION ALL
        -- Balingasag →
        SELECT 'Balingasag','Binubuhan',                19.77 UNION ALL
        SELECT 'Balingasag','Busay',                     4.50 UNION ALL
        SELECT 'Balingasag','Calumangan',                4.79 UNION ALL
        SELECT 'Balingasag','Caridad',                   8.95 UNION ALL
        SELECT 'Balingasag','Dulao',                    12.15 UNION ALL
        SELECT 'Balingasag','Ilijan',                   24.69 UNION ALL
        SELECT 'Balingasag','Jorge L. Araneta',         12.74 UNION ALL
        SELECT 'Balingasag','Lag-Asan',                  0.98 UNION ALL
        SELECT 'Balingasag','Ma-ao Barrio',             16.58 UNION ALL
        SELECT 'Balingasag','Mailum',                   23.72 UNION ALL
        SELECT 'Balingasag','Malingin',                  9.06 UNION ALL
        SELECT 'Balingasag','Napoles',                   6.24 UNION ALL
        SELECT 'Balingasag','Pacol',                     4.70 UNION ALL
        SELECT 'Balingasag','Poblacion',                 1.19 UNION ALL
        SELECT 'Balingasag','Sagasa',                    8.52 UNION ALL
        SELECT 'Balingasag','Sampinit',                  1.56 UNION ALL
        SELECT 'Balingasag','Tabunan',                  11.46 UNION ALL
        SELECT 'Balingasag','Taloc',                     8.69 UNION ALL
        -- Binubuhan →
        SELECT 'Binubuhan','Busay',                     16.22 UNION ALL
        SELECT 'Binubuhan','Calumangan',                18.42 UNION ALL
        SELECT 'Binubuhan','Caridad',                   11.26 UNION ALL
        SELECT 'Binubuhan','Dulao',                     11.81 UNION ALL
        SELECT 'Binubuhan','Ilijan',                     5.16 UNION ALL
        SELECT 'Binubuhan','Jorge L. Araneta',           7.10 UNION ALL
        SELECT 'Binubuhan','Lag-Asan',                  19.89 UNION ALL
        SELECT 'Binubuhan','Ma-ao Barrio',               4.20 UNION ALL
        SELECT 'Binubuhan','Mailum',                     4.52 UNION ALL
        SELECT 'Binubuhan','Malingin',                  10.73 UNION ALL
        SELECT 'Binubuhan','Napoles',                   13.58 UNION ALL
        SELECT 'Binubuhan','Pacol',                     16.02 UNION ALL
        SELECT 'Binubuhan','Poblacion',                 20.91 UNION ALL
        SELECT 'Binubuhan','Sagasa',                    12.77 UNION ALL
        SELECT 'Binubuhan','Sampinit',                  19.64 UNION ALL
        SELECT 'Binubuhan','Tabunan',                   15.07 UNION ALL
        SELECT 'Binubuhan','Taloc',                     16.57 UNION ALL
        -- Busay →
        SELECT 'Busay','Calumangan',                     2.67 UNION ALL
        SELECT 'Busay','Caridad',                        6.74 UNION ALL
        SELECT 'Busay','Dulao',                          7.64 UNION ALL
        SELECT 'Busay','Ilijan',                        20.89 UNION ALL
        SELECT 'Busay','Jorge L. Araneta',               9.56 UNION ALL
        SELECT 'Busay','Lag-Asan',                       5.18 UNION ALL
        SELECT 'Busay','Ma-ao Barrio',                  12.64 UNION ALL
        SELECT 'Busay','Mailum',                        19.85 UNION ALL
        SELECT 'Busay','Malingin',                       6.06 UNION ALL
        SELECT 'Busay','Napoles',                        3.08 UNION ALL
        SELECT 'Busay','Pacol',                          5.04 UNION ALL
        SELECT 'Busay','Poblacion',                      5.34 UNION ALL
        SELECT 'Busay','Sagasa',                         7.42 UNION ALL
        SELECT 'Busay','Sampinit',                       3.68 UNION ALL
        SELECT 'Busay','Tabunan',                        7.23 UNION ALL
        SELECT 'Busay','Taloc',                          4.84 UNION ALL
        -- Calumangan →
        SELECT 'Calumangan','Caridad',                   9.41 UNION ALL
        SELECT 'Calumangan','Dulao',                     8.54 UNION ALL
        SELECT 'Calumangan','Ilijan',                   22.90 UNION ALL
        SELECT 'Calumangan','Jorge L. Araneta',         12.02 UNION ALL
        SELECT 'Calumangan','Lag-Asan',                  5.73 UNION ALL
        SELECT 'Calumangan','Ma-ao Barrio',             14.63 UNION ALL
        SELECT 'Calumangan','Mailum',                   21.81 UNION ALL
        SELECT 'Calumangan','Malingin',                  8.65 UNION ALL
        SELECT 'Calumangan','Napoles',                   5.73 UNION ALL
        SELECT 'Calumangan','Pacol',                     7.24 UNION ALL
        SELECT 'Calumangan','Poblacion',                 5.05 UNION ALL
        SELECT 'Calumangan','Sagasa',                   10.04 UNION ALL
        SELECT 'Calumangan','Sampinit',                  3.32 UNION ALL
        SELECT 'Calumangan','Tabunan',                   7.04 UNION ALL
        SELECT 'Calumangan','Taloc',                     4.09 UNION ALL
        -- Caridad →
        SELECT 'Caridad','Dulao',                        8.95 UNION ALL
        SELECT 'Caridad','Ilijan',                      16.37 UNION ALL
        SELECT 'Caridad','Jorge L. Araneta',             4.21 UNION ALL
        SELECT 'Caridad','Lag-Asan',                     8.87 UNION ALL
        SELECT 'Caridad','Ma-ao Barrio',                 8.94 UNION ALL
        SELECT 'Caridad','Mailum',                      15.56 UNION ALL
        SELECT 'Caridad','Malingin',                     1.67 UNION ALL
        SELECT 'Caridad','Napoles',                      3.69 UNION ALL
        SELECT 'Caridad','Pacol',                        4.77 UNION ALL
        SELECT 'Caridad','Poblacion',                   10.14 UNION ALL
        SELECT 'Caridad','Sagasa',                       2.09 UNION ALL
        SELECT 'Caridad','Sampinit',                     9.25 UNION ALL
        SELECT 'Caridad','Tabunan',                     10.85 UNION ALL
        SELECT 'Caridad','Taloc',                       10.06 UNION ALL
        -- Dulao →
        SELECT 'Dulao','Ilijan',                        15.38 UNION ALL
        SELECT 'Dulao','Jorge L. Araneta',               8.01 UNION ALL
        SELECT 'Dulao','Lag-Asan',                      12.79 UNION ALL
        SELECT 'Dulao','Ma-ao Barrio',                   7.61 UNION ALL
        SELECT 'Dulao','Mailum',                        14.20 UNION ALL
        SELECT 'Dulao','Malingin',                       7.28 UNION ALL
        SELECT 'Dulao','Napoles',                        7.25 UNION ALL
        SELECT 'Dulao','Pacol',                         11.14 UNION ALL
        SELECT 'Dulao','Poblacion',                     12.93 UNION ALL
        SELECT 'Dulao','Sagasa',                        10.90 UNION ALL
        SELECT 'Dulao','Sampinit',                      11.19 UNION ALL
        SELECT 'Dulao','Tabunan',                        3.26 UNION ALL
        SELECT 'Dulao','Taloc',                          5.26 UNION ALL
        -- Ilijan →
        SELECT 'Ilijan','Jorge L. Araneta',             12.18 UNION ALL
        SELECT 'Ilijan','Lag-Asan',                     24.87 UNION ALL
        SELECT 'Ilijan','Ma-ao Barrio',                  8.27 UNION ALL
        SELECT 'Ilijan','Mailum',                        1.22 UNION ALL
        SELECT 'Ilijan','Malingin',                     15.73 UNION ALL
        SELECT 'Ilijan','Napoles',                      18.46 UNION ALL
        SELECT 'Ilijan','Pacol',                        21.11 UNION ALL
        SELECT 'Ilijan','Poblacion',                    25.80 UNION ALL
        SELECT 'Ilijan','Sagasa',                       17.93 UNION ALL
        SELECT 'Ilijan','Sampinit',                     24.44 UNION ALL
        SELECT 'Ilijan','Tabunan',                      18.51 UNION ALL
        SELECT 'Ilijan','Taloc',                        20.52 UNION ALL
        -- Jorge L. Araneta →
        SELECT 'Jorge L. Araneta','Lag-Asan',           12.81 UNION ALL
        SELECT 'Jorge L. Araneta','Ma-ao Barrio',        4.93 UNION ALL
        SELECT 'Jorge L. Araneta','Mailum',             11.35 UNION ALL
        SELECT 'Jorge L. Araneta','Malingin',            3.69 UNION ALL
        SELECT 'Jorge L. Araneta','Napoles',             6.67 UNION ALL
        SELECT 'Jorge L. Araneta','Pacol',               8.93 UNION ALL
        SELECT 'Jorge L. Araneta','Poblacion',          13.91 UNION ALL
        SELECT 'Jorge L. Araneta','Sagasa',              5.96 UNION ALL
        SELECT 'Jorge L. Araneta','Sampinit',           12.75 UNION ALL
        SELECT 'Jorge L. Araneta','Tabunan',            10.86 UNION ALL
        SELECT 'Jorge L. Araneta','Taloc',              11.23 UNION ALL
        -- Lag-Asan →
        SELECT 'Lag-Asan','Ma-ao Barrio',               16.84 UNION ALL
        SELECT 'Lag-Asan','Mailum',                     23.94 UNION ALL
        SELECT 'Lag-Asan','Malingin',                    9.16 UNION ALL
        SELECT 'Lag-Asan','Napoles',                     6.50 UNION ALL
        SELECT 'Lag-Asan','Pacol',                       4.34 UNION ALL
        SELECT 'Lag-Asan','Poblacion',                   1.69 UNION ALL
        SELECT 'Lag-Asan','Sagasa',                      8.21 UNION ALL
        SELECT 'Lag-Asan','Sampinit',                    2.53 UNION ALL
        SELECT 'Lag-Asan','Tabunan',                    12.28 UNION ALL
        SELECT 'Lag-Asan','Taloc',                       9.56 UNION ALL
        -- Ma-ao Barrio →
        SELECT 'Ma-ao Barrio','Mailum',                  7.21 UNION ALL
        SELECT 'Ma-ao Barrio','Malingin',                7.90 UNION ALL
        SELECT 'Ma-ao Barrio','Napoles',                10.35 UNION ALL
        SELECT 'Ma-ao Barrio','Pacol',                  13.41 UNION ALL
        SELECT 'Ma-ao Barrio','Poblacion',              17.66 UNION ALL
        SELECT 'Ma-ao Barrio','Sagasa',                 10.84 UNION ALL
        SELECT 'Ma-ao Barrio','Sampinit',               16.23 UNION ALL
        SELECT 'Ma-ao Barrio','Tabunan',                10.87 UNION ALL
        SELECT 'Ma-ao Barrio','Taloc',                  12.47 UNION ALL
        -- Mailum →
        SELECT 'Mailum','Malingin',                     14.83 UNION ALL
        SELECT 'Mailum','Napoles',                      17.49 UNION ALL
        SELECT 'Mailum','Pacol',                        20.26 UNION ALL
        SELECT 'Mailum','Poblacion',                    24.83 UNION ALL
        SELECT 'Mailum','Sagasa',                       17.19 UNION ALL
        SELECT 'Mailum','Sampinit',                     23.43 UNION ALL
        SELECT 'Mailum','Tabunan',                      17.32 UNION ALL
        SELECT 'Mailum','Taloc',                        19.36 UNION ALL
        -- Malingin →
        SELECT 'Malingin','Napoles',                     3.04 UNION ALL
        SELECT 'Malingin','Pacol',                       5.50 UNION ALL
        SELECT 'Malingin','Poblacion',                  10.22 UNION ALL
        SELECT 'Malingin','Sagasa',                      3.71 UNION ALL
        SELECT 'Malingin','Sampinit',                    9.08 UNION ALL
        SELECT 'Malingin','Tabunan',                     9.27 UNION ALL
        SELECT 'Malingin','Taloc',                       8.73 UNION ALL
        -- Napoles →
        SELECT 'Napoles','Pacol',                        3.89 UNION ALL
        SELECT 'Napoles','Poblacion',                    7.35 UNION ALL
        SELECT 'Napoles','Sagasa',                       4.70 UNION ALL
        SELECT 'Napoles','Sampinit',                     6.08 UNION ALL
        SELECT 'Napoles','Tabunan',                      8.16 UNION ALL
        SELECT 'Napoles','Taloc',                        6.71 UNION ALL
        -- Pacol →
        SELECT 'Pacol','Poblacion',                      5.86 UNION ALL
        SELECT 'Pacol','Sagasa',                         3.87 UNION ALL
        SELECT 'Pacol','Sampinit',                       5.55 UNION ALL
        SELECT 'Pacol','Tabunan',                       11.77 UNION ALL
        SELECT 'Pacol','Taloc',                          9.79 UNION ALL
        -- Poblacion →
        SELECT 'Poblacion','Sagasa',                     9.70 UNION ALL
        SELECT 'Poblacion','Sampinit',                   1.78 UNION ALL
        SELECT 'Poblacion','Tabunan',                   11.98 UNION ALL
        SELECT 'Poblacion','Taloc',                      9.10 UNION ALL
        -- Sagasa →
        SELECT 'Sagasa','Sampinit',                      9.16 UNION ALL
        SELECT 'Sagasa','Tabunan',                      12.55 UNION ALL
        SELECT 'Sagasa','Taloc',                        11.40 UNION ALL
        -- Sampinit →
        SELECT 'Sampinit','Tabunan',                    10.20 UNION ALL
        SELECT 'Sampinit','Taloc',                       7.34 UNION ALL
        -- Tabunan →
        SELECT 'Tabunan','Taloc',                        3.01
    ) d
    JOIN barangays f ON f.name = d.fn
    JOIN barangays t ON t.name = d.tn
    ON DUPLICATE KEY UPDATE distance_km = VALUES(distance_km);

    -- Mirror: reverse direction (symmetric matrix)
    INSERT INTO barangay_distances (from_barangay_id, to_barangay_id, distance_km)
    SELECT to_barangay_id, from_barangay_id, distance_km
    FROM barangay_distances
    ON DUPLICATE KEY UPDATE distance_km = VALUES(distance_km);

    -- Self-distances = 0
    INSERT INTO barangay_distances (from_barangay_id, to_barangay_id, distance_km)
    SELECT id, id, 0.00 FROM barangays
    ON DUPLICATE KEY UPDATE distance_km = 0.00;

END$$
DELIMITER ;

CALL seed_distances_v2();
DROP PROCEDURE IF EXISTS seed_distances_v2;

-- Verify: show Poblacion outbound distances sorted
SELECT f.name AS `from`, t.name AS `to`, bd.distance_km,
       CEIL(25 + GREATEST(0, bd.distance_km - 5) * 5) AS fee_php
FROM barangay_distances bd
JOIN barangays f ON bd.from_barangay_id = f.id
JOIN barangays t ON bd.to_barangay_id   = t.id
WHERE f.name = 'Poblacion'
ORDER BY bd.distance_km;
