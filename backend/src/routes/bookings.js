import express from 'express';
import { getPool } from '../db.js';
import { writeBookingLog } from '../audit.js';
import { findExperimenterDateConflicts } from '../conflicts.js';
import { notifyExperimenterForBooking } from '../notifications.js';
import { requirePermission } from '../auth.js';
import {
  assertBookingTripVisitConsistency,
  bookingCreateSchema,
  bookingListQuerySchema,
  bookingUpdateSchema
} from '../validation.js';
import { isValidSeqType } from '../seqTypes.js';
import {
  bookingsHasTripTimeColumns,
  selectBookingListRowSql,
  BOOKING_TRIP_MIGRATION_HINT
} from '../bookingColumns.js';

export const bookingsRouter = express.Router();

bookingsRouter.post('/reassign-experimenter', requirePermission('booking:assign'), async (req, res) => {
  const { fromExperimenter, toExperimenter, includeDone = false } = req.body || {};
  if (!fromExperimenter || !toExperimenter) {
    return res.status(400).json({ error: 'fromExperimenter 和 toExperimenter 为必填' });
  }
  if (String(fromExperimenter) === String(toExperimenter)) {
    return res.status(400).json({ error: '目标实验员不能与原实验员相同' });
  }
  const target = await getExperimenterByName(String(toExperimenter));
  if (!target) return res.status(400).json({ error: '目标实验员不存在' });
  if (!target.isActive) return res.status(400).json({ error: '目标实验员已停用，不能分配' });

  const pool = getPool();
  const statusClause = includeDone ? '' : `AND status IN ('pending', 'in_progress')`;
  const [rows] = await pool.query(
    `SELECT id, status, experimenter FROM bookings WHERE experimenter = ? ${statusClause}`,
    [fromExperimenter]
  );
  if (!rows.length) return res.json({ ok: true, affected: 0 });

  const ids = rows.map((r) => Number(r.id)).filter(Number.isFinite);
  const placeholders = ids.map(() => '?').join(',');
  await pool.query(
    `UPDATE bookings SET experimenter = ? WHERE id IN (${placeholders})`,
    [toExperimenter, ...ids]
  );
  for (const row of rows) {
    await writeBookingLog({
      bookingId: row.id,
      actorUserId: req.user.id,
      action: 'update',
      before: { experimenter: fromExperimenter, status: row.status },
      after: { experimenter: toExperimenter, status: row.status }
    });
  }
  return res.json({ ok: true, affected: ids.length });
});

function normalizeNotifyMethods(value) {
  if (value == null) return [];
  if (Array.isArray(value)) return value;
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return value
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
    }
  }
  return [];
}

function likeOrEqWhere({ field, value, params, where, mode = 'like' }) {
  if (value == null || value === '') return;
  if (mode === 'eq') {
    where.push(`${field} = ?`);
    params.push(value);
    return;
  }
  where.push(`${field} LIKE ?`);
  params.push(`%${value}%`);
}

function applyDataScope({ req, where, params }) {
  if (req.user?.roleCode === 'customer_booking') {
    where.push('created_by_user_id = ?');
    params.push(req.user.id);
    return;
  }
  if (req.user?.roleCode === 'technician') {
    if (!req.user.experimenterName) {
      where.push('1 = 0');
      return;
    }
    where.push('experimenter = ?');
    params.push(req.user.experimenterName);
  }
}

async function getExperimenterByName(name) {
  if (!name) return null;
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
      is_active AS isActive
    FROM experimenters
    WHERE name = ?
    LIMIT 1
    `,
    [name]
  );
  const row = rows?.[0];
  if (!row) return null;
  return {
    ...row,
    isActive: Boolean(row.isActive),
    notifyMethods: normalizeNotifyMethods(row.notifyMethods)
  };
}

bookingsRouter.get('/', requirePermission('booking:read'), async (req, res) => {
  const q = bookingListQuerySchema.safeParse(req.query);
  if (!q.success) return res.status(400).json({ error: 'Invalid query', details: q.error.flatten() });

  const {
    salesName,
    contractNo,
    customerUnit,
    customerName,
    needDissociation,
    sampleInfo,
    experimenter,
    sampleCount,
    seqType,
    pmOwner,
    platform,
    status,
    visitFrom,
    visitTo,
    onDate,
    page = '1',
    pageSize = '50'
  } = q.data;

  const p = Math.max(1, Number(page) || 1);
  const ps = Math.min(200, Math.max(1, Number(pageSize) || 50));
  const offset = (p - 1) * ps;

  const where = [];
  const params = [];

  likeOrEqWhere({ field: 'sales_name', value: salesName, params, where });
  likeOrEqWhere({ field: 'contract_no', value: contractNo, params, where });
  likeOrEqWhere({ field: 'customer_unit', value: customerUnit, params, where });
  likeOrEqWhere({ field: 'customer_name', value: customerName, params, where });
  if (needDissociation === 'true' || needDissociation === 'false') {
    where.push('need_dissociation = ?');
    params.push(needDissociation === 'true' ? 1 : 0);
  }
  likeOrEqWhere({ field: 'sample_info', value: sampleInfo, params, where });
  likeOrEqWhere({ field: 'experimenter', value: experimenter, params, where });
  if (sampleCount != null && sampleCount !== '') {
    const n = Number(sampleCount);
    if (!Number.isFinite(n)) return res.status(400).json({ error: 'Invalid sampleCount' });
    where.push('sample_count = ?');
    params.push(n);
  }
  likeOrEqWhere({ field: 'seq_type', value: seqType, params, where, mode: 'eq' });
  likeOrEqWhere({ field: 'pm_owner', value: pmOwner, params, where });
  likeOrEqWhere({ field: 'platform', value: platform, params, where, mode: 'eq' });
  likeOrEqWhere({ field: 'status', value: status, params, where, mode: 'eq' });
  if (visitFrom) {
    where.push('visit_time >= ?');
    params.push(visitFrom);
  }
  if (visitTo) {
    where.push('visit_time <= ?');
    params.push(visitTo);
  }
  if (onDate) {
    where.push('visit_time < DATE_ADD(?, INTERVAL 1 DAY) AND service_end_time >= ?');
    params.push(onDate, `${onDate} 00:00:00`);
  }
  applyDataScope({ req, where, params });

  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

  const pool = getPool();
  const hasTripCols = await bookingsHasTripTimeColumns();

  const [[countRow]] = await pool.query(
    `SELECT COUNT(*) AS total FROM bookings ${whereSql}`,
    params
  );
  const total = Number(countRow.total || 0);

  const listSql = selectBookingListRowSql(hasTripCols, { includeCreatedUpdated: true });
  const [rows] = await pool.query(
    `
    SELECT
    ${listSql}
    FROM bookings
    ${whereSql}
    ORDER BY visit_time DESC, id DESC
    LIMIT ? OFFSET ?
    `,
    [...params, ps, offset]
  );

  res.json({
    page: p,
    pageSize: ps,
    total,
    items: rows.map(r => ({
      ...r,
      needDissociation: Boolean(r.needDissociation),
      notifyMethods: normalizeNotifyMethods(r.notifyMethods)
    }))
  });
});

bookingsRouter.post('/', requirePermission('booking:create'), async (req, res) => {
  const parsed = bookingCreateSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid body', details: parsed.error.flatten() });
  const b = parsed.data;

  if (!(await isValidSeqType(b.seqType))) {
    return res.status(400).json({ error: '无效的测序类型' });
  }

  const pool = getPool();
  const experimenter = await getExperimenterByName(b.experimenter);
  if (!experimenter) {
    return res.status(400).json({ error: '上门实验员不存在，请先在实验员配置中创建' });
  }
  if (!experimenter.isActive) {
    return res.status(400).json({ error: '上门实验员已停用，不能用于新预约' });
  }
  const conflicts = await findExperimenterDateConflicts({
    experimenter: b.experimenter,
    visitTime: b.visitTime,
    serviceEndTime: b.serviceEndTime,
    excludeBookingId: null
  });
  if (conflicts.length) {
    return res.status(409).json({
      error: '排班冲突：该实验员在该时间段已有预约',
      code: 'SCHEDULE_CONFLICT',
      conflicts
    });
  }

  try {
    let result;
    try {
      [result] = await pool.query(
      `
      INSERT INTO bookings
        (sales_name, contract_no, customer_unit, customer_name, customer_contact,
         need_dissociation, sample_info, visit_time, service_end_time, trip_start_time, trip_end_time, experimenter, sample_count,
         seq_type, seq_data_volume, pm_owner, platform, remark, notify_methods, status, created_by_user_id)
      VALUES
        (?, ?, ?, ?, ?,
         ?, ?, ?, ?, ?, ?, ?, ?,
         ?, ?, ?, ?, ?, ?, 'pending', ?)
      `,
      [
        b.salesName,
        b.contractNo,
        b.customerUnit,
        b.customerName,
        b.customerContact,
        b.needDissociation ? 1 : 0,
        b.sampleInfo,
        b.visitTime,
        b.serviceEndTime,
        b.tripStart,
        b.tripEnd,
        b.experimenter,
        b.sampleCount,
        b.seqType,
        b.seqDataVolume || null,
        b.pmOwner || null,
        b.platform,
        b.remark || null,
        b.notifyMethods ? JSON.stringify(b.notifyMethods) : null,
        req.user.id
      ]
      );
    } catch (insertError) {
      if (insertError?.code !== 'ER_BAD_FIELD_ERROR') throw insertError;
      [result] = await pool.query(
        `
        INSERT INTO bookings
          (sales_name, contract_no, customer_unit, customer_name, customer_contact,
           need_dissociation, sample_info, visit_time, service_end_time, trip_start_time, trip_end_time, experimenter, sample_count,
           seq_type, seq_data_volume, pm_owner, platform, remark, notify_methods, status)
        VALUES
          (?, ?, ?, ?, ?,
           ?, ?, ?, ?, ?, ?, ?, ?,
           ?, ?, ?, ?, ?, ?, 'pending')
        `,
        [
          b.salesName,
          b.contractNo,
          b.customerUnit,
          b.customerName,
          b.customerContact,
          b.needDissociation ? 1 : 0,
          b.sampleInfo,
          b.visitTime,
          b.serviceEndTime,
          b.tripStart,
          b.tripEnd,
          b.experimenter,
          b.sampleCount,
          b.seqType,
          b.seqDataVolume || null,
          b.pmOwner || null,
          b.platform,
          b.remark || null,
          b.notifyMethods ? JSON.stringify(b.notifyMethods) : null
        ]
      );
    }
    await writeBookingLog({
      bookingId: result.insertId,
      actorUserId: req.user.id,
      action: 'create',
      before: null,
      after: { ...b, status: 'pending', id: result.insertId }
    });
    const notifySummary = await notifyExperimenterForBooking({
      booking: { ...b, id: result.insertId },
      experimenter
    });
    res.status(201).json({ id: result.insertId, notifySummary });
  } catch (e) {
    if (e && e.code === 'ER_BAD_FIELD_ERROR' && String(e?.message || '').includes('trip_')) {
      return res.status(503).json({
        error: BOOKING_TRIP_MIGRATION_HINT,
        code: 'DB_MIGRATION_REQUIRED'
      });
    }
    throw e;
  }
});

bookingsRouter.put('/:id', requirePermission('booking:update'), async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) return res.status(400).json({ error: 'Invalid id' });

  const parsed = bookingUpdateSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid body', details: parsed.error.flatten() });
  const b = parsed.data;
  if (b.seqType !== undefined && !(await isValidSeqType(b.seqType))) {
    return res.status(400).json({ error: '无效的测序类型' });
  }

  const hasTripCols = await bookingsHasTripTimeColumns();
  if (
    !hasTripCols &&
    (b.tripStart !== undefined || b.tripEnd !== undefined)
  ) {
    return res.status(503).json({ error: BOOKING_TRIP_MIGRATION_HINT, code: 'DB_MIGRATION_REQUIRED' });
  }

  if (req.user?.roleCode === 'technician') {
    const keys = Object.keys(b);
    const onlyStatus = keys.length === 1 && keys[0] === 'status';
    if (!onlyStatus) {
      return res.status(403).json({ error: '技术员仅可修改自己订单状态', code: 'TECHNICIAN_STATUS_ONLY' });
    }
  }

  const sets = [];
  const params = [];

  const map = {
    salesName: 'sales_name',
    contractNo: 'contract_no',
    customerUnit: 'customer_unit',
    customerName: 'customer_name',
    customerContact: 'customer_contact',
    sampleInfo: 'sample_info',
    visitTime: 'visit_time',
    serviceEndTime: 'service_end_time',
    tripStart: 'trip_start_time',
    tripEnd: 'trip_end_time',
    experimenter: 'experimenter',
    sampleCount: 'sample_count',
    seqType: 'seq_type',
    seqDataVolume: 'seq_data_volume',
    pmOwner: 'pm_owner',
    platform: 'platform',
    remark: 'remark',
    status: 'status'
  };

  for (const [k, col] of Object.entries(map)) {
    if (b[k] === undefined) continue;
    if (!hasTripCols && (k === 'tripStart' || k === 'tripEnd')) continue;
    sets.push(`${col} = ?`);
    params.push(b[k]);
  }

  if (b.needDissociation !== undefined) {
    sets.push('need_dissociation = ?');
    params.push(b.needDissociation ? 1 : 0);
  }

  if (b.notifyMethods !== undefined) {
    sets.push('notify_methods = ?');
    params.push(b.notifyMethods ? JSON.stringify(b.notifyMethods) : null);
  }

  if (!sets.length) return res.status(400).json({ error: 'No fields to update' });

  const pool = getPool();
  try {
    const rowSql = selectBookingListRowSql(hasTripCols, { includeCreatedUpdated: false });
    const [beforeRows] = await pool.query(
      `
      SELECT
      ${rowSql}
      FROM bookings WHERE id = ? LIMIT 1
      `,
      [id]
    );
    const before = beforeRows?.[0]
      ? {
          ...beforeRows[0],
          needDissociation: Boolean(beforeRows[0].needDissociation),
          notifyMethods: normalizeNotifyMethods(beforeRows[0].notifyMethods)
        }
      : null;
    if (req.user?.roleCode === 'customer_booking' && before?.createdByUserId !== req.user.id) {
      return res.status(403).json({ error: '只能修改自己创建的预约', code: 'SCOPE_FORBIDDEN' });
    }
    if (req.user?.roleCode === 'technician' && before?.experimenter !== req.user.experimenterName) {
      return res.status(403).json({ error: '只能修改分配给自己的预约', code: 'SCOPE_FORBIDDEN' });
    }
    if (b.experimenter !== undefined && !req.user.permissions?.includes('*') && !req.user.permissions?.includes('booking:assign')) {
      return res.status(403).json({ error: '无权重新分配实验员', code: 'NO_ASSIGN_PERMISSION' });
    }

    const nextExperimenter = b.experimenter !== undefined ? (b.experimenter ?? null) : (before?.experimenter ?? null);
    if (nextExperimenter) {
      const e = await getExperimenterByName(nextExperimenter);
      if (!e) return res.status(400).json({ error: '上门实验员不存在，请先在实验员配置中创建' });
      if (!e.isActive) return res.status(400).json({ error: '上门实验员已停用，不能用于预约' });
    }
    const nextVisitTime = b.visitTime !== undefined ? b.visitTime : before?.visitTime;
    const nextServiceEndTime = b.serviceEndTime !== undefined ? b.serviceEndTime : before?.serviceEndTime;
    const nextTripStart = b.tripStart !== undefined ? b.tripStart : before?.tripStart;
    const nextTripEnd = b.tripEnd !== undefined ? b.tripEnd : before?.tripEnd;

    if ((b.tripStart !== undefined && b.tripEnd === undefined) || (b.tripStart === undefined && b.tripEnd !== undefined)) {
      return res.status(400).json({ error: '出差服务范围需同时填写开始与结束' });
    }
    if (nextVisitTime && nextServiceEndTime) {
      const start = Date.parse(String(nextVisitTime).replace(' ', 'T'));
      const end = Date.parse(String(nextServiceEndTime).replace(' ', 'T'));
      if (Number.isFinite(start) && Number.isFinite(end) && end <= start) {
        return res.status(400).json({ error: '服务结束时间必须晚于开始时间' });
      }
    }
    if (nextTripStart && nextTripEnd && nextVisitTime && nextServiceEndTime) {
      const tripErr = assertBookingTripVisitConsistency({
        tripStart: nextTripStart,
        tripEnd: nextTripEnd,
        visitTime: nextVisitTime,
        serviceEndTime: nextServiceEndTime
      });
      if (tripErr) return res.status(400).json({ error: tripErr });
    }
    const conflicts = await findExperimenterDateConflicts({
      experimenter: nextExperimenter,
      visitTime: nextVisitTime,
      serviceEndTime: nextServiceEndTime,
      excludeBookingId: id
    });
    if (conflicts.length) {
      return res.status(409).json({
        error: '排班冲突：该实验员在该时间段已有预约',
        code: 'SCHEDULE_CONFLICT',
        conflicts
      });
    }

    const [result] = await pool.query(
      `UPDATE bookings SET ${sets.join(', ')} WHERE id = ?`,
      [...params, id]
    );

    if (result.affectedRows === 0) return res.status(404).json({ error: 'Not found' });

    const [afterRows] = await pool.query(
      `
      SELECT
      ${rowSql}
      FROM bookings WHERE id = ? LIMIT 1
      `,
      [id]
    );
    const after = afterRows?.[0]
      ? {
          ...afterRows[0],
          needDissociation: Boolean(afterRows[0].needDissociation),
          notifyMethods: normalizeNotifyMethods(afterRows[0].notifyMethods)
        }
      : null;

    const isStatusChange = before && after && before.status !== after.status;
    await writeBookingLog({
      bookingId: id,
      actorUserId: req.user.id,
      action: isStatusChange ? 'status_change' : 'update',
      before,
      after
    });

    res.json({ ok: true });
  } catch (e) {
    if (e && e.code === 'ER_BAD_FIELD_ERROR' && String(e?.message || '').includes('trip_')) {
      return res.status(503).json({ error: BOOKING_TRIP_MIGRATION_HINT, code: 'DB_MIGRATION_REQUIRED' });
    }
    throw e;
  }
});

bookingsRouter.delete('/:id', requirePermission('booking:delete'), async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) return res.status(400).json({ error: 'Invalid id' });
  const pool = getPool();
  const hasTripCols = await bookingsHasTripTimeColumns();
  const rowSql = selectBookingListRowSql(hasTripCols, { includeCreatedUpdated: false });
  const [beforeRows] = await pool.query(
    `
    SELECT
    ${rowSql}
    FROM bookings WHERE id = ? LIMIT 1
    `,
    [id]
  );
  const before = beforeRows?.[0]
    ? {
        ...beforeRows[0],
        needDissociation: Boolean(beforeRows[0].needDissociation),
        notifyMethods: normalizeNotifyMethods(beforeRows[0].notifyMethods)
      }
    : null;
  if (req.user?.roleCode === 'customer_booking' && before?.createdByUserId !== req.user.id) {
    return res.status(403).json({ error: '只能删除自己创建的预约', code: 'SCOPE_FORBIDDEN' });
  }
  const [result] = await pool.query('DELETE FROM bookings WHERE id = ?', [id]);
  if (result.affectedRows === 0) return res.status(404).json({ error: 'Not found' });
  await writeBookingLog({
    // Keep delete audit in before_json; booking row is gone already.
    bookingId: null,
    actorUserId: req.user.id,
    action: 'delete',
    before,
    after: null
  });
  res.json({ ok: true });
});

