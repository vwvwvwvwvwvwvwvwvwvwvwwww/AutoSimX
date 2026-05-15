"use strict";

const express = require("express");
const bcrypt = require("bcryptjs");
const { requireAuth, requireRoles } = require("../middleware/auth");

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ROLES_STAFF = new Set(["admin", "employee", "customer"]);

function createUsersRouter(db) {
  const router = express.Router();

  router.use(requireAuth);
  router.use(requireRoles("admin"));

  router.get("/", (_req, res) => {
    const rows = db
      .prepare(
        `SELECT id, email, role, display_name, created_at,
                COALESCE(bonus_points, 0) AS bonus_points
         FROM users ORDER BY id ASC`
      )
      .all();
    res.json({ users: rows });
  });

  /**
   * Создание пользователя админом (сотрудник, клиент или другой админ).
   * body: { email, password, role, displayName? }
   */
  router.post("/", express.json(), (req, res) => {
    const email = String(req.body.email || "").trim().toLowerCase();
    const password = String(req.body.password || "");
    const role = String(req.body.role || "").trim();
    const displayName = String(req.body.displayName || "").trim() || null;

    if (!EMAIL_RE.test(email)) {
      return res.status(400).json({ error: "Некорректный email" });
    }
    if (password.length < 8) {
      return res.status(400).json({ error: "Пароль не короче 8 символов" });
    }
    if (!ROLES_STAFF.has(role)) {
      return res.status(400).json({ error: "Недопустимая роль" });
    }

    const hash = bcrypt.hashSync(password, 10);
    try {
      const info = db
        .prepare(
          `INSERT INTO users (email, password_hash, role, display_name)
           VALUES (?, ?, ?, ?)`
        )
        .run(email, hash, role, displayName);

      const user = db
        .prepare(
          `SELECT id, email, role, display_name, created_at FROM users WHERE id = ?`
        )
        .get(info.lastInsertRowid);

      res.status(201).json({ user });
    } catch (e) {
      if (String(e.message).includes("UNIQUE")) {
        return res.status(409).json({ error: "Email уже занят" });
      }
      throw e;
    }
  });

  return router;
}

module.exports = { createUsersRouter };
