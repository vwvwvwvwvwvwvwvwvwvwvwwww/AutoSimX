"use strict";

function parseSlot(iso) {
  const d = new Date(String(iso));
  return Number.isNaN(d.getTime()) ? null : d;
}

function intervalsOverlap(aStart, aEndMs, bStart, bEndMs) {
  return aStart.getTime() < bEndMs && bStart.getTime() < aEndMs;
}

function windowFromRow(slotStart, durationMinutes) {
  const s = parseSlot(slotStart);
  if (!s) return null;
  return { start: s, endMs: s.getTime() + Number(durationMinutes) * 60000 };
}

/**
 * @returns {number|null} id конфликтующей брони или null
 */
function findOverlapBookingId(db, simulatorId, slotStart, durationMinutes, excludeBookingId) {
  const w = windowFromRow(slotStart, durationMinutes);
  if (!w) return null;
  let sql = `SELECT id, slot_start, duration_minutes FROM bookings
    WHERE simulator_id = ? AND status IN ('pending', 'confirmed')`;
  const params = [simulatorId];
  if (excludeBookingId) {
    sql += " AND id != ?";
    params.push(excludeBookingId);
  }
  const rows = db.prepare(sql).all(...params);
  for (const row of rows) {
    const bw = windowFromRow(row.slot_start, row.duration_minutes);
    if (bw && intervalsOverlap(w.start, w.endMs, bw.start, bw.endMs)) {
      return row.id;
    }
  }
  return null;
}

function notify(db, userId, kind, message) {
  db.prepare(
    `INSERT INTO notifications (user_id, kind, message) VALUES (?, ?, ?)`
  ).run(userId, kind, message);
}

module.exports = {
  parseSlot,
  findOverlapBookingId,
  notify,
};
