import express from 'express';
import { z } from 'zod';
import { getPool } from '../db.js';
import { requirePermission } from '../auth.js';
import { getAllSeqTypeNames, listSeqTypeCustomRows } from '../seqTypes.js';

export const seqTypesRouter = express.Router();

const nameSchema = z.object({
  name: z.string().trim().min(1).max(128)
});

seqTypesRouter.get('/', async (_req, res) => {
  const [all, custom] = await Promise.all([getAllSeqTypeNames(), listSeqTypeCustomRows()]);
  res.json({ all, custom });
});

seqTypesRouter.post('/', requirePermission('seq-type:manage'), async (req, res) => {
  const parsed = nameSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid body', details: parsed.error.flatten() });
  const { name } = parsed.data;
  const pool = getPool();
  try {
    const [result] = await pool.query(`INSERT INTO seq_type_custom (name) VALUES (?)`, [name]);
    res.status(201).json({ id: result.insertId });
  } catch (e) {
    if (e?.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: '该测序类型已存在', code: 'SEQ_TYPE_EXISTS' });
    if (e?.code === 'ER_NO_SUCH_TABLE' && String(e?.sqlMessage || '').includes('seq_type_custom')) {
      return res.status(503).json({
        error: '数据库缺少 seq_type_custom 表，请执行 db/migrations/001_seq_type_custom.sql 或重新导入 db/schema.sql',
        code: 'SEQ_TYPE_TABLE_MISSING'
      });
    }
    throw e;
  }
});

seqTypesRouter.delete('/:id', requirePermission('seq-type:manage'), async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) return res.status(400).json({ error: 'Invalid id' });
  const pool = getPool();
  try {
    const [result] = await pool.query(`DELETE FROM seq_type_custom WHERE id = ?`, [id]);
    if (result.affectedRows === 0) return res.status(404).json({ error: 'Not found' });
    res.json({ ok: true });
  } catch (e) {
    if (e?.code === 'ER_NO_SUCH_TABLE' && String(e?.sqlMessage || '').includes('seq_type_custom')) {
      return res.status(503).json({
        error: '数据库缺少 seq_type_custom 表，请执行 db/migrations/001_seq_type_custom.sql 或重新导入 db/schema.sql',
        code: 'SEQ_TYPE_TABLE_MISSING'
      });
    }
    throw e;
  }
});
