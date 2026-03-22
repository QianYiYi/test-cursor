-- 为“测序类型配置”增加独立权限与菜单：seq-type:manage, /seq-types
-- 可重复执行（幂等）

UPDATE roles
SET permissions_json = JSON_ARRAY_APPEND(permissions_json, '$', 'seq-type:manage')
WHERE code IN ('super_admin', 'admin')
  AND JSON_SEARCH(permissions_json, 'one', 'seq-type:manage') IS NULL;

UPDATE roles
SET menus_json = JSON_ARRAY_APPEND(menus_json, '$', '/seq-types')
WHERE code IN ('super_admin', 'admin')
  AND JSON_SEARCH(menus_json, 'one', '/seq-types') IS NULL;
