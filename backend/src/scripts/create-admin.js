import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { getPool } from '../db.js';

const schema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(6),
  role: z.enum(['admin', 'user']).default('admin')
});

async function main() {
  const name = process.argv[2] || '管理员';
  const email = process.argv[3] || 'admin@example.com';
  const password = process.argv[4] || 'admin1234';
  const role = process.argv[5] || 'admin';

  const parsed = schema.safeParse({ name, email, password, role });
  if (!parsed.success) {
    console.error(parsed.error.flatten());
    process.exit(1);
  }

  const hash = await bcrypt.hash(parsed.data.password, 10);
  const pool = getPool();
  const roleCode = parsed.data.role === 'admin' ? 'super_admin' : 'operator';
  const [[roleRow]] = await pool.query(
    'SELECT id FROM roles WHERE code = ? LIMIT 1',
    [roleCode]
  );
  await pool.query(
    `INSERT INTO users (name, email, password_hash, role, role_id) VALUES (?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE name = VALUES(name), password_hash = VALUES(password_hash), role = VALUES(role), role_id = VALUES(role_id), is_active = 1`,
    [parsed.data.name, parsed.data.email, hash, parsed.data.role, roleRow?.id || null]
  );
  console.log('OK');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

