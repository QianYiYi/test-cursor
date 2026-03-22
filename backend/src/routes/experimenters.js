import express from 'express';
import { z } from 'zod';
import { getPool } from '../db.js';
import { NOTIFY_METHODS } from '../constants.js';
import { requirePermission } from '../auth.js';
import { writeSystemLog } from '../audit.js';

export const experimentersRouter = express.Router();

const experimenterSchema = z.object({
  name: z.string().trim().min(1).max(64),
  notifyMethods: z.array(z.enum(NOTIFY_METHODS)).max(10).default([]),
  email: z.string().trim().email().optional().nullable(),
  phone: z.string().trim().max(32).optional().nullable(),
  teamsId: z.string().trim().max(128).optional().nullable(),
  wechatId: z.string().trim().max(128).optional().nullable(),
  otherContact: z.string().trim().max(255).optional().nullable(),
  isActive: z.boolean().optional().default(true)
});

function parseNotifyMethods(value) {
  if (Array.isArray(value)) return value;
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

experimentersRouter.get('/', requirePermission('experimenter:read'), async (_req, res) => {
  const pool = getPool();
  const [rows] = await pool.query(
    `
    SELECT
      id,
      name,
      notify_methods AS notifyMethods,
      email,
      phone,
      teams_id AS teamsId,
      wechat_id AS wechatId,
      other_contact AS otherContact,
      is_active AS isActive,
      created_at AS createdAt,
      updated_at AS updatedAt
    FROM experimenters
    ORDER BY is_active DESC, name ASC
    `
  );
  res.json({
    items: rows.map((r) => ({
      ...r,
      notifyMethods: parseNotifyMethods(r.notifyMethods),
      isActive: Boolean(r.isActive)
    }))
  });
});

experimentersRouter.post('/', requirePermission('experimenter:manage'), async (req, res) => {
  const parsed = experimenterSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid body', details: parsed.error.flatten() });

  const b = parsed.data;
  const pool = getPool();
  try {
    const [result] = await pool.query(
      `INSERT INTO experimenters
        (name, notify_methods, email, phone, teams_id, wechat_id, other_contact, is_active)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        b.name,
        JSON.stringify(b.notifyMethods || []),
        b.email || null,
        b.phone || null,
        b.teamsId || null,
        b.wechatId || null,
        b.otherContact || null,
        b.isActive ? 1 : 0
      ]
    );
    await writeSystemLog({
      actorUserId: req.user.id,
      module: 'experimenter',
      action: 'create',
      targetType: 'experimenter',
      targetId: result.insertId,
      before: null,
      after: b
    });
    res.status(201).json({ id: result.insertId });
  } catch (e) {
    if (e?.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: '实验员名称已存在', code: 'EXPERIMENTER_EXISTS' });
    }
    throw e;
  }
});

experimentersRouter.put('/:id', requirePermission('experimenter:manage'), async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) return res.status(400).json({ error: 'Invalid id' });

  const parsed = experimenterSchema.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid body', details: parsed.error.flatten() });
  const b = parsed.data;
  const fields = [];
  const params = [];

  const append = (col, val) => {
    fields.push(`${col} = ?`);
    params.push(val);
  };
  if (b.name !== undefined) append('name', b.name);
  if (b.notifyMethods !== undefined) append('notify_methods', JSON.stringify(b.notifyMethods || []));
  if (b.email !== undefined) append('email', b.email || null);
  if (b.phone !== undefined) append('phone', b.phone || null);
  if (b.teamsId !== undefined) append('teams_id', b.teamsId || null);
  if (b.wechatId !== undefined) append('wechat_id', b.wechatId || null);
  if (b.otherContact !== undefined) append('other_contact', b.otherContact || null);
  if (b.isActive !== undefined) append('is_active', b.isActive ? 1 : 0);

  if (!fields.length) return res.status(400).json({ error: 'No fields to update' });

  const pool = getPool();
  try {
    const [beforeRows] = await pool.query('SELECT * FROM experimenters WHERE id = ? LIMIT 1', [id]);
    const [result] = await pool.query(
      `UPDATE experimenters SET ${fields.join(', ')} WHERE id = ?`,
      [...params, id]
    );
    if (result.affectedRows === 0) return res.status(404).json({ error: 'Not found' });
    const [afterRows] = await pool.query('SELECT * FROM experimenters WHERE id = ? LIMIT 1', [id]);
    await writeSystemLog({
      actorUserId: req.user.id,
      module: 'experimenter',
      action: 'update',
      targetType: 'experimenter',
      targetId: id,
      before: beforeRows?.[0] || null,
      after: afterRows?.[0] || null
    });
    res.json({ ok: true });
  } catch (e) {
    if (e?.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: '实验员名称已存在', code: 'EXPERIMENTER_EXISTS' });
    }
    throw e;
  }
});

experimentersRouter.delete('/:id', requirePermission('experimenter:manage'), async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) return res.status(400).json({ error: 'Invalid id' });
  const pool = getPool();
  const [beforeRows] = await pool.query('SELECT * FROM experimenters WHERE id = ? LIMIT 1', [id]);
  const [result] = await pool.query('DELETE FROM experimenters WHERE id = ?', [id]);
  if (result.affectedRows === 0) return res.status(404).json({ error: 'Not found' });
  await writeSystemLog({
    actorUserId: req.user.id,
    module: 'experimenter',
    action: 'delete',
    targetType: 'experimenter',
    targetId: id,
    before: beforeRows?.[0] || null,
    after: null
  });
  res.json({ ok: true });
});
