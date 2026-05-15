"use strict";

const express = require("express");
const { requireAuth } = require("../middleware/auth");

function createNotificationsRouter(db) {
  const router = express.Router();

  router.get("/", requireAuth, (req, res) => {
    const rows = db
      .prepare(
        `SELECT id, kind, message, read_at, created_at
         FROM notifications
         WHERE user_id = ?
         ORDER BY id DESC
         LIMIT 100`
      )
      .all(req.user.id);
    res.json({ notifications: rows });
  });

  router.patch("/:id/read", requireAuth, express.json(), (req, res) => {
    const id = Number(req.params.id);
    const info = db
      .prepare(
        `UPDATE notifications SET read_at = datetime('now')
         WHERE id = ? AND user_id = ? AND read_at IS NULL`
      )
      .run(id, req.user.id);
    if (info.changes === 0) {
      return res.status(404).json({ error: "Уведомление не найдено" });
    }
    res.json({ ok: true });
  });

  return router;
}

module.exports = { createNotificationsRouter };
