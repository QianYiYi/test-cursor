import { getPool } from './db.js';

export async function findExperimenterDateConflicts({ experimenter, visitTime, serviceEndTime, excludeBookingId }) {
  if (!experimenter) return [];
  if (!visitTime) return [];
  if (!serviceEndTime) return [];

  const pool = getPool();
  const sql = `
    SELECT
      id,
      contract_no AS contractNo,
      customer_unit AS customerUnit,
      customer_name AS customerName,
      visit_time AS visitTime,
      service_end_time AS serviceEndTime,
      status
    FROM bookings
    WHERE experimenter = ?
      AND visit_time < ?
      AND service_end_time > ?
      AND id <> COALESCE(?, -1)
    ORDER BY visit_time ASC
  `;
  const [rows] = await pool.query(sql, [experimenter, serviceEndTime, visitTime, excludeBookingId ?? null]);
  return rows || [];
}

