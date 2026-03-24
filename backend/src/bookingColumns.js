import { getPool } from './db.js';

/** 是否具备 trip 列：每次查询 information_schema，避免执行迁移后进程仍缓存「无列」误判 */
export async function bookingsHasTripTimeColumns() {
  const pool = getPool();
  const [rows] = await pool.query(
    `
    SELECT COUNT(*) AS n
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'bookings'
      AND COLUMN_NAME IN ('trip_start_time', 'trip_end_time')
    `
  );
  return Number(rows?.[0]?.n) >= 2;
}

export const BOOKING_TRIP_MIGRATION_HINT =
  '数据库缺少 trip_start_time/trip_end_time 字段，请执行 db/migrations/003_booking_trip_window.sql 或重新导入 db/schema.sql';

function tripSelectFragment(hasTrip) {
  return hasTrip
    ? `trip_start_time AS tripStart,
      trip_end_time AS tripEnd,`
    : `NULL AS tripStart,
      NULL AS tripEnd,`;
}

/** 列表 / 编辑前快照 / 删除前快照（与 routes/bookings 中原 SELECT 对齐） */
export function selectBookingListRowSql(hasTrip, { includeCreatedUpdated = false } = {}) {
  const trip = tripSelectFragment(hasTrip);
  const tail = includeCreatedUpdated
    ? `,
      created_at AS createdAt,
      updated_at AS updatedAt`
    : '';
  return `
      id,
      sales_name AS salesName,
      contract_no AS contractNo,
      customer_unit AS customerUnit,
      customer_name AS customerName,
      customer_contact AS customerContact,
      need_dissociation AS needDissociation,
      sample_info AS sampleInfo,
      visit_time AS visitTime,
      service_end_time AS serviceEndTime,
      ${trip}
      experimenter,
      sample_count AS sampleCount,
      seq_type AS seqType,
      seq_data_volume AS seqDataVolume,
      pm_owner AS pmOwner,
      platform,
      remark,
      notify_methods AS notifyMethods,
      status,
      created_by_user_id AS createdByUserId${tail}
  `;
}

/** 日历「某日」列表项（与预约登记表单字段对齐，便于弹窗展示） */
export function selectBookingCalendarDayItemSql(hasTrip) {
  const trip = tripSelectFragment(hasTrip);
  return `
      id,
      sales_name AS salesName,
      contract_no AS contractNo,
      customer_unit AS customerUnit,
      customer_name AS customerName,
      customer_contact AS customerContact,
      need_dissociation AS needDissociation,
      sample_info AS sampleInfo,
      visit_time AS visitTime,
      service_end_time AS serviceEndTime,
      ${trip}
      experimenter,
      sample_count AS sampleCount,
      seq_type AS seqType,
      seq_data_volume AS seqDataVolume,
      pm_owner AS pmOwner,
      platform,
      remark,
      notify_methods AS notifyMethods,
      status,
      created_by_user_id AS createdByUserId
  `;
}

/** Excel 导出列顺序 */
export function selectBookingExportRowSql(hasTrip) {
  const trip = tripSelectFragment(hasTrip);
  return `
      status,
      sales_name AS salesName,
      contract_no AS contractNo,
      customer_unit AS customerUnit,
      customer_name AS customerName,
      customer_contact AS customerContact,
      need_dissociation AS needDissociation,
      sample_info AS sampleInfo,
      visit_time AS visitTime,
      service_end_time AS serviceEndTime,
      ${trip}
      experimenter,
      sample_count AS sampleCount,
      seq_type AS seqType,
      seq_data_volume AS seqDataVolume,
      pm_owner AS pmOwner,
      platform,
      remark,
      notify_methods AS notifyMethods
  `;
}
