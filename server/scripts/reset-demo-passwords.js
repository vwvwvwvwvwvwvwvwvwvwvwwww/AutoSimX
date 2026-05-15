"use strict";

/**
 * Сбрасывает пароли демо-пользователей к значениям из readme.md.
 * Запуск из корня проекта: node server/scripts/reset-demo-passwords.js
 */

const path = require("path");
const bcrypt = require("bcryptjs");
const Database = require("better-sqlite3");

const dbPath = path.join(__dirname, "..", "..", "data", "autosim.db");
const db = new Database(dbPath);

const rows = [
  { email: "admin@autosim.local", password: "admin-change-me" },
  { email: "employee@autosim.local", password: "EmployeeDemo1" },
  { email: "customer@autosim.local", password: "CustomerDemo1" },
];

const upd = db.prepare(
  "UPDATE users SET password_hash = ?, updated_at = datetime('now') WHERE lower(email) = lower(?)"
);

for (const r of rows) {
  const hash = bcrypt.hashSync(r.password, 10);
  const info = upd.run(hash, r.email);
  if (info.changes === 0) {
    console.warn("[reset-demo] Нет пользователя:", r.email);
  } else {
    console.warn("[reset-demo] Обновлён пароль:", r.email);
  }
}

db.close();
console.warn("[reset-demo] Готово. Пароли как в readme.md.");
