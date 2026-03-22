import express from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { getPool } from '../db.js';
import { requirePermission } from '../auth.js';
import { writeSystemLog } from '../audit.js';

export const usersRouter = express.Router();

const createUserSchema = z.object({
  name: z.string().trim().min(1).max(64),
  email: z.string().trim().email().max(128),
  password: z.string().min(6).max(128),
  roleId: z.number().int().positive(),
  experimenterId: z.number().int().positive().nullable().optional(),
  isActive: z.boolean().optional().default(true)
});

const updateUserSchema = z.object({
  name: z.string().trim().min(1).max(64).optional(),
  email: z.string().trim().email().max(128).optional(),
  roleId: z.number().int().positive().optional(),
  experimenterId: z.number().int().positive().nullable().optional(),
  isActive: z.boolean().optional()
});

const resetPwdSchema = z.object({
  newPassword: z.string().min(6).max(128)
});

usersRouter.get('/', requirePermission('user:manage'), async (_req, res) => {
  const pool = getPool();
  const [rows] = await pool.query(
    `
    SELECT
      u.id,
      u.name,
      u.email,
      u.role,
      u.role_id AS roleId,
      u.is_active AS isActive,
      u.is_deleted AS isDeleted,
      u.deleted_at AS deletedAt,
      u.created_at AS createdAt,
      u.updated_at AS updatedAt,
      r.name AS roleName,
      r.code AS roleCode,
      u.experimenter_id AS experimenterId,
      e.name AS experimenterName
    FROM users u
    LEFT JOIN roles r ON r.id = u.role_id
    LEFT JOIN experimenters e ON e.id = u.experimenter_id
    ORDER BY u.id ASC
    `
  );
  res.json({
    items: rows.map((r) => ({
      ...r,
      isActive: Boolean(r.isActive),
      isDeleted: Boolean(r.isDeleted)
    }))
  });
});

usersRouter.post('/', requirePermission('user:manage'), async (req, res) => {
  const parsed = createUserSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid body', details: parsed.error.flatten() });
  const b = parsed.data;
  const passwordHash = await bcrypt.hash(b.password, 10);
  const pool = getPool();
  try {
    const [result] = await pool.query(
      `INSERT INTO users (name, email, password_hash, role, role_id, experimenter_id, is_active, is_deleted, deleted_at)
       VALUES (?, ?, ?, 'user', ?, ?, ?, 0, NULL)`,
      [b.name, b.email, passwordHash, b.roleId, b.experimenterId ?? null, b.isActive ? 1 : 0]
    );
    await writeSystemLog({
      actorUserId: req.user.id,
      module: 'user',
      action: 'create',
      targetType: 'user',
      targetId: result.insertId,
      before: null,
      after: { name: b.name, email: b.email, roleId: b.roleId, experimenterId: b.experimenterId ?? null, isActive: b.isActive }
    });
    res.status(201).json({ id: result.insertId });
  } catch (e) {
    if (e?.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: '邮箱已存在', code: 'USER_EXISTS' });
    throw e;
  }
});

usersRouter.put('/:id', requirePermission('user:manage'), async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) return res.status(400).json({ error: 'Invalid id' });
  const parsed = updateUserSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid body', details: parsed.error.flatten() });
  const b = parsed.data;
  const sets = [];
  const params = [];
  const push = (k, v) => { sets.push(`${k} = ?`); params.push(v); };
  if (b.name !== undefined) push('name', b.name);
  if (b.email !== undefined) push('email', b.email);
  if (b.roleId !== undefined) push('role_id', b.roleId);
  if (b.experimenterId !== undefined) push('experimenter_id', b.experimenterId ?? null);
  if (b.isActive !== undefined) push('is_active', b.isActive ? 1 : 0);
  if (!sets.length) return res.status(400).json({ error: 'No fields to update' });
  const pool = getPool();
  try {
    const [beforeRows] = await pool.query('SELECT * FROM users WHERE id = ? LIMIT 1', [id]);
    const [result] = await pool.query(`UPDATE users SET ${sets.join(', ')} WHERE id = ?`, [...params, id]);
    if (result.affectedRows === 0) return res.status(404).json({ error: 'Not found' });
    const [afterRows] = await pool.query('SELECT * FROM users WHERE id = ? LIMIT 1', [id]);
    await writeSystemLog({
      actorUserId: req.user.id,
      module: 'user',
      action: 'update',
      targetType: 'user',
      targetId: id,
      before: beforeRows?.[0] || null,
      after: afterRows?.[0] || null
    });
    res.json({ ok: true });
  } catch (e) {
    if (e?.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: '邮箱已存在', code: 'USER_EXISTS' });
    throw e;
  }
});

usersRouter.put('/:id/reset-password', requirePermission('user:manage'), async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) return res.status(400).json({ error: 'Invalid id' });
  const parsed = resetPwdSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid body', details: parsed.error.flatten() });
  const passwordHash = await bcrypt.hash(parsed.data.newPassword, 10);
  const pool = getPool();
  const [beforeRows] = await pool.query('SELECT * FROM users WHERE id = ? LIMIT 1', [id]);
  const [result] = await pool.query('UPDATE users SET password_hash = ? WHERE id = ?', [passwordHash, id]);
  if (result.affectedRows === 0) return res.status(404).json({ error: 'Not found' });
  await writeSystemLog({
    actorUserId: req.user.id,
    module: 'user',
    action: 'reset_password',
    targetType: 'user',
    targetId: id,
    before: beforeRows?.[0] || null,
    after: { passwordHashUpdated: true }
  });
  res.json({ ok: true });
});

usersRouter.delete('/:id', requirePermission('user:manage'), async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) return res.status(400).json({ error: 'Invalid id' });
  const pool = getPool();
  try {
    const [beforeRows] = await pool.query(
      `
      SELECT u.*, r.code AS roleCode, e.name AS experimenterName
      FROM users u
      LEFT JOIN roles r ON r.id = u.role_id
      LEFT JOIN experimenters e ON e.id = u.experimenter_id
      WHERE u.id = ?
      LIMIT 1
      `,
      [id]
    );
    const before = beforeRows?.[0];
    if (!before) return res.status(404).json({ error: 'Not found' });
    if (before.id === req.user.id) {
      return res.status(400).json({ error: '不能删除当前登录账号', code: 'CANNOT_DELETE_SELF' });
    }
    if (before.roleCode === 'customer_booking') {
      const [[orderCount]] = await pool.query(
        `SELECT COUNT(*) AS c FROM bookings WHERE created_by_user_id = ? AND status IN ('pending', 'in_progress')`,
        [id]
      );
      if (Number(orderCount?.c || 0) > 0) {
        return res.status(409).json({
          error: '该用户存在进行中业务，无法删除，请先处理订单',
          code: 'USER_HAS_ACTIVE_ORDERS'
        });
      }
    }
    if (before.roleCode === 'technician' && before.experimenterName) {
      const [[orderCount]] = await pool.query(
        `SELECT COUNT(*) AS c FROM bookings WHERE experimenter = ? AND status IN ('pending', 'in_progress')`,
        [before.experimenterName]
      );
      if (Number(orderCount?.c || 0) > 0) {
        return res.status(409).json({
          error: '该用户存在进行中业务，无法删除，请先处理订单',
          code: 'USER_HAS_ACTIVE_ORDERS'
        });
      }
    }
    const [result] = await pool.query(
      'UPDATE users SET is_deleted = 1, deleted_at = NOW(), is_active = 0 WHERE id = ?',
      [id]
    );
    if (result.affectedRows === 0) return res.status(404).json({ error: 'Not found' });
    await writeSystemLog({
      actorUserId: req.user.id,
      module: 'user',
      action: 'soft_delete',
      targetType: 'user',
      targetId: id,
      before: before || null,
      after: { isDeleted: true, isActive: false }
    });
    return res.json({ ok: true });
  } catch (e) {
    if (e?.code === 'ER_ROW_IS_REFERENCED_2') {
      return res.status(409).json({
        error: '该用户已有操作日志或关联业务数据，不能直接删除。请改为禁用用户。',
        code: 'USER_HAS_REFERENCES'
      });
    }
    throw e;
  }
});

usersRouter.put('/:id/restore', requirePermission('user:manage'), async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) return res.status(400).json({ error: 'Invalid id' });
  const pool = getPool();
  const [beforeRows] = await pool.query('SELECT * FROM users WHERE id = ? LIMIT 1', [id]);
  const [result] = await pool.query(
    'UPDATE users SET is_deleted = 0, deleted_at = NULL, is_active = 1 WHERE id = ?',
    [id]
  );
  if (result.affectedRows === 0) return res.status(404).json({ error: 'Not found' });
  await writeSystemLog({
    actorUserId: req.user.id,
    module: 'user',
    action: 'restore',
    targetType: 'user',
    targetId: id,
    before: beforeRows?.[0] || null,
    after: { isDeleted: false, isActive: true }
  });
  res.json({ ok: true });
});
