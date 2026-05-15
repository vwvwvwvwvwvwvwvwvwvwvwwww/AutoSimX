"use strict";

const express = require("express");
const { requireAuth, requireRoles } = require("../middleware/auth");
const { notify } = require("../booking-utils");

function createSessionsRouter(db) {
  const router = express.Router();

  router.get(
    "/active",
    requireAuth,
    requireRoles("admin", "employee"),
    (_req, res) => {
      const rows = db
        .prepare(
          `SELECT s.*, b.slot_start, b.duration_minutes, b.customer_id,
                  u.email AS customer_email,
                  sim.code AS simulator_code, sim.name AS simulator_name
           FROM sessions s
           JOIN bookings b ON b.id = s.booking_id
           JOIN users u ON u.id = b.customer_id
           JOIN simulators sim ON sim.id = s.simulator_id
           WHERE s.status = 'active'
           ORDER BY s.started_at ASC`
        )
        .all();
      res.json({ sessions: rows });
    }
  );

  router.post(
    "/start",
    requireAuth,
    requireRoles("admin", "employee"),
    express.json(),
    (req, res) => {
      const bookingId = Number(req.body.bookingId);
      if (!Number.isInteger(bookingId) || bookingId < 1) {
        return res.status(400).json({ error: "bookingId" });
      }

      const b = db.prepare(`SELECT * FROM bookings WHERE id = ?`).get(bookingId);
      if (!b) return res.status(404).json({ error: "Бронь не найдена" });
      if (b.status !== "confirmed") {
        return res
          .status(409)
          .json({
            error: "Сессию можно начать только для статуса «Подтверждено»",
          });
      }

      const existing = db
        .prepare(`SELECT id FROM sessions WHERE booking_id = ?`)
        .get(bookingId);
      if (existing) {
        return res.status(409).json({ error: "Сессия по этой брони уже создана" });
      }

      const startedAt = new Date();
      const plannedEnd = new Date(
        startedAt.getTime() + b.duration_minutes * 60000
      );

      const info = db
        .prepare(
          `INSERT INTO sessions (booking_id, simulator_id, started_by_user_id, started_at, planned_end_at, status)
           VALUES (?, ?, ?, ?, ?, 'active')`
        )
        .run(
          bookingId,
          b.simulator_id,
          req.user.id,
          startedAt.toISOString(),
          plannedEnd.toISOString()
        );

      const sid = info.lastInsertRowid;
      const row = db
        .prepare(
          `SELECT s.*, b.customer_id, u.email AS customer_email
           FROM sessions s
           JOIN bookings b ON b.id = s.booking_id
           JOIN users u ON u.id = b.customer_id
           WHERE s.id = ?`
        )
        .get(sid);

      notify(
        db,
        b.customer_id,
        "session",
        `Сессия по брони #${bookingId} начата. Плановое окончание: ${plannedEnd.toISOString()}.`
      );

      res.status(201).json({ session: row });
    }
  );

  router.post(
    "/:id/end",
    requireAuth,
    requireRoles("admin", "employee"),
    (req, res) => {
      const id = Number(req.params.id);
      const sess = db.prepare(`SELECT * FROM sessions WHERE id = ?`).get(id);
      if (!sess) return res.status(404).json({ error: "Сессия не найдена" });
      if (sess.status !== "active") {
        return res.status(409).json({ error: "Сессия уже завершена" });
      }

      const endedAt = new Date();
      const started = new Date(sess.started_at);
      const actualMinutes = Math.max(
        1,
        Math.round((endedAt.getTime() - started.getTime()) / 60000)
      );

      const booking = db
        .prepare(`SELECT * FROM bookings WHERE id = ?`)
        .get(sess.booking_id);
      const bonusPoints = Math.floor(actualMinutes / 60) * 10;

      const tx = db.transaction(() => {
        db.prepare(
          `UPDATE sessions SET ended_at = ?, actual_minutes = ?, bonus_points = ?, status = 'finished'
           WHERE id = ?`
        ).run(endedAt.toISOString(), actualMinutes, bonusPoints, id);

        db.prepare(
          `UPDATE bookings SET status = 'completed', updated_at = datetime('now') WHERE id = ?`
        ).run(sess.booking_id);

        db.prepare(
          `UPDATE users SET bonus_points = bonus_points + ?, updated_at = datetime('now') WHERE id = ?`
        ).run(bonusPoints, booking.customer_id);
      });

      tx();

      notify(
        db,
        booking.customer_id,
        "session",
        `Сессия завершена. Фактически ${actualMinutes} мин., начислено бонусов: ${bonusPoints}.`
      );

      const updated = db.prepare(`SELECT * FROM sessions WHERE id = ?`).get(id);
      res.json({ session: updated, bonusPointsAwarded: bonusPoints });
    }
  );

  return router;
}

module.exports = { createSessionsRouter };
