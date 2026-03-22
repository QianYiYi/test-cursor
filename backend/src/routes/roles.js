import express from 'express';
import { z } from 'zod';
import { getPool } from '../db.js';
import { INTERFACE_PERMISSION_MAP, MENU_OPTIONS, PERMISSION_OPTIONS, parseJsonArray } from '../access.js';
import { requirePermission } from '../auth.js';
import { writeSystemLog } from '../audit.js';

export const rolesRouter = express.Router();

const roleSchema = z.object({
  name: z.string().trim().min(1).max(64),
  code: z.string().trim().min(1).max(64).regex(/^[a-z][a-z0-9_]*$/),
  description: z.string().trim().max(255).optional().nullable(),
  permissions: z.array(z.string().min(1)).max(200).default([]),
  menus: z.array(z.string().min(1)).max(200).default([]),
  isActive: z.boolean().optional().default(true)
});

rolesRouter.get('/meta', requirePermission('role:manage'), (_req, res) => {
  res.json({
    permissionOptions: PERMISSION_OPTIONS,
    menuOptions: MENU_OPTIONS,
    interfacePermissionMap: INTERFACE_PERMISSION_MAP
  });
});

rolesRouter.get('/', requirePermission('role:manage'), async (_req, res) => {
  const pool = getPool();
  const [rows] = await pool.query(
    `SELECT id, name, code, description, permissions_json AS permissions, menus_json AS menus, is_active AS isActive, created_at AS createdAt, updated_at AS updatedAt
     FROM roles ORDER BY id ASC`
  );
  res.json({
    items: rows.map((r) => ({
      ...r,
      isActive: Boolean(r.isActive),
      permissions: parseJsonArray(r.permissions),
      menus: parseJsonArray(r.menus)
    }))
  });
});

rolesRouter.post('/', requirePermission('role:manage'), async (req, res) => {
  const parsed = roleSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid body', details: parsed.error.flatten() });
  const b = parsed.data;
  const pool = getPool();
  try {
    const [result] = await pool.query(
      `INSERT INTO roles (name, code, description, permissions_json, menus_json, is_active)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        b.name,
        b.code,
        b.description || null,
        JSON.stringify(b.permissions || []),
        JSON.stringify(b.menus || []),
        b.isActive ? 1 : 0
      ]
    );
    await writeSystemLog({
      actorUserId: req.user.id,
      module: 'role',
      action: 'create',
      targetType: 'role',
      targetId: result.insertId,
      before: null,
      after: b
    });
    res.status(201).json({ id: result.insertId });
  } catch (e) {
    if (e?.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: '角色名称或编码重复', code: 'ROLE_EXISTS' });
    throw e;
  }
});

rolesRouter.put('/:id', requirePermission('role:manage'), async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) return res.status(400).json({ error: 'Invalid id' });
  const parsed = roleSchema.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid body', details: parsed.error.flatten() });
  const b = parsed.data;
  const sets = [];
  const params = [];
  const push = (k, v) => { sets.push(`${k} = ?`); params.push(v); };
  if (b.name !== undefined) push('name', b.name);
  if (b.code !== undefined) push('code', b.code);
  if (b.description !== undefined) push('description', b.description || null);
  if (b.permissions !== undefined) push('permissions_json', JSON.stringify(b.permissions || []));
  if (b.menus !== undefined) push('menus_json', JSON.stringify(b.menus || []));
  if (b.isActive !== undefined) push('is_active', b.isActive ? 1 : 0);
  if (!sets.length) return res.status(400).json({ error: 'No fields to update' });
  const pool = getPool();
  try {
    const [beforeRows] = await pool.query('SELECT * FROM roles WHERE id = ? LIMIT 1', [id]);
    const [result] = await pool.query(`UPDATE roles SET ${sets.join(', ')} WHERE id = ?`, [...params, id]);
    if (result.affectedRows === 0) return res.status(404).json({ error: 'Not found' });
    const [afterRows] = await pool.query('SELECT * FROM roles WHERE id = ? LIMIT 1', [id]);
    await writeSystemLog({
      actorUserId: req.user.id,
      module: 'role',
      action: 'update',
      targetType: 'role',
      targetId: id,
      before: beforeRows?.[0] || null,
      after: afterRows?.[0] || null
    });
    res.json({ ok: true });
  } catch (e) {
    if (e?.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: '角色名称或编码重复', code: 'ROLE_EXISTS' });
    throw e;
  }
});

rolesRouter.delete('/:id', requirePermission('role:manage'), async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) return res.status(400).json({ error: 'Invalid id' });
  const pool = getPool();
  const [beforeRows] = await pool.query('SELECT * FROM roles WHERE id = ? LIMIT 1', [id]);
  const [result] = await pool.query('DELETE FROM roles WHERE id = ?', [id]);
  if (result.affectedRows === 0) return res.status(404).json({ error: 'Not found' });
  await writeSystemLog({
    actorUserId: req.user.id,
    module: 'role',
    action: 'delete',
    targetType: 'role',
    targetId: id,
    before: beforeRows?.[0] || null,
    after: null
  });
  res.json({ ok: true });
});
