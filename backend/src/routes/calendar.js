import express from 'express';
import { getPool } from '../db.js';
import { bookingsHasTripTimeColumns, selectBookingCalendarDayItemSql } from '../bookingColumns.js';

export const calendarRouter = express.Router();

/** 单日单量：≤8 不忙，9–16 忙碌，≥17 爆满（消除 8 的区间歧义） */
function busyLevelFromOrderCount(orderCount) {
  const n = Number(orderCount || 0);
  if (n <= 8) return { code: 'idle', label: '不忙' };
  if (n <= 16) return { code: 'busy', label: '忙碌' };
  return { code: 'full', label: '爆满' };
}

function overlapsCalendarDay(visitTime, serviceEndTime, dayStr) {
  const dayStart = new Date(`${dayStr}T00:00:00`);
  const dayNext = new Date(dayStart);
  dayNext.setDate(dayNext.getDate() + 1);
  const vs = new Date(String(visitTime).replace(' ', 'T'));
  const es = new Date(String(serviceEndTime).replace(' ', 'T'));
  return vs < dayNext && es >= dayStart;
}

function addDaysYmd(ymd, delta) {
  const [y, m, d] = ymd.split('-').map(Number);
  const dt = new Date(y, m - 1, d + delta);
  const yy = dt.getFullYear();
  const mm = String(dt.getMonth() + 1).padStart(2, '0');
  const dd = String(dt.getDate()).padStart(2, '0');
  return `${yy}-${mm}-${dd}`;
}

function todayYmd() {
  const dt = new Date();
  const yy = dt.getFullYear();
  const mm = String(dt.getMonth() + 1).padStart(2, '0');
  const dd = String(dt.getDate()).padStart(2, '0');
  return `${yy}-${mm}-${dd}`;
}

/** 近 90 天每日：订单数、样本量合计、剩余实验员 */
calendarRouter.get('/summary', async (req, res) => {
  const pool = getPool();
  const [[{ totalExp }]] = await pool.query(
    `SELECT COUNT(*) AS totalExp FROM experimenters WHERE is_active = 1`
  );
  const activeN = Number(totalExp || 0);

  const endYmd = todayYmd();
  /** 含过去 30 天 + 未来约 59 天，便于日历切换月份仍能看到单量 */
  const startYmd = addDaysYmd(endYmd, -30);
  const endRangeYmd = addDaysYmd(endYmd, 59);
  const rangeEnd = `${endRangeYmd} 23:59:59`;
  const rangeStart = `${startYmd} 00:00:00`;

  const [rows] = await pool.query(
    `
    SELECT visit_time AS visitTime, service_end_time AS serviceEndTime,
           sample_count AS sampleCount, experimenter
    FROM bookings
    WHERE visit_time <= ? AND service_end_time >= ?
    `,
    [rangeEnd, rangeStart]
  );

  const days = [];
  let cursor = startYmd;
  while (cursor <= endRangeYmd) {
    const dayStr = cursor;
    const overlapping = (rows || []).filter((b) =>
      overlapsCalendarDay(b.visitTime, b.serviceEndTime, dayStr)
    );
    const orderCount = overlapping.length;
    const sampleSum = overlapping.reduce((acc, b) => acc + Number(b.sampleCount || 0), 0);
    const busyNames = new Set();
    for (const b of overlapping) {
      if (b.experimenter && String(b.experimenter).trim()) busyNames.add(String(b.experimenter).trim());
    }
    const busyExperimenters = busyNames.size;
    const remainingExperimenters = Math.max(0, activeN - busyExperimenters);
    const busyLevel = busyLevelFromOrderCount(orderCount);
    days.push({
      day: dayStr,
      orderCount,
      sampleSum,
      busyExperimenters,
      remainingExperimenters,
      busyLevel: busyLevel.code,
      busyLabel: busyLevel.label
    });
    cursor = addDaysYmd(cursor, 1);
  }

  res.json({ activeExperimenters: activeN, days });
});

calendarRouter.get('/day', async (req, res) => {
  const date = String(req.query.date || '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return res.status(400).json({ error: 'Invalid date' });
  }
  const pool = getPool();
  const dayStart = `${date} 00:00:00`;
  const hasTripCols = await bookingsHasTripTimeColumns();
  const rowSql = selectBookingCalendarDayItemSql(hasTripCols);

  const [allRows] = await pool.query(
    `
    SELECT
    ${rowSql}
    FROM bookings
    WHERE visit_time < DATE_ADD(?, INTERVAL 1 DAY)
      AND service_end_time >= ?
    ORDER BY visit_time ASC, id ASC
    `,
    [date, dayStart]
  );

  const overlapRows = (allRows || []).filter((b) =>
    overlapsCalendarDay(b.visitTime, b.serviceEndTime, date)
  );

  const companyOrderCount = overlapRows.length;
  const companySampleSum = overlapRows.reduce((acc, b) => acc + Number(b.sampleCount || 0), 0);

  const isCustomer = req.user?.roleCode === 'customer_booking';
  let items = overlapRows;
  if (isCustomer) {
    items = overlapRows.filter((b) => Number(b.createdByUserId) === Number(req.user.id));
  }

  res.json({
    date,
    companyOrderCount,
    companySampleSum,
    items: items.map((r) => ({
      id: r.id,
      salesName: r.salesName,
      contractNo: r.contractNo,
      customerUnit: r.customerUnit,
      customerName: r.customerName,
      customerContact: r.customerContact,
      visitTime: r.visitTime,
      serviceEndTime: r.serviceEndTime,
      tripStart: r.tripStart,
      tripEnd: r.tripEnd,
      experimenter: r.experimenter,
      sampleCount: r.sampleCount,
      seqType: r.seqType,
      platform: r.platform,
      status: r.status
    }))
  });
});
