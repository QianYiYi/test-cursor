import express from 'express';
import ExcelJS from 'exceljs';
import { getPool } from '../db.js';
import { bookingListQuerySchema } from '../validation.js';
import { bookingsHasTripTimeColumns, selectBookingExportRowSql } from '../bookingColumns.js';

export const exportRouter = express.Router();

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

function buildWhereFromQuery(q) {
  const where = [];
  const params = [];

  const like = (field, value) => {
    if (value == null || value === '') return;
    where.push(`${field} LIKE ?`);
    params.push(`%${value}%`);
  };
  const eq = (field, value) => {
    if (value == null || value === '') return;
    where.push(`${field} = ?`);
    params.push(value);
  };

  like('sales_name', q.salesName);
  like('contract_no', q.contractNo);
  like('customer_unit', q.customerUnit);
  like('customer_name', q.customerName);
  if (q.needDissociation === 'true' || q.needDissociation === 'false') {
    where.push('need_dissociation = ?');
    params.push(q.needDissociation === 'true' ? 1 : 0);
  }
  like('sample_info', q.sampleInfo);
  like('experimenter', q.experimenter);
  if (q.sampleCount != null && q.sampleCount !== '') {
    const n = Number(q.sampleCount);
    if (Number.isFinite(n)) {
      where.push('sample_count = ?');
      params.push(n);
    }
  }
  eq('seq_type', q.seqType);
  like('pm_owner', q.pmOwner);
  eq('platform', q.platform);
  eq('status', q.status);
  if (q.visitFrom) {
    where.push('visit_time >= ?');
    params.push(q.visitFrom);
  }
  if (q.visitTo) {
    where.push('visit_time <= ?');
    params.push(q.visitTo);
  }

  return { whereSql: where.length ? `WHERE ${where.join(' AND ')}` : '', params };
}

exportRouter.get('/bookings.xlsx', async (req, res) => {
  const q = bookingListQuerySchema.safeParse(req.query);
  if (!q.success) return res.status(400).json({ error: 'Invalid query', details: q.error.flatten() });

  const { whereSql, params } = buildWhereFromQuery(q.data);
  const pool = getPool();
  const hasTripCols = await bookingsHasTripTimeColumns();
  const exportSql = selectBookingExportRowSql(hasTripCols);
  const [rows] = await pool.query(
    `
    SELECT
    ${exportSql}
    FROM bookings
    ${whereSql}
    ORDER BY visit_time DESC, id DESC
    `,
    params
  );

  const statusMap = { pending: '待完成', in_progress: '进行中', done: '已完成' };

  const wb = new ExcelJS.Workbook();
  wb.creator = req.user?.name || 'sc-booking';
  wb.created = new Date();
  const ws = wb.addWorksheet('预约记录');

  ws.columns = [
    { header: '操作状态', key: 'status', width: 12 },
    { header: '销售姓名', key: 'salesName', width: 12 },
    { header: '合同编号', key: 'contractNo', width: 18 },
    { header: '客户单位', key: 'customerUnit', width: 24 },
    { header: '客户姓名', key: 'customerName', width: 12 },
    { header: '客户联系方式', key: 'customerContact', width: 18 },
    { header: '是否需要解离', key: 'needDissociation', width: 12 },
    { header: '样本及样本类型', key: 'sampleInfo', width: 28 },
    { header: '服务开始时间', key: 'visitTime', width: 20 },
    { header: '服务结束时间', key: 'serviceEndTime', width: 20 },
    { header: '出差范围开始', key: 'tripStart', width: 20 },
    { header: '出差范围结束', key: 'tripEnd', width: 20 },
    { header: '上门实验员', key: 'experimenter', width: 12 },
    { header: '样本数量', key: 'sampleCount', width: 10 },
    { header: '测序类型', key: 'seqType', width: 26 },
    { header: '测序数据量', key: 'seqDataVolume', width: 14 },
    { header: 'PM负责人', key: 'pmOwner', width: 14 },
    { header: '实验平台', key: 'platform', width: 10 },
    { header: '备注', key: 'remark', width: 30 },
    { header: '通知方式', key: 'notifyMethods', width: 22 }
  ];

  ws.getRow(1).font = { bold: true };
  ws.views = [{ state: 'frozen', ySplit: 1 }];

  for (const r of rows) {
    const notify = normalizeNotifyMethods(r.notifyMethods);
    ws.addRow({
      status: statusMap[r.status] || r.status,
      salesName: r.salesName,
      contractNo: r.contractNo,
      customerUnit: r.customerUnit,
      customerName: r.customerName,
      customerContact: r.customerContact,
      needDissociation: r.needDissociation ? '是' : '否',
      sampleInfo: r.sampleInfo,
      visitTime: r.visitTime,
      serviceEndTime: r.serviceEndTime,
      tripStart: r.tripStart || '',
      tripEnd: r.tripEnd || '',
      experimenter: r.experimenter || '',
      sampleCount: r.sampleCount,
      seqType: r.seqType,
      seqDataVolume: r.seqDataVolume || '',
      pmOwner: r.pmOwner || '',
      platform: r.platform,
      remark: r.remark || '',
      notifyMethods: Array.isArray(notify) ? notify.join(', ') : ''
    });
  }

  const fileName = `单细胞实验室预约记录_${new Date().toISOString().slice(0, 10)}.xlsx`;
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(fileName)}`);
  await wb.xlsx.write(res);
  res.end();
});

