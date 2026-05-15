"use strict";

/**
 * Дополнительный администратор: node server/scripts/create-admin.js
 * Переменные окружения: NEW_ADMIN_EMAIL, NEW_ADMIN_PASSWORD
 */
require("dotenv").config({ path: require("path").join(__dirname, "..", "..", ".env") });

const bcrypt = require("bcryptjs");
const { getDb } = require("../db");

const email = (process.env.NEW_ADMIN_EMAIL || "").trim().toLowerCase();
const password = process.env.NEW_ADMIN_PASSWORD || "";

if (!email || password.length < 8) {
  console.error("Задайте NEW_ADMIN_EMAIL и NEW_ADMIN_PASSWORD (≥8 символов) в .env");
  process.exit(1);
}

const db = getDb();
const hash = bcrypt.hashSync(password, 10);
try {
  db.prepare(
    `INSERT INTO users (email, password_hash, role, display_name)
     VALUES (?, ?, 'admin', ?)`
  ).run(email, hash, "Администратор");
  console.log("Создан администратор:", email);
} catch (e) {
  if (String(e.message).includes("UNIQUE")) {
    console.error("Такой email уже есть в базе");
  } else {
    console.error(e);
  }
  process.exit(1);
}
