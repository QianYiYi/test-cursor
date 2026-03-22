import jwt from 'jsonwebtoken';
import { getPool } from './db.js';
import { getLegacyAccess, parseJsonArray } from './access.js';

const TOKEN_TTL_SECONDS = 60 * 60 * 12; // 12h

export function signToken(user) {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET is required');
  return jwt.sign(
    { sub: String(user.id), role: user.role, name: user.name, email: user.email },
    secret,
    { expiresIn: TOKEN_TTL_SECONDS }
  );
}

export function verifyToken(token) {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET is required');
  return jwt.verify(token, secret);
}

export function requireAuth(req, res, next) {
  (async () => {
    const header = req.headers.authorization || '';
    const m = header.match(/^Bearer\s+(.+)$/i);
    if (!m) return res.status(401).json({ error: 'Unauthorized' });
    const payload = verifyToken(m[1]);
    const access = await resolveUserAccess(Number(payload.sub), payload.role);
    req.user = {
      id: Number(payload.sub),
      role: payload.role,
      name: payload.name,
      email: payload.email,
      roleId: access.roleId,
      roleCode: access.roleCode,
      roleName: access.roleName,
      permissions: access.permissions,
      menus: access.menus,
      experimenterId: access.experimenterId,
      experimenterName: access.experimenterName
    };
    return next();
  })().catch(() => {
    return res.status(401).json({ error: 'Unauthorized' });
  });
}

export function requireRole(role) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
    if (req.user.role !== role) return res.status(403).json({ error: 'Forbidden' });
    return next();
  };
}

export async function resolveUserAccess(userId, legacyRole = 'user') {
  const pool = getPool();
  let rows;
  try {
    const [result] = await pool.query(
      `
      SELECT
        r.id AS roleId,
        r.code AS roleCode,
        r.name AS roleName,
        r.permissions_json AS permissionsJson,
        r.menus_json AS menusJson,
        u.experimenter_id AS experimenterId,
        e.name AS experimenterName
      FROM users u
      LEFT JOIN roles r ON r.id = u.role_id
      LEFT JOIN experimenters e ON e.id = u.experimenter_id
      WHERE u.id = ?
      LIMIT 1
      `,
      [userId]
    );
    rows = result;
  } catch (e) {
    if (e?.code !== 'ER_BAD_FIELD_ERROR') throw e;
    const [fallbackRows] = await pool.query(
      `
      SELECT
        r.id AS roleId,
        r.code AS roleCode,
        r.name AS roleName,
        r.permissions_json AS permissionsJson,
        r.menus_json AS menusJson,
        NULL AS experimenterId,
        NULL AS experimenterName
      FROM users u
      LEFT JOIN roles r ON r.id = u.role_id
      WHERE u.id = ?
      LIMIT 1
      `,
      [userId]
    );
    rows = fallbackRows;
  }
  const row = rows?.[0];
  if (!row || !row.roleId) {
    const legacy = getLegacyAccess(legacyRole);
    return {
      roleId: null,
      roleCode: legacyRole,
      roleName: legacyRole,
      permissions: legacy.permissions,
      menus: legacy.menus,
      experimenterId: null,
      experimenterName: null
    };
  }
  return {
    roleId: row.roleId,
    roleCode: row.roleCode,
    roleName: row.roleName,
    permissions: parseJsonArray(row.permissionsJson),
    menus: parseJsonArray(row.menusJson),
    experimenterId: row.experimenterId ?? null,
    experimenterName: row.experimenterName ?? null
  };
}

export function hasPermission(user, permission) {
  if (!user) return false;
  const perms = Array.isArray(user.permissions) ? user.permissions : [];
  return perms.includes('*') || perms.includes(permission);
}

export function requirePermission(permission) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
    if (!hasPermission(req.user, permission)) {
      return res.status(403).json({ error: 'Forbidden', code: 'NO_PERMISSION', permission });
    }
    return next();
  };
}

