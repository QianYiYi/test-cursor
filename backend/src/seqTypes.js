import { getPool } from './db.js';
import { SEQ_TYPES } from './constants.js';

const builtinSet = new Set(SEQ_TYPES);

function isMissingSeqTypeTable(err) {
  return err?.code === 'ER_NO_SUCH_TABLE' && String(err?.sqlMessage || '').includes('seq_type_custom');
}

export async function listSeqTypeCustomRows() {
  const pool = getPool();
  try {
    const [rows] = await pool.query(`SELECT id, name FROM seq_type_custom ORDER BY id ASC`);
    return (rows || []).map((r) => ({ id: r.id, name: r.name }));
  } catch (e) {
    if (isMissingSeqTypeTable(e)) return [];
    throw e;
  }
}

export async function getAllSeqTypeNames() {
  const pool = getPool();
  let custom = [];
  try {
    const [rows] = await pool.query(`SELECT name FROM seq_type_custom ORDER BY id ASC`);
    custom = (rows || []).map((r) => r.name);
  } catch (e) {
    if (!isMissingSeqTypeTable(e)) throw e;
  }
  const merged = [...SEQ_TYPES];
  for (const n of custom) {
    if (!merged.includes(n)) merged.push(n);
  }
  return merged;
}

export async function isValidSeqType(name) {
  if (!name || typeof name !== 'string') return false;
  const t = name.trim();
  if (t.length < 1 || t.length > 128) return false;
  if (builtinSet.has(t)) return true;
  const pool = getPool();
  try {
    const [rows] = await pool.query(`SELECT 1 FROM seq_type_custom WHERE name = ? LIMIT 1`, [t]);
    return Boolean(rows?.length);
  } catch (e) {
    if (isMissingSeqTypeTable(e)) return false;
    throw e;
  }
}
