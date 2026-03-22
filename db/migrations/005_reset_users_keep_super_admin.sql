-- 仅保留一个「超级管理员」账号（roles.code = super_admin 中 id 最小的一个），删除其余用户。
-- 先处理外键：booking_logs / system_audit_logs 的 actor_user_id 为 RESTRICT，需先指向保留用户。
-- bookings.created_by_user_id 为 ON DELETE SET NULL，删除用户时会自动置空。

SET @keep_id := (
  SELECT u.id
  FROM users u
  INNER JOIN roles r ON r.id = u.role_id
  WHERE r.code = 'super_admin'
  ORDER BY u.id ASC
  LIMIT 1
);

-- 若无超级管理员用户则不要执行删除（避免误删全部）
SELECT IF(@keep_id IS NULL, 'ERROR: no super_admin user found', CONCAT('KEEP user id=', @keep_id)) AS migration_check;

UPDATE booking_logs SET actor_user_id = @keep_id WHERE @keep_id IS NOT NULL AND actor_user_id <> @keep_id;

UPDATE system_audit_logs SET actor_user_id = @keep_id WHERE @keep_id IS NOT NULL AND actor_user_id <> @keep_id;

DELETE FROM users WHERE @keep_id IS NOT NULL AND id <> @keep_id;
