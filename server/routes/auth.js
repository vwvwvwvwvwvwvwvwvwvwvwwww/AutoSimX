"use strict";

const express = require("express");
const bcrypt = require("bcryptjs");
const { COOKIE_NAME, signToken, authCookieOptions } = require("../middleware/auth");

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Убирает zero-width и приводит «длинные» дефисы к обычному минусу (частая ошибка при копировании из PDF/Word). */
function normalizeLoginEmail(raw) {
  return String(raw ?? "")
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .trim()
    .toLowerCase();
}

function normalizeLoginPassword(raw) {
  return String(raw ?? "")
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .trim()
    .replace(/\u2013/g, "-")
    .replace(/\u2014/g, "-")
    .replace(/\u2212/g, "-");
}

function trySignAndSetCookie(res, user) {
  try {
    const token = signToken({
      sub: user.id,
      role: user.role,
      email: user.email,
    });
    res.cookie(COOKIE_NAME, token, authCookieOptions());
    return null;
  } catch (e) {
    console.error("[auth] выдача JWT/cookie:", e);
    return e && e.message
      ? e.message
      : "Не удалось выдать сессию (проверьте JWT_SECRET на сервере).";
  }
}

function createAuthRouter(db) {
  const router = express.Router();

  router.post("/login", (req, res) => {
    const email = normalizeLoginEmail(req.body.email);
    const password = normalizeLoginPassword(req.body.password);

    if (!EMAIL_RE.test(email) || password.length < 1) {
      return res.status(400).json({ error: "Некорректные email или пароль" });
    }

    const user = db
      .prepare(
        `SELECT id, email, password_hash, role, display_name,
                COALESCE(bonus_points, 0) AS bonus_points
         FROM users WHERE email = ?`
      )
      .get(email);

    if (!user) {
      console.warn("[auth] вход: нет пользователя с email", JSON.stringify(email));
      return res.status(401).json({ error: "Неверный email или пароль" });
    }
    if (!bcrypt.compareSync(password, user.password_hash)) {
      console.warn("[auth] вход: неверный пароль для", email);
      return res.status(401).json({ error: "Неверный email или пароль" });
    }

    const cookieErr = trySignAndSetCookie(res, user);
    if (cookieErr) {
      return res.status(503).json({ error: cookieErr });
    }

    res.json({
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        displayName: user.display_name,
        bonusPoints: user.bonus_points,
      },
    });
  });

  router.post("/logout", (_req, res) => {
    res.clearCookie(COOKIE_NAME, { path: "/" });
    res.json({ ok: true });
  });

  /** Без обязательной авторизации: { user: null } если нет сессии. */
  router.get("/me", (req, res) => {
    res.json({ user: req.user || null });
  });

  /** Регистрация только с ролью «клиент» (публичный endpoint). */
  router.post("/register", (req, res) => {
    const email = normalizeLoginEmail(req.body.email);
    const password = normalizeLoginPassword(req.body.password);
    const displayName = String(req.body.displayName || "").trim() || null;

    if (!EMAIL_RE.test(email)) {
      return res.status(400).json({ error: "Некорректный email" });
    }
    if (password.length < 8) {
      return res.status(400).json({ error: "Пароль не короче 8 символов" });
    }

    const hash = bcrypt.hashSync(password, 10);
    try {
      const info = db
        .prepare(
          `INSERT INTO users (email, password_hash, role, display_name)
           VALUES (?, ?, 'customer', ?)`
        )
        .run(email, hash, displayName);

      const user = db
        .prepare(
          `SELECT id, email, role, display_name, COALESCE(bonus_points, 0) AS bonus_points FROM users WHERE id = ?`
        )
        .get(info.lastInsertRowid);

      const cookieErr = trySignAndSetCookie(res, user);
      if (cookieErr) {
        return res.status(503).json({ error: cookieErr });
      }
      res.status(201).json({
        user: {
          id: user.id,
          email: user.email,
          role: user.role,
          displayName: user.display_name,
          bonusPoints: user.bonus_points,
        },
      });
    } catch (e) {
      if (String(e.message).includes("UNIQUE")) {
        return res.status(409).json({ error: "Email уже зарегистрирован" });
      }
      throw e;
    }
  });

  return router;
}

module.exports = { createAuthRouter };
