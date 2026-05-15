"use strict";

const express = require("express");
const { requireAuth, requireRoles } = require("../middleware/auth");

function parseRange(req) {
  const from = String(req.query.from || "").trim();
  const to = String(req.query.to || "").trim();
  if (!from || !to) return null;
  return { from, to };
}

function createReportsRouter(db) {
  const router = express.Router();
  router.use(requireAuth);
  router.use(requireRoles("admin"));

  router.get("/", (req, res) => {
    const range = parseRange(req);
    if (!range) {
      return res.status(400).json({ error: "Параметры from и to (ISO даты)" });
    }

    const bookingsByStatus = db
      .prepare(
        `SELECT status, COUNT(*) AS cnt FROM bookings
         WHERE datetime(created_at) >= datetime(?)
           AND datetime(created_at) <= datetime(?, '+1 day')
         GROUP BY status`
      )
      .all(range.from, range.to);

    const sessionsFinished = db
      .prepare(
        `SELECT COUNT(*) AS cnt, COALESCE(SUM(actual_minutes), 0) AS minutes_sum,
                COALESCE(SUM(bonus_points), 0) AS bonus_sum
         FROM sessions
         WHERE status = 'finished'
           AND datetime(ended_at) >= datetime(?)
           AND datetime(ended_at) <= datetime(?, '+1 day')`
      )
      .get(range.from, range.to);

    const revenueRows = db
      .prepare(
        `SELECT sim.type,
                COUNT(s.id) AS sessions_cnt,
                COALESCE(SUM(ROUND(s.actual_minutes / 60.0 * sim.hourly_rate_rub)), 0) AS revenue_rub
         FROM sessions s
         JOIN simulators sim ON sim.id = s.simulator_id
         WHERE s.status = 'finished'
           AND datetime(s.ended_at) >= datetime(?)
           AND datetime(s.ended_at) <= datetime(?, '+1 day')
         GROUP BY sim.type`
      )
      .all(range.from, range.to);

    const totalRevenue = revenueRows.reduce(
      (a, r) => a + Number(r.revenue_rub || 0),
      0
    );

    res.json({
      period: range,
      bookingsByStatus,
      sessionsFinished,
      revenueBySimulatorType: revenueRows,
      totalRevenueRub: totalRevenue,
    });
  });

  router.get("/export.csv", (req, res) => {
    const range = parseRange(req);
    if (!range) {
      return res.status(400).type("text/plain").send("from и to обязательны");
    }

    const rows = db
      .prepare(
        `SELECT s.id AS session_id, s.started_at, s.ended_at, s.actual_minutes, s.bonus_points,
                b.id AS booking_id, b.status AS booking_status, b.slot_start, b.duration_minutes,
                sim.code AS simulator, sim.type AS sim_type, sim.hourly_rate_rub,
                ROUND(COALESCE(s.actual_minutes,0) / 60.0 * sim.hourly_rate_rub) AS revenue_rub,
                u.email AS customer_email
         FROM sessions s
         JOIN bookings b ON b.id = s.booking_id
         JOIN simulators sim ON sim.id = s.simulator_id
         JOIN users u ON u.id = b.customer_id
         WHERE s.status = 'finished'
           AND datetime(s.ended_at) >= datetime(?)
           AND datetime(s.ended_at) <= datetime(?, '+1 day')
         ORDER BY s.ended_at ASC`
      )
      .all(range.from, range.to);

    const headers = [
      "session_id",
      "booking_id",
      "customer_email",
      "simulator",
      "sim_type",
      "slot_start",
      "planned_minutes",
      "started_at",
      "ended_at",
      "actual_minutes",
      "hourly_rate_rub",
      "revenue_rub",
      "bonus_points",
    ];

    const esc = (v) => {
      const s = String(v ?? "");
      if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
      return s;
    };

    const lines = [headers.join(",")];
    for (const r of rows) {
      lines.push(
        [
          r.session_id,
          r.booking_id,
          r.customer_email,
          r.simulator,
          r.sim_type,
          r.slot_start,
          r.duration_minutes,
          r.started_at,
          r.ended_at,
          r.actual_minutes,
          r.hourly_rate_rub,
          r.revenue_rub,
          r.bonus_points,
        ]
          .map(esc)
          .join(",")
      );
    }

    const csv = "\uFEFF" + lines.join("\n");
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader(
      "Content-Disposition",
      'attachment; filename="autosim-report.csv"'
    );
    res.send(csv);
  });

  return router;
}

module.exports = { createReportsRouter };
