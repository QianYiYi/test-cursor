-- 预约字段扩展 + 取消合同编号唯一 + PM配置

SET @seq_data_volume_col_exists := (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'bookings'
    AND COLUMN_NAME = 'seq_data_volume'
);
SET @seq_data_volume_col_sql := IF(
  @seq_data_volume_col_exists = 0,
  'ALTER TABLE bookings ADD COLUMN seq_data_volume VARCHAR(64) NULL AFTER seq_type',
  'SELECT 1'
);
PREPARE stmt_bookings_seq_data_volume_col FROM @seq_data_volume_col_sql;
EXECUTE stmt_bookings_seq_data_volume_col;
DEALLOCATE PREPARE stmt_bookings_seq_data_volume_col;

SET @pm_owner_col_exists := (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'bookings'
    AND COLUMN_NAME = 'pm_owner'
);
SET @pm_owner_col_sql := IF(
  @pm_owner_col_exists = 0,
  'ALTER TABLE bookings ADD COLUMN pm_owner VARCHAR(64) NULL AFTER seq_data_volume',
  'SELECT 1'
);
PREPARE stmt_bookings_pm_owner_col FROM @pm_owner_col_sql;
EXECUTE stmt_bookings_pm_owner_col;
DEALLOCATE PREPARE stmt_bookings_pm_owner_col;

SET @remark_col_exists := (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'bookings'
    AND COLUMN_NAME = 'remark'
);
SET @remark_col_sql := IF(
  @remark_col_exists = 0,
  'ALTER TABLE bookings ADD COLUMN remark TEXT NULL AFTER platform',
  'SELECT 1'
);
PREPARE stmt_bookings_remark_col FROM @remark_col_sql;
EXECUTE stmt_bookings_remark_col;
DEALLOCATE PREPARE stmt_bookings_remark_col;

SET @uniq_contract_no_exists := (
  SELECT COUNT(*)
  FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'bookings'
    AND INDEX_NAME = 'uniq_contract_no'
);
SET @uniq_contract_no_sql := IF(
  @uniq_contract_no_exists = 1,
  'ALTER TABLE bookings DROP INDEX uniq_contract_no',
  'SELECT 1'
);
PREPARE stmt_drop_uniq_contract_no FROM @uniq_contract_no_sql;
EXECUTE stmt_drop_uniq_contract_no;
DEALLOCATE PREPARE stmt_drop_uniq_contract_no;

SET @idx_contract_no_exists := (
  SELECT COUNT(*)
  FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'bookings'
    AND INDEX_NAME = 'idx_contract_no'
);
SET @idx_contract_no_sql := IF(
  @idx_contract_no_exists = 0,
  'ALTER TABLE bookings ADD KEY idx_contract_no (contract_no)',
  'SELECT 1'
);
PREPARE stmt_add_idx_contract_no FROM @idx_contract_no_sql;
EXECUTE stmt_add_idx_contract_no;
DEALLOCATE PREPARE stmt_add_idx_contract_no;

CREATE TABLE IF NOT EXISTS pm_owners (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  name VARCHAR(64) NOT NULL,
  email VARCHAR(128) NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uniq_pm_owner_name (name),
  KEY idx_pm_owner_active (is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

UPDATE roles
SET permissions_json = JSON_ARRAY_APPEND(permissions_json, '$', 'pm-owner:manage')
WHERE code IN ('super_admin', 'admin')
  AND JSON_SEARCH(permissions_json, 'one', 'pm-owner:manage') IS NULL;

UPDATE roles
SET menus_json = JSON_ARRAY_APPEND(menus_json, '$', '/pm-owners')
WHERE code IN ('super_admin', 'admin')
  AND JSON_SEARCH(menus_json, 'one', '/pm-owners') IS NULL;
