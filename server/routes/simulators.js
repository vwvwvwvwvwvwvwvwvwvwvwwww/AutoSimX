"use strict";

const express = require("express");
const { requireAuth, requireRoles } = require("../middleware/auth");
const { notify } = require("../booking-utils");

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
