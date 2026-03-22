-- 技术员 / 管理技术员 增加「预约登记」入口（仅看日历、无创建权限时也可进入 /new）
UPDATE roles
SET menus_json = JSON_ARRAY('/new', '/records', '/dashboard', '/analytics')
WHERE code IN ('technician', 'tech_manager');
