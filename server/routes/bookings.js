"use strict";

const express = require("express");
const { requireAuth, requireRoles } = require("../middleware/auth");
const { findOverlapBookingId, parseSlot, notify } = require("../booking-utils");

function bookingRow(db, id) {
  return db
    .prepare(
      `SELECT b.*, s.code AS simulator_code, s.name AS simulator_name, s.type AS simulator_type,
              u.email AS customer_email
       FROM bookings b
       JOIN simulators s ON s.id = b.simulator_id
       JOIN users u ON u.id = b.customer_id
       WHERE b.id = ?`
    )
    .get(id);
}

function createBookingsRouter(db) {
  const router = express.Router();

  router.get("/mine", requireAuth, requireRoles("customer"), (req, res) => {
    const rows = db
      .prepare(
        `SELECT b.*, s.code AS simulator_code, s.name AS simulator_name, s.type AS simulator_type
         FROM bookings b
         JOIN simulators s ON s.id = b.simulator_id
         WHERE b.customer_id = ?
         ORDER BY b.slot_start DESC`
      )
      .all(req.user.id);
    res.json({ bookings: rows });
  });

  router.get(
    "/",
    requireAuth,
    requireRoles("admin", "employee"),
    (_req, res) => {
      const rows = db
        .prepare(
          `SELECT b.*, s.code AS simulator_code, s.name AS simulator_name, s.type AS simulator_type,
                  u.email AS customer_email, u.display_name AS customer_name
           FROM bookings b
           JOIN simulators s ON s.id = b.simulator_id
           JOIN users u ON u.id = b.customer_id
           ORDER BY
             CASE b.status WHEN 'pending' THEN 0 WHEN 'confirmed' THEN 1 ELSE 2 END,
             b.slot_start ASC`
        )
        .all();
      res.json({ bookings: rows });
    }
  );

  router.get("/availability-check", requireAuth, (req, res) => {
    const simulatorId = Number(req.query.simulatorId);
    const slotStart = String(req.query.slotStart || "").trim();
    const durationMinutes = Number(req.query.durationMinutes || 60);
    if (!Number.isInteger(simulatorId) || simulatorId < 1) {
      return res.status(400).json({ error: "simulatorId" });
    }
    if (!parseSlot(slotStart)) {
      return res.status(400).json({ error: "slotStart (ISO)" });
    }
    const sim = db
      .prepare(`SELECT id, status, name FROM simulators WHERE id = ?`)
      .get(simulatorId);
    if (!sim) return res.status(404).json({ error: "Симулятор не найден" });
    if (sim.status !== "ready") {
      return res.json({
        available: false,
        reason: "Стенд на техобслуживании",
        simulator: sim,
      });
    }
    const clash = findOverlapBookingId(
      db,
      simulatorId,
      slotStart,
      durationMinutes,
      null
    );
    res.json({
      available: !clash,
      conflictBookingId: clash || undefined,
      simulator: sim,
    });
  });

  router.post(
    "/",
    requireAuth,
    requireRoles("customer"),
    express.json(),
    (req, res) => {
      const simulatorId = Number(req.body.simulatorId);
      const slotStart = String(req.body.slotStart || "").trim();
      const durationMinutes = Number(req.body.durationMinutes || 60);

      if (!Number.isInteger(simulatorId) || simulatorId < 1) {
        return res.status(400).json({ error: "simulatorId" });
      }
      if (!parseSlot(slotStart)) {
        return res
          .status(400)
          .json({ error: "Некорректная дата/время slotStart (ISO 8601)" });
      }
      if (
        !Number.isInteger(durationMinutes) ||
        durationMinutes < 30 ||
        durationMinutes > 240
      ) {
        return res.status(400).json({ error: "durationMinutes: 30–240" });
      }

      const sim = db
        .prepare(`SELECT id, status FROM simulators WHERE id = ?`)
        .get(simulatorId);
      if (!sim) return res.status(404).json({ error: "Симулятор не найден" });
      if (sim.status !== "ready") {
        return res.status(409).json({ error: "Стенд недоступен (ТО)" });
      }

      const clash = findOverlapBookingId(
        db,
        simulatorId,
        slotStart,
        durationMinutes,
        null
      );
      if (clash) {
        return res
          .status(409)
          .json({ error: "Слот занят, выберите другое время" });
      }

      const info = db
        .prepare(
          `INSERT INTO bookings (customer_id, simulator_id, slot_start, duration_minutes, status)
           VALUES (?, ?, ?, ?, 'pending')`
        )
        .run(req.user.id, simulatorId, slotStart, durationMinutes);

      const row = bookingRow(db, info.lastInsertRowid);
      res.status(201).json({ booking: row });
    }
  );

  router.patch(
    "/:id",
    requireAuth,
    requireRoles("admin", "employee"),
    express.json(),
    (req, res) => {
      const id = Number(req.params.id);
      const status = String(req.body.status || "").trim();
      if (!["confirmed", "cancelled"].includes(status)) {
        return res.status(400).json({ error: "status: confirmed | cancelled" });
      }

      const b = db.prepare(`SELECT * FROM bookings WHERE id = ?`).get(id);
      if (!b) return res.status(404).json({ error: "Бронь не найдена" });
      if (b.status !== "pending" && b.status !== "confirmed") {
        return res.status(409).json({ error: "Нельзя сменить статус" });
      }
      if (b.status === status) {
        return res.json({ booking: bookingRow(db, id) });
      }

      if (status === "confirmed") {
        const sim = db
          .prepare(`SELECT status FROM simulators WHERE id = ?`)
          .get(b.simulator_id);
        if (!sim || sim.status !== "ready") {
          return res
            .status(409)
            .json({ error: "Стенд на ТО — подтверждение невозможно" });
        }
        const clash = findOverlapBookingId(
          db,
          b.simulator_id,
          b.slot_start,
          b.duration_minutes,
          id
        );
        if (clash) {
          return res.status(409).json({ error: "Пересечение с другой бронью" });
        }
      }

      if (status === "cancelled" && b.status === "confirmed") {
        const act = db
          .prepare(
            `SELECT id FROM sessions WHERE booking_id = ? AND status = 'active'`
          )
          .get(id);
        if (act) {
          return res
            .status(409)
            .json({ error: "Сначала завершите активную сессию по этой брони" });
        }
      }

      db.prepare(
        `UPDATE bookings SET status = ?, updated_at = datetime('now') WHERE id = ?`
      ).run(status, id);

      if (status === "confirmed") {
        notify(
          db,
          b.customer_id,
          "booking",
          `Бронь #${id} подтверждена. ${b.slot_start}, ${b.duration_minutes} мин.`
        );
      } else if (status === "cancelled") {
        notify(
          db,
          b.customer_id,
          "booking",
          `Бронь #${id} отменена администратором.`
        );
      }

      res.json({ booking: bookingRow(db, id) });
    }
  );

  return router;
}

module.exports = { createBookingsRouter };
