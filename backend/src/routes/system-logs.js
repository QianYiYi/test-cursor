import express from 'express';
import { getPool } from '../db.js';
import { requirePermission } from '../auth.js';

export const systemLogsRouter = express.Router();

systemLogsRouter.get('/', requirePermission('user:manage'), async (req, res) => {
  const page = Math.max(1, Number(req.query.page || 1));
  const pageSize = Math.min(200, Math.max(1, Number(req.query.pageSize || 50)));
  const offset = (page - 1) * pageSize;
  const pool = getPool();
  const [[countRow]] = await pool.query('SELECT COUNT(*) AS total FROM system_audit_logs');
  const [rows] = await pool.query(
    `
    SELECT
      l.id,
      l.actor_user_id AS actorUserId,
      u.name AS actorName,
      u.email AS actorEmail,
      l.module,
      l.action,
      l.target_type AS targetType,
      l.target_id AS targetId,
      l.before_json AS beforeJson,
      l.after_json AS afterJson,
      l.created_at AS createdAt
    FROM system_audit_logs l
    LEFT JOIN users u ON u.id = l.actor_user_id
    ORDER BY l.id DESC
    LIMIT ? OFFSET ?
    `,
    [pageSize, offset]
  );
  res.json({ page, pageSize, total: Number(countRow.total || 0), items: rows });
});
