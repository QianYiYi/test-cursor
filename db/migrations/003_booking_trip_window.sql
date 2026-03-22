-- 预约：出差服务时间窗（可重复执行，已存在列则跳过）
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
PREPARE stmt_trip_start FROM @trip_start_sql;
EXECUTE stmt_trip_start;
DEALLOCATE PREPARE stmt_trip_start;

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
PREPARE stmt_trip_end FROM @trip_end_sql;
EXECUTE stmt_trip_end;
DEALLOCATE PREPARE stmt_trip_end;
