import { getPool } from './db.js';

export async function writeBookingLog({ bookingId, actorUserId, action, before, after }) {
  const pool = getPool();
  await pool.query(
    `INSERT INTO booking_logs (booking_id, actor_user_id, action, before_json, after_json)
     VALUES (?, ?, ?, ?, ?)`,
    [
      bookingId ?? null,
      actorUserId,
      action,
      before ? JSON.stringify(before) : null,
      after ? JSON.stringify(after) : null
    ]
  );
}

export async function writeSystemLog({ actorUserId, module, action, targetType, targetId, before, after }) {
  const pool = getPool();
  await pool.query(
    `INSERT INTO system_audit_logs (actor_user_id, module, action, target_type, target_id, before_json, after_json)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      actorUserId,
      module,
      action,
      targetType,
      targetId ? String(targetId) : null,
      before ? JSON.stringify(before) : null,
      after ? JSON.stringify(after) : null
    ]
  );
}

