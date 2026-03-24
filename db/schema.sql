-- 单细胞实验室预约系统（MySQL 8.0）
-- 数据库：sc_booking（由 docker-compose 或自行创建）

SET NAMES utf8mb4;
SET time_zone = '+08:00';

CREATE TABLE IF NOT EXISTS users (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  name VARCHAR(64) NOT NULL,
  email VARCHAR(128) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role ENUM('admin', 'user') NOT NULL DEFAULT 'user',
  role_id BIGINT UNSIGNED NULL,
  experimenter_id BIGINT UNSIGNED NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  is_deleted TINYINT(1) NOT NULL DEFAULT 0,
  deleted_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uniq_users_email (email),
  KEY idx_users_role_id (role_id),
  KEY idx_users_experimenter_id (experimenter_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS roles (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  name VARCHAR(64) NOT NULL,
  code VARCHAR(64) NOT NULL,
  description VARCHAR(255) NULL,
  permissions_json JSON NOT NULL,
  menus_json JSON NOT NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uniq_roles_name (name),
  UNIQUE KEY uniq_roles_code (code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

SET @role_id_col_exists := (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'users'
    AND COLUMN_NAME = 'role_id'
);
SET @role_id_col_sql := IF(
  @role_id_col_exists = 0,
  'ALTER TABLE users ADD COLUMN role_id BIGINT UNSIGNED NULL AFTER role',
  'SELECT 1'
);
PREPARE stmt_users_role_col FROM @role_id_col_sql;
EXECUTE stmt_users_role_col;
DEALLOCATE PREPARE stmt_users_role_col;

SET @role_id_idx_exists := (
  SELECT COUNT(*)
  FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'users'
    AND INDEX_NAME = 'idx_users_role_id'
);
SET @role_id_idx_sql := IF(
  @role_id_idx_exists = 0,
  'ALTER TABLE users ADD KEY idx_users_role_id (role_id)',
  'SELECT 1'
);
PREPARE stmt_users_role_idx FROM @role_id_idx_sql;
EXECUTE stmt_users_role_idx;
DEALLOCATE PREPARE stmt_users_role_idx;

SET @exp_id_col_exists := (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'users'
    AND COLUMN_NAME = 'experimenter_id'
);
SET @exp_id_col_sql := IF(
  @exp_id_col_exists = 0,
  'ALTER TABLE users ADD COLUMN experimenter_id BIGINT UNSIGNED NULL AFTER role_id',
  'SELECT 1'
);
PREPARE stmt_users_exp_col FROM @exp_id_col_sql;
EXECUTE stmt_users_exp_col;
DEALLOCATE PREPARE stmt_users_exp_col;

SET @exp_id_idx_exists := (
  SELECT COUNT(*)
  FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'users'
    AND INDEX_NAME = 'idx_users_experimenter_id'
);
SET @exp_id_idx_sql := IF(
  @exp_id_idx_exists = 0,
  'ALTER TABLE users ADD KEY idx_users_experimenter_id (experimenter_id)',
  'SELECT 1'
);
PREPARE stmt_users_exp_idx FROM @exp_id_idx_sql;
EXECUTE stmt_users_exp_idx;
DEALLOCATE PREPARE stmt_users_exp_idx;

SET @is_deleted_col_exists := (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'users'
    AND COLUMN_NAME = 'is_deleted'
);
SET @is_deleted_col_sql := IF(
  @is_deleted_col_exists = 0,
  'ALTER TABLE users ADD COLUMN is_deleted TINYINT(1) NOT NULL DEFAULT 0 AFTER is_active',
  'SELECT 1'
);
PREPARE stmt_users_is_deleted_col FROM @is_deleted_col_sql;
EXECUTE stmt_users_is_deleted_col;
DEALLOCATE PREPARE stmt_users_is_deleted_col;

SET @deleted_at_col_exists := (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'users'
    AND COLUMN_NAME = 'deleted_at'
);
SET @deleted_at_col_sql := IF(
  @deleted_at_col_exists = 0,
  'ALTER TABLE users ADD COLUMN deleted_at DATETIME NULL AFTER is_deleted',
  'SELECT 1'
);
PREPARE stmt_users_deleted_at_col FROM @deleted_at_col_sql;
EXECUTE stmt_users_deleted_at_col;
DEALLOCATE PREPARE stmt_users_deleted_at_col;

CREATE TABLE IF NOT EXISTS bookings (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,

  sales_name VARCHAR(64) NOT NULL,
  contract_no VARCHAR(64) NOT NULL,
  customer_unit VARCHAR(128) NOT NULL,
  customer_name VARCHAR(64) NOT NULL,
  customer_contact VARCHAR(128) NOT NULL,

  need_dissociation TINYINT(1) NOT NULL DEFAULT 0,
  sample_info VARCHAR(255) NOT NULL,

  visit_time DATETIME NOT NULL,
  service_end_time DATETIME NOT NULL,
  trip_start_time DATETIME NULL,
  trip_end_time DATETIME NULL,
  experimenter VARCHAR(64) DEFAULT NULL,
  sample_count INT NOT NULL,

  seq_type VARCHAR(64) NOT NULL,
  seq_data_volume VARCHAR(64) NULL,
  pm_owner VARCHAR(64) NULL,
  platform ENUM('寻因', '10x') NOT NULL,
  remark TEXT NULL,
  notify_methods JSON NULL,
  created_by_user_id BIGINT UNSIGNED NULL,

  status ENUM('pending', 'in_progress', 'done') NOT NULL DEFAULT 'pending',

  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  PRIMARY KEY (id),
  KEY idx_contract_no (contract_no),
  KEY idx_visit_time (visit_time),
  KEY idx_service_end_time (service_end_time),
  KEY idx_sales_name (sales_name),
  KEY idx_customer_unit (customer_unit),
  KEY idx_customer_name (customer_name),
  KEY idx_status (status),
  KEY idx_seq_type (seq_type),
  KEY idx_platform (platform)
  ,
  KEY idx_created_by_user_id (created_by_user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS experimenters (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  name VARCHAR(64) NOT NULL,
  notify_methods JSON NULL,
  email VARCHAR(128) NULL,
  phone VARCHAR(32) NULL,
  teams_id VARCHAR(128) NULL,
  wechat_id VARCHAR(128) NULL,
  other_contact VARCHAR(255) NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uniq_experimenter_name (name),
  KEY idx_experimenter_active (is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

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

CREATE TABLE IF NOT EXISTS seq_type_custom (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  name VARCHAR(128) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uniq_seq_type_custom_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS booking_notifications (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  booking_id BIGINT UNSIGNED NOT NULL,
  experimenter_id BIGINT UNSIGNED NULL,
  channel ENUM('微信', '邮件', '手机号码', 'Teams', '其他') NOT NULL,
  target VARCHAR(255) NULL,
  status ENUM('sent', 'failed', 'skipped') NOT NULL,
  message TEXT NOT NULL,
  error_message VARCHAR(500) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_booking_notifications_booking (booking_id),
  KEY idx_booking_notifications_experimenter (experimenter_id),
  KEY idx_booking_notifications_status (status),
  CONSTRAINT fk_booking_notifications_booking FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE CASCADE,
  CONSTRAINT fk_booking_notifications_experimenter FOREIGN KEY (experimenter_id) REFERENCES experimenters(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS booking_logs (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  booking_id BIGINT UNSIGNED NULL,
  actor_user_id BIGINT UNSIGNED NOT NULL,
  action ENUM('create', 'update', 'delete', 'status_change') NOT NULL,
  before_json JSON NULL,
  after_json JSON NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_booking_id (booking_id),
  KEY idx_actor_user_id (actor_user_id),
  KEY idx_created_at (created_at),
  CONSTRAINT fk_booking_logs_booking FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE SET NULL,
  CONSTRAINT fk_booking_logs_actor FOREIGN KEY (actor_user_id) REFERENCES users(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

SET @created_by_col_exists := (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'bookings'
    AND COLUMN_NAME = 'created_by_user_id'
);
SET @created_by_col_sql := IF(
  @created_by_col_exists = 0,
  'ALTER TABLE bookings ADD COLUMN created_by_user_id BIGINT UNSIGNED NULL AFTER notify_methods',
  'SELECT 1'
);
PREPARE stmt_bookings_created_by_col FROM @created_by_col_sql;
EXECUTE stmt_bookings_created_by_col;
DEALLOCATE PREPARE stmt_bookings_created_by_col;

SET @created_by_idx_exists := (
  SELECT COUNT(*)
  FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'bookings'
    AND INDEX_NAME = 'idx_created_by_user_id'
);
SET @created_by_idx_sql := IF(
  @created_by_idx_exists = 0,
  'ALTER TABLE bookings ADD KEY idx_created_by_user_id (created_by_user_id)',
  'SELECT 1'
);
PREPARE stmt_bookings_created_by_idx FROM @created_by_idx_sql;
EXECUTE stmt_bookings_created_by_idx;
DEALLOCATE PREPARE stmt_bookings_created_by_idx;

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

SET @trip_start_exists := (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'bookings'
    AND COLUMN_NAME = 'trip_start_time'
);
SET @trip_start_sql := IF(
  @trip_start_exists = 0,
  'ALTER TABLE bookings ADD COLUMN trip_start_time DATETIME NULL AFTER service_end_time',
  'SELECT 1'
);
PREPARE stmt_bookings_trip_start FROM @trip_start_sql;
EXECUTE stmt_bookings_trip_start;
DEALLOCATE PREPARE stmt_bookings_trip_start;

SET @trip_end_exists := (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'bookings'
    AND COLUMN_NAME = 'trip_end_time'
);
SET @trip_end_sql := IF(
  @trip_end_exists = 0,
  'ALTER TABLE bookings ADD COLUMN trip_end_time DATETIME NULL AFTER trip_start_time',
  'SELECT 1'
);
PREPARE stmt_bookings_trip_end FROM @trip_end_sql;
EXECUTE stmt_bookings_trip_end;
DEALLOCATE PREPARE stmt_bookings_trip_end;

CREATE TABLE IF NOT EXISTS system_audit_logs (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  actor_user_id BIGINT UNSIGNED NOT NULL,
  module VARCHAR(64) NOT NULL,
  action VARCHAR(64) NOT NULL,
  target_type VARCHAR(64) NOT NULL,
  target_id VARCHAR(64) NULL,
  before_json JSON NULL,
  after_json JSON NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_system_audit_actor (actor_user_id),
  KEY idx_system_audit_module (module),
  KEY idx_system_audit_created (created_at),
  CONSTRAINT fk_system_audit_actor FOREIGN KEY (actor_user_id) REFERENCES users(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

SET @fk_exists := (
  SELECT COUNT(*)
  FROM information_schema.TABLE_CONSTRAINTS
  WHERE CONSTRAINT_SCHEMA = DATABASE()
    AND TABLE_NAME = 'users'
    AND CONSTRAINT_NAME = 'fk_users_role'
);
SET @fk_sql := IF(
  @fk_exists = 0,
  'ALTER TABLE users ADD CONSTRAINT fk_users_role FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE SET NULL',
  'SELECT 1'
);
PREPARE stmt_fk_users_role FROM @fk_sql;
EXECUTE stmt_fk_users_role;
DEALLOCATE PREPARE stmt_fk_users_role;

SET @fk_users_experimenter_exists := (
  SELECT COUNT(*)
  FROM information_schema.TABLE_CONSTRAINTS
  WHERE CONSTRAINT_SCHEMA = DATABASE()
    AND TABLE_NAME = 'users'
    AND CONSTRAINT_NAME = 'fk_users_experimenter'
);
SET @fk_users_experimenter_sql := IF(
  @fk_users_experimenter_exists = 0,
  'ALTER TABLE users ADD CONSTRAINT fk_users_experimenter FOREIGN KEY (experimenter_id) REFERENCES experimenters(id) ON DELETE SET NULL',
  'SELECT 1'
);
PREPARE stmt_fk_users_experimenter FROM @fk_users_experimenter_sql;
EXECUTE stmt_fk_users_experimenter;
DEALLOCATE PREPARE stmt_fk_users_experimenter;

SET @fk_bookings_creator_exists := (
  SELECT COUNT(*)
  FROM information_schema.TABLE_CONSTRAINTS
  WHERE CONSTRAINT_SCHEMA = DATABASE()
    AND TABLE_NAME = 'bookings'
    AND CONSTRAINT_NAME = 'fk_bookings_creator'
);
SET @fk_bookings_creator_sql := IF(
  @fk_bookings_creator_exists = 0,
  'ALTER TABLE bookings ADD CONSTRAINT fk_bookings_creator FOREIGN KEY (created_by_user_id) REFERENCES users(id) ON DELETE SET NULL',
  'SELECT 1'
);
PREPARE stmt_fk_bookings_creator FROM @fk_bookings_creator_sql;
EXECUTE stmt_fk_bookings_creator;
DEALLOCATE PREPARE stmt_fk_bookings_creator;

INSERT INTO roles (name, code, description, permissions_json, menus_json, is_active)
VALUES
  (
    '超级管理员',
    'super_admin',
    '系统全权限',
    JSON_ARRAY('*'),
    JSON_ARRAY('/new', '/records', '/dashboard', '/analytics', '/experimenters', '/pm-owners', '/seq-types', '/users', '/roles'),
    1
  ),
  (
    '普通管理员',
    'admin',
    '业务管理权限',
    JSON_ARRAY('booking:create', 'booking:read', 'booking:update', 'booking:delete', 'booking:export', 'analytics:read', 'experimenter:read', 'experimenter:manage', 'pm-owner:manage', 'seq-type:manage', 'user:manage'),
    JSON_ARRAY('/new', '/records', '/dashboard', '/analytics', '/experimenters', '/pm-owners', '/seq-types', '/users'),
    1
  ),
  (
    '操作员',
    'operator',
    '预约录入与处理',
    JSON_ARRAY('booking:create', 'booking:read', 'booking:update', 'booking:export', 'analytics:read', 'experimenter:read'),
    JSON_ARRAY('/new', '/records', '/dashboard', '/analytics'),
    1
  ),
  (
    '技术员',
    'technician',
    '仅查看分配给自己的预约，可更新自己订单状态',
    JSON_ARRAY('booking:read', 'booking:update', 'analytics:read'),
    JSON_ARRAY('/new', '/records', '/dashboard', '/analytics'),
    1
  ),
  (
    '管理技术员',
    'tech_manager',
    '查看全部订单并可重新分配实验员',
    JSON_ARRAY('booking:read', 'booking:update', 'booking:assign', 'analytics:read', 'experimenter:read'),
    JSON_ARRAY('/new', '/records', '/dashboard', '/analytics'),
    1
  ),
  (
    '查看员',
    'viewer',
    '仅查看数据',
    JSON_ARRAY('booking:read', 'analytics:read', 'experimenter:read'),
    JSON_ARRAY('/records', '/dashboard', '/analytics'),
    1
  ),
  (
    '客户预约订单',
    'customer_booking',
    '客户侧提交预约，仅可增删改查自己创建订单',
    JSON_ARRAY('booking:create', 'booking:read', 'booking:update', 'booking:delete', 'experimenter:read', 'analytics:read'),
    JSON_ARRAY('/new', '/records', '/dashboard'),
    1
  )
ON DUPLICATE KEY UPDATE
  description = VALUES(description),
  permissions_json = VALUES(permissions_json),
  menus_json = VALUES(menus_json),
  is_active = VALUES(is_active);

UPDATE users u
JOIN roles r ON r.code = 'super_admin'
SET u.role_id = r.id
WHERE u.role = 'admin' AND u.role_id IS NULL;

INSERT INTO experimenters (name, notify_methods, email, phone, teams_id, wechat_id, other_contact, is_active)
VALUES
  ('李三', JSON_ARRAY('邮件', '手机号码', 'Teams', '微信', '其他'), '2441168440@qq.com', '18262382732', NULL, NULL, NULL, 1),
  ('张四', JSON_ARRAY('邮件', '手机号码', 'Teams', '微信', '其他'), '2441168440@qq.com', '18262382732', NULL, NULL, NULL, 1),
  ('钱二', JSON_ARRAY('邮件', '手机号码', 'Teams', '微信', '其他'), '2441168440@qq.com', '18262382732', NULL, NULL, NULL, 1),
  ('王大', JSON_ARRAY('邮件', '手机号码', 'Teams', '微信', '其他'), '2441168440@qq.com', '18262382732', NULL, NULL, NULL, 1)
ON DUPLICATE KEY UPDATE
  notify_methods = VALUES(notify_methods),
  email = VALUES(email),
  phone = VALUES(phone),
  teams_id = VALUES(teams_id),
  wechat_id = VALUES(wechat_id),
  other_contact = VALUES(other_contact),
  is_active = VALUES(is_active);

