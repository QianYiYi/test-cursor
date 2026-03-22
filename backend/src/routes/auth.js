import express from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { getPool } from '../db.js';
import { requireAuth, resolveUserAccess, signToken } from '../auth.js';

export const authRouter = express.Router();

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6).max(128)
});

authRouter.post('/login', async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid body', details: parsed.error.flatten() });
  const { email, password } = parsed.data;

  const pool = getPool();
  const [rows] = await pool.query(
    `SELECT id, name, email, password_hash AS passwordHash, role, is_active AS isActive, is_deleted AS isDeleted
     FROM users WHERE email = ? LIMIT 1`,
    [email]
  );
  const u = rows?.[0];
  if (!u || !u.isActive || u.isDeleted) return res.status(401).json({ error: 'Invalid credentials' });

  const ok = await bcrypt.compare(password, u.passwordHash);
  if (!ok) return res.status(401).json({ error: 'Invalid credentials' });

  const access = await resolveUserAccess(u.id, u.role);
  const token = signToken({ id: u.id, role: u.role, name: u.name, email: u.email });
  res.json({
    token,
    user: {
      id: u.id,
      name: u.name,
      email: u.email,
      role: u.role,
      roleId: access.roleId,
      roleCode: access.roleCode,
      roleName: access.roleName,
      permissions: access.permissions,
      menus: access.menus,
      experimenterId: access.experimenterId,
      experimenterName: access.experimenterName
    }
  });
});

authRouter.get('/me', requireAuth, async (req, res) => {
  res.json({
    user: {
      id: req.user.id,
      name: req.user.name,
      email: req.user.email,
      role: req.user.role,
      roleId: req.user.roleId,
      roleCode: req.user.roleCode,
      roleName: req.user.roleName,
      permissions: req.user.permissions || [],
      menus: req.user.menus || [],
      experimenterId: req.user.experimenterId ?? null,
      experimenterName: req.user.experimenterName ?? null
    }
  });
});

