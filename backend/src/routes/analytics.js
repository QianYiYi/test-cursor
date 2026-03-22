import express from 'express';
import { getPool } from '../db.js';
import { STATUS_LABELS } from '../constants.js';

export const analyticsRouter = express.Router();

analyticsRouter.get('/', async (req, res) => {
  const pool = getPool();
  const isTechnician = req.user?.roleCode === 'technician' && req.user?.experimenterName;

  const [statusRows] = await pool.query(
    `SELECT status, COUNT(*) AS count FROM bookings GROUP BY status`
  );

  const [seqRows] = await pool.query(
    `SELECT seq_type AS seqType, COUNT(*) AS count FROM bookings GROUP BY seq_type ORDER BY count DESC`
  );

  const [platformRows] = await pool.query(
    `SELECT platform, COUNT(*) AS count FROM bookings GROUP BY platform ORDER BY count DESC`
  );

  const [trendRows] = await pool.query(
    `
    SELECT DATE(visit_time) AS day, COUNT(*) AS count
    FROM bookings
    WHERE visit_time >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
    GROUP BY DATE(visit_time)
    ORDER BY day ASC
    `
  );

  const [dailyRows] = await pool.query(
    `
    SELECT DATE(visit_time) AS day, COUNT(*) AS count
    FROM bookings
    WHERE visit_time >= DATE_SUB(CURDATE(), INTERVAL 90 DAY)
    GROUP BY DATE(visit_time)
    ORDER BY day ASC
    `
  );

  const total = statusRows.reduce((acc, r) => acc + Number(r.count || 0), 0);
  const status = statusRows.map(r => ({
    status: r.status,
    label: STATUS_LABELS[r.status] || r.status,
    count: Number(r.count || 0)
  }));

  const topSeq = seqRows[0]?.seqType ? { seqType: seqRows[0].seqType, count: Number(seqRows[0].count || 0) } : null;
  const topPlatform = platformRows[0]?.platform ? { platform: platformRows[0].platform, count: Number(platformRows[0].count || 0) } : null;

  const [needDissRows] = await pool.query(
    `SELECT SUM(need_dissociation = 1) AS need, COUNT(*) AS total FROM bookings`
  );
  const needDissociationCount = Number(needDissRows?.[0]?.need || 0);

  let insight = '';
  if (!total) {
    insight = '当前暂无预约数据。录入预约后将展示状态分布、平台/测序类型偏好与近 30 天趋势。';
  } else {
    insight = `当前共有 ${total} 条预约。`;
    if (topSeq) insight += ` 测序类型以「${topSeq.seqType}」为主（${topSeq.count} 单）。`;
    if (topPlatform) insight += ` 实验平台以「${topPlatform.platform}」为主（${topPlatform.count} 单）。`;
    if (needDissociationCount) insight += ` 其中需要解离 ${needDissociationCount} 单，请提前统筹解离与上门排期。`;
  }

  const result = {
    total,
    status,
    seqType: seqRows.map(r => ({ seqType: r.seqType, count: Number(r.count || 0) })),
    platform: platformRows.map(r => ({ platform: r.platform, count: Number(r.count || 0) })),
    trend: trendRows.map(r => ({ day: r.day, count: Number(r.count || 0) })),
    dailyCompany: dailyRows.map(r => ({ day: r.day, count: Number(r.count || 0) })),
    insight
  };

  if (isTechnician) {
    const params = [req.user.experimenterName];
    const [personalStatusRows] = await pool.query(
      `SELECT status, COUNT(*) AS count FROM bookings WHERE experimenter = ? GROUP BY status`,
      params
    );
    const [personalSeqRows] = await pool.query(
      `SELECT seq_type AS seqType, COUNT(*) AS count FROM bookings WHERE experimenter = ? GROUP BY seq_type ORDER BY count DESC`,
      params
    );
    const [personalTrendRows] = await pool.query(
      `
      SELECT DATE(visit_time) AS day, COUNT(*) AS count
      FROM bookings
      WHERE experimenter = ? AND visit_time >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
      GROUP BY DATE(visit_time)
      ORDER BY day ASC
      `,
      params
    );
    const personalTotal = personalStatusRows.reduce((acc, r) => acc + Number(r.count || 0), 0);
    const done = Number(personalStatusRows.find((r) => r.status === 'done')?.count || 0);
    result.personal = {
      experimenter: req.user.experimenterName,
      total: personalTotal,
      done,
      undone: Math.max(0, personalTotal - done),
      status: personalStatusRows.map((r) => ({
        status: r.status,
        label: STATUS_LABELS[r.status] || r.status,
        count: Number(r.count || 0)
      })),
      seqType: personalSeqRows.map((r) => ({ seqType: r.seqType, count: Number(r.count || 0) })),
      trend: personalTrendRows.map((r) => ({ day: r.day, count: Number(r.count || 0) }))
    };
  }

  res.json(result);
});

