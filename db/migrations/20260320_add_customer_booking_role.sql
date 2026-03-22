-- 新增角色：客户预约订单（可重复执行：存在则更新描述与权限）
INSERT INTO roles (name, code, description, permissions_json, menus_json, is_active)
VALUES
  (
    '客户预约订单',
    'customer_booking',
    '客户侧提交预约、查看订单与状态（无导出/删除/编辑他人数据）',
    JSON_ARRAY('booking:create', 'booking:read', 'experimenter:read'),
    JSON_ARRAY('/new', '/records', '/dashboard'),
    1
  )
ON DUPLICATE KEY UPDATE
  description = VALUES(description),
  permissions_json = VALUES(permissions_json),
  menus_json = VALUES(menus_json),
  is_active = VALUES(is_active);
