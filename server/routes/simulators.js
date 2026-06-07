"use strict";

const express = require("express");
const { requireAuth, requireRoles } = require("../middleware/auth");
const { notify } = require("../booking-utils");

const SIM_TYPES = new Set(["standart", "pro", "vr", "motion", "kids"]);
const SIM_STATUSES = new Set(["ready", "maintenance"]);
const CODE_RE = /^[A-Za-z0-9][A-Za-z0-9\-_]*$/;

function createSimulatorsRouter(db) {
  const router = express.Router();

  router.get("/", requireAuth, (_req, res) => {
    const rows = db
      .prepare(
        `SELECT id, code, name, type, hourly_rate_rub, status, updated_at
         FROM simulators ORDER BY id ASC`
      )
      .all();
    res.json({ simulators: rows });
  });

  /**
   * Добавление стенда (оборудования). Только администратор.
   * body: { code, name, type, hourlyRateRub?, status? }
   */
  router.post(
    "/",
    requireAuth,
    requireRoles("admin"),
    express.json(),
    (req, res) => {
      const code = String(req.body.code || "").trim();
      const name = String(req.body.name || "").trim();
      const type = String(req.body.type || "").trim();
      const hourlyRateRub = Number(
        req.body.hourlyRateRub ?? req.body.hourly_rate_rub ?? 300
      );
      const status = String(req.body.status || "ready").trim();

      if (!code || code.length > 32) {
        return res
          .status(400)
          .json({ error: "Укажите код стенда (до 32 символов)" });
      }
      if (!CODE_RE.test(code)) {
        return res.status(400).json({
          error: "Код: латиница, цифры, дефис или подчёркивание",
        });
      }
      if (!name || name.length > 120) {
        return res
          .status(400)
          .json({ error: "Укажите название (до 120 символов)" });
      }
      if (!SIM_TYPES.has(type)) {
        return res.status(400).json({
          error: "type: standart | pro | vr | motion | kids",
        });
      }
      if (
        !Number.isInteger(hourlyRateRub) ||
        hourlyRateRub < 1 ||
        hourlyRateRub > 999999
      ) {
        return res.status(400).json({ error: "hourlyRateRub: целое от 1 до 999999" });
      }
      if (!SIM_STATUSES.has(status)) {
        return res.status(400).json({ error: "status: ready | maintenance" });
      }

      try {
        const info = db
          .prepare(
            `INSERT INTO simulators (code, name, type, hourly_rate_rub, status)
             VALUES (?, ?, ?, ?, ?)`
          )
          .run(code, name, type, hourlyRateRub, status);

        const row = db
          .prepare(
            `SELECT id, code, name, type, hourly_rate_rub, status, updated_at
             FROM simulators WHERE id = ?`
          )
          .get(info.lastInsertRowid);
        res.status(201).json({ simulator: row });
      } catch (e) {
        if (String(e.message).includes("UNIQUE")) {
          return res.status(409).json({ error: "Стенд с таким кодом уже есть" });
        }
        console.error(e);
        return res.status(500).json({ error: "Не удалось добавить стенд" });
      }
    }
  );

  /**
   * Техобслуживание: status maintenance → блок слотов; ready → разблок.
   * body: { status: 'maintenance'|'ready', partOrder?: { partName, qtyNotes? } }
   */
  router.patch(
    "/:id",
    requireAuth,
    requireRoles("admin", "employee"),
    express.json(),
    (req, res) => {
      const id = Number(req.params.id);
      if (!Number.isInteger(id) || id < 1) {
        return res.status(400).json({ error: "Некорректный id" });
      }
      const status = String(req.body.status || "").trim();
      if (status !== "maintenance" && status !== "ready") {
        return res.status(400).json({ error: "status: maintenance или ready" });
      }

      const sim = db
        .prepare(`SELECT id, name, code FROM simulators WHERE id = ?`)
        .get(id);
      if (!sim) return res.status(404).json({ error: "Симулятор не найден" });

      const partOrder = req.body.partOrder;

      const tx = db.transaction(() => {
        db.prepare(
          `UPDATE simulators SET status = ?, updated_at = datetime('now') WHERE id = ?`
        ).run(status, id);

        if (status === "maintenance") {
          const pending = db
            .prepare(
              `SELECT id, customer_id FROM bookings
               WHERE simulator_id = ? AND status = 'pending'`
            )
            .all(id);
          for (const b of pending) {
            db.prepare(
              `UPDATE bookings SET status = 'cancelled', updated_at = datetime('now') WHERE id = ?`
            ).run(b.id);
            notify(
              db,
              b.customer_id,
              "booking",
              `Бронь #${b.id} отменена: стенд «${sim.name}» переведён на техобслуживание.`
            );
          }

          if (partOrder && String(partOrder.partName || "").trim()) {
            db.prepare(
              `INSERT INTO maintenance_orders (simulator_id, part_name, qty_notes, status, created_by_user_id)
               VALUES (?, ?, ?, 'draft', ?)`
            ).run(
              id,
              String(partOrder.partName).trim(),
              String(partOrder.qtyNotes || "").trim() || null,
              req.user.id
            );
          }
        }
      });

      try {
        tx();
      } catch (e) {
        console.error(e);
        return res.status(500).json({ error: "Не удалось обновить" });
      }

      const updated = db
        .prepare(
          `SELECT id, code, name, type, hourly_rate_rub, status, updated_at FROM simulators WHERE id = ?`
        )
        .get(id);
      res.json({ simulator: updated });
    }
  );

  router.get(
    "/maintenance-orders",
    requireAuth,
    requireRoles("admin", "employee"),
    (_req, res) => {
      const rows = db
        .prepare(
          `SELECT o.id, o.simulator_id, s.code AS simulator_code, s.name AS simulator_name,
                  o.part_name, o.qty_notes, o.status, o.created_at,
                  u.email AS created_by_email
           FROM maintenance_orders o
           JOIN simulators s ON s.id = o.simulator_id
           JOIN users u ON u.id = o.created_by_user_id
           ORDER BY o.id DESC`
        )
        .all();
      res.json({ orders: rows });
    }
  );

  router.patch(
    "/maintenance-orders/:orderId",
    requireAuth,
    requireRoles("admin", "employee"),
    express.json(),
    (req, res) => {
      const orderId = Number(req.params.orderId);
      const st = String(req.body.status || "").trim();
      if (!["ordered", "done", "cancelled"].includes(st)) {
        return res
          .status(400)
          .json({ error: "status: ordered | done | cancelled" });
      }
      const info = db
        .prepare(
          `UPDATE maintenance_orders SET status = ? WHERE id = ? AND status != 'cancelled'`
        )
        .run(st, orderId);
      if (info.changes === 0) {
        return res.status(404).json({ error: "Заявка не найдена" });
      }
      const row = db
        .prepare(`SELECT * FROM maintenance_orders WHERE id = ?`)
        .get(orderId);
      res.json({ order: row });
    }
  );

  return router;
}

module.exports = { createSimulatorsRouter };
