"use strict";

const jwt = require("jsonwebtoken");

const COOKIE_NAME = "autosim_auth";

function getJwtSecret() {
  const s = process.env.JWT_SECRET;
  if (!s || s.length < 16) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("Задайте JWT_SECRET (не короче 16 символов) в .env");
    }
    return "dev-only-secret-change-me";
  }
  return s;
}

function signToken(payload) {
  return jwt.sign(
    {
      role: payload.role,
      email: payload.email,
    },
    getJwtSecret(),
    {
      expiresIn: "7d",
      subject: String(payload.sub),
    }
  );
}

function verifyToken(token) {
  if (!token) return null;
  try {
    return jwt.verify(token, getJwtSecret());
  } catch {
    return null;
  }
}

function authCookieOptions() {
  const isProd = process.env.NODE_ENV === "production";
  return {
    httpOnly: true,
    sameSite: "lax",
    secure: isProd,
    maxAge: 7 * 24 * 60 * 60 * 1000,
    path: "/",
  };
}

function attachUser(db) {
  return function attachUserMiddleware(req, res, next) {
    const token = req.cookies[COOKIE_NAME];
    const decoded = verifyToken(token);
    req.user = null;
    if (!decoded || !decoded.sub) return next();

    const row = db
      .prepare(
        `SELECT id, email, role, display_name, created_at,
                COALESCE(bonus_points, 0) AS bonus_points
         FROM users WHERE id = ?`
      )
      .get(Number(decoded.sub));

    if (row) {
      req.user = {
        id: row.id,
        email: row.email,
        role: row.role,
        displayName: row.display_name,
        createdAt: row.created_at,
        bonusPoints: row.bonus_points,
      };
    }
    next();
  };
}

function requireAuth(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ error: "Требуется вход" });
  }
  next();
}

function requireRoles(...roles) {
  return function (req, res, next) {
    if (!req.user) {
      return res.status(401).json({ error: "Требуется вход" });
    }
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: "Недостаточно прав" });
    }
    next();
  };
}

module.exports = {
  COOKIE_NAME,
  signToken,
  verifyToken,
  authCookieOptions,
  attachUser,
  requireAuth,
  requireRoles,
};
