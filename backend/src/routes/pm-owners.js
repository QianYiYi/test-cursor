import express from 'express';
import { z } from 'zod';
import { getPool } from '../db.js';
import { requirePermission } from '../auth.js';
import { writeSystemLog } from '../audit.js';

export const pmOwnersRouter = express.Router();

const pmOwnerSchema = z.object({
  name: z.string().trim().min(1).max(64),
  email: z.string().trim().email().optional().nullable(),
  isActive: z.boolean().optional().default(true)
});

pmOwnersRouter.get('/', requirePermission('booking:read'), async (_req, res) => {
  const pool = getPool();
  const [rows] = await pool.query(
    `
    SELECT
      id,
      name,
      email,
      is_active AS isActive,
      created_at AS createdAt,
      updated_at AS updatedAt
    FROM pm_owners
    ORDER BY is_active DESC, name ASC
    `
  );
  res.json({
    items: (rows || []).map((r) => ({ ...r, isActive: Boolean(r.isActive) }))
  });
});

pmOwnersRouter.post('/', requirePermission('pm-owner:manage'), async (req, res) => {
  const parsed = pmOwnerSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid body', details: parsed.error.flatten() });
  const b = parsed.data;
  const pool = getPool();
  try {
    const [result] = await pool.query(
      `INSERT INTO pm_owners (name, email, is_active) VALUES (?, ?, ?)`,
      [b.name, b.email || null, b.isActive ? 1 : 0]
    );
    await writeSystemLog({
      actorUserId: req.user.id,
      module: 'pm_owner',
      action: 'create',
      targetType: 'pm_owner',
      targetId: result.insertId,
      before: null,
      after: b
    });
    res.status(201).json({ id: result.insertId });
  } catch (e) {
    if (e?.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: 'PM负责人名称已存在', code: 'PM_OWNER_EXISTS' });
    }
    throw e;
  }
});

pmOwnersRouter.put('/:id', requirePermission('pm-owner:manage'), async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) return res.status(400).json({ error: 'Invalid id' });
  const parsed = pmOwnerSchema.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid body', details: parsed.error.flatten() });
  const b = parsed.data;
  const fields = [];
  const params = [];
  const push = (col, val) => {
    fields.push(`${col} = ?`);
    params.push(val);
  };
  if (b.name !== undefined) push('name', b.name);
  if (b.email !== undefined) push('email', b.email || null);
  if (b.isActive !== undefined) push('is_active', b.isActive ? 1 : 0);
  if (!fields.length) return res.status(400).json({ error: 'No fields to update' });

  const pool = getPool();
  try {
    const [beforeRows] = await pool.query('SELECT * FROM pm_owners WHERE id = ? LIMIT 1', [id]);
    const [result] = await pool.query(`UPDATE pm_owners SET ${fields.join(', ')} WHERE id = ?`, [...params, id]);
    if (result.affectedRows === 0) return res.status(404).json({ error: 'Not found' });
    const [afterRows] = await pool.query('SELECT * FROM pm_owners WHERE id = ? LIMIT 1', [id]);
    await writeSystemLog({
      actorUserId: req.user.id,
      module: 'pm_owner',
      action: 'update',
      targetType: 'pm_owner',
      targetId: id,
      before: beforeRows?.[0] || null,
      after: afterRows?.[0] || null
    });
    res.json({ ok: true });
  } catch (e) {
    if (e?.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: 'PM负责人名称已存在', code: 'PM_OWNER_EXISTS' });
    }
    throw e;
  }
});

pmOwnersRouter.delete('/:id', requirePermission('pm-owner:manage'), async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) return res.status(400).json({ error: 'Invalid id' });
  const pool = getPool();
  const [beforeRows] = await pool.query('SELECT * FROM pm_owners WHERE id = ? LIMIT 1', [id]);
  const [result] = await pool.query('DELETE FROM pm_owners WHERE id = ?', [id]);
  if (result.affectedRows === 0) return res.status(404).json({ error: 'Not found' });
  await writeSystemLog({
    actorUserId: req.user.id,
    module: 'pm_owner',
    action: 'delete',
    targetType: 'pm_owner',
    targetId: id,
    before: beforeRows?.[0] || null,
    after: null
  });
  res.json({ ok: true });
});
