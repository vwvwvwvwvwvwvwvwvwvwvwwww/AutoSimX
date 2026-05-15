"use strict";

const fs = require("fs");
const path = require("path");
const Database = require("better-sqlite3");
const bcrypt = require("bcryptjs");

const dataDir = path.join(__dirname, "..", "data");
const dbPath = path.join(dataDir, "autosim.db");

function ensureDataDir() {
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
}

function openDb() {
  ensureDataDir();
  const db = new Database(dbPath);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  return db;
}

function migrate(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT NOT NULL UNIQUE COLLATE NOCASE,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL CHECK (role IN ('admin', 'employee', 'customer')),
      display_name TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
    CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
  `);

  try {
    db.exec(
      "ALTER TABLE users ADD COLUMN bonus_points INTEGER NOT NULL DEFAULT 0"
    );
  } catch (_) {
    /* колонка уже есть */
  }

  db.exec(`
    CREATE TABLE IF NOT EXISTS simulators (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      type TEXT NOT NULL CHECK (type IN ('standart', 'pro', 'vr', 'motion', 'kids')),
      hourly_rate_rub INTEGER NOT NULL DEFAULT 300,
      status TEXT NOT NULL DEFAULT 'ready' CHECK (status IN ('ready', 'maintenance')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS bookings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      customer_id INTEGER NOT NULL REFERENCES users(id),
      simulator_id INTEGER NOT NULL REFERENCES simulators(id),
      slot_start TEXT NOT NULL,
      duration_minutes INTEGER NOT NULL DEFAULT 60 CHECK (duration_minutes >= 30 AND duration_minutes <= 240),
      status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'cancelled', 'completed')),
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_bookings_customer ON bookings(customer_id);
    CREATE INDEX IF NOT EXISTS idx_bookings_sim ON bookings(simulator_id);
    CREATE INDEX IF NOT EXISTS idx_bookings_status ON bookings(status);

    CREATE TABLE IF NOT EXISTS sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      booking_id INTEGER NOT NULL UNIQUE REFERENCES bookings(id),
      simulator_id INTEGER NOT NULL REFERENCES simulators(id),
      started_by_user_id INTEGER NOT NULL REFERENCES users(id),
      started_at TEXT NOT NULL,
      planned_end_at TEXT NOT NULL,
      ended_at TEXT,
      actual_minutes INTEGER,
      bonus_points INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL CHECK (status IN ('active', 'finished'))
    );

    CREATE INDEX IF NOT EXISTS idx_sessions_sim ON sessions(simulator_id);

    CREATE TABLE IF NOT EXISTS notifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id),
      kind TEXT NOT NULL,
      message TEXT NOT NULL,
      read_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id);

    CREATE TABLE IF NOT EXISTS maintenance_orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      simulator_id INTEGER NOT NULL REFERENCES simulators(id),
      part_name TEXT NOT NULL,
      qty_notes TEXT,
      status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'ordered', 'done', 'cancelled')),
      created_by_user_id INTEGER NOT NULL REFERENCES users(id),
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS app_meta (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);

  seedSimulators(db);
}

function seedSimulators(db) {
  const c = db.prepare("SELECT COUNT(*) AS n FROM simulators").get().n;
  if (c > 0) return;
  const ins = db.prepare(
    `INSERT INTO simulators (code, name, type, hourly_rate_rub, status) VALUES (?, ?, ?, ?, 'ready')`
  );
  const rows = [
    ["STD-1", "Стенд Standart 1", "standart", 350],
    ["STD-2", "Стенд Standart 2", "standart", 350],
    ["PRO-1", "Стенд Pro", "pro", 550],
    ["VR-1", "VR-кокпит", "vr", 650],
    ["MOT-1", "Подвижная платформа", "motion", 900],
  ];
  for (const r of rows) ins.run(r[0], r[1], r[2], r[3]);
}

function normalizeAdminEmailFromEnv() {
  return String(process.env.INITIAL_ADMIN_EMAIL || "admin@autosim.local")
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .trim()
    .toLowerCase();
}

/** Пароль первого админа при пустой БД и при синхронизации (если не отключено). */
function resolveAdminPasswordForSync() {
  if (process.env.AUTOSIM_SYNC_DEFAULT_ADMIN === "0") {
    return null;
  }
  const raw = process.env.INITIAL_ADMIN_PASSWORD;
  if (raw !== undefined && raw !== null) {
    const t = String(raw).trim();
    if (t.length >= 1) return t;
  }
  return "admin-change-me";
}

function seedInitialAdmin(db) {
  const count = db.prepare("SELECT COUNT(*) AS c FROM users").get().c;
  if (count > 0) return;

  const email = normalizeAdminEmailFromEnv();
  const fromSync = resolveAdminPasswordForSync();
  const password =
    fromSync !== null
      ? fromSync
      : String(process.env.INITIAL_ADMIN_PASSWORD || "admin-change-me").trim() ||
        "admin-change-me";
  const hash = bcrypt.hashSync(password, 10);

  db.prepare(
    `INSERT INTO users (email, password_hash, role, display_name)
     VALUES (?, ?, 'admin', ?)`
  ).run(email, hash, "Администратор");

  console.warn(
    "[autosim] Создан первый администратор:",
    email,
    "(смените пароль через INITIAL_ADMIN_* в .env или в админке)"
  );
}

/**
 * Если в таблице users нет ни одной роли admin (например, странная БД),
 * создаём администратора с email/паролем из окружения или демо-значениями.
 */
function ensureAdminUserExists(db) {
  const n = Number(db.prepare(`SELECT COUNT(*) AS c FROM users WHERE role = 'admin'`).get().c);
  if (n > 0) return;

  const email = normalizeAdminEmailFromEnv();
  const fromSync = resolveAdminPasswordForSync();
  const password =
    fromSync !== null
      ? fromSync
      : String(process.env.INITIAL_ADMIN_PASSWORD || "admin-change-me").trim() ||
        "admin-change-me";
  const hash = bcrypt.hashSync(password, 10);
  db.prepare(
    `INSERT INTO users (email, password_hash, role, display_name)
     VALUES (?, ?, 'admin', ?)`
  ).run(email, hash, "Администратор");
  console.warn("[autosim] В БД не было администратора — создан:", email);
}

/**
 * При каждом запуске (если не AUTOSIM_SYNC_DEFAULT_ADMIN=0) выставляет пароль
 * администратора: из INITIAL_ADMIN_PASSWORD или демо «admin-change-me».
 * Так вход с кнопки «Админ» совпадает с сервером без ручной правки SQLite.
 */
function syncAdminPasswordFromEnv(db) {
  const password = resolveAdminPasswordForSync();
  if (password === null) return;

  const email = normalizeAdminEmailFromEnv();

  const row = db
    .prepare(`SELECT id FROM users WHERE lower(email) = lower(?) AND role = 'admin'`)
    .get(email);
  if (!row) {
    console.warn(
      "[autosim] Не найден admin с email",
      JSON.stringify(email),
      "— синхронизация пароля пропущена (проверьте INITIAL_ADMIN_EMAIL)."
    );
    return;
  }

  const hash = bcrypt.hashSync(password, 10);
  db.prepare(
    `UPDATE users SET password_hash = ?, updated_at = datetime('now') WHERE id = ?`
  ).run(hash, row.id);
  console.warn("[autosim] Пароль администратора синхронизирован для", email);
}

/** Демо-сотрудник и демо-клиент (один раз, если таких email ещё нет). */
function seedDemoUsers(db) {
  if (process.env.AUTOSIM_SKIP_DEMO_USERS === "1") return;

  const demo = [
    {
      email: "employee@autosim.local",
      password: "EmployeeDemo1",
      role: "employee",
      displayName: "Демо сотрудник",
    },
    {
      email: "customer@autosim.local",
      password: "CustomerDemo1",
      role: "customer",
      displayName: "Демо клиент",
    },
  ];

  for (const u of demo) {
    const row = db.prepare("SELECT id FROM users WHERE email = ?").get(u.email);
    if (row) continue;
    const hash = bcrypt.hashSync(u.password, 10);
    db.prepare(
      `INSERT INTO users (email, password_hash, role, display_name)
       VALUES (?, ?, ?, ?)`
    ).run(u.email, hash, u.role, u.displayName);
    console.warn("[autosim] Создан демо-пользователь:", u.email, "(" + u.role + ")");
  }
}

/**
 * Однократное заполнение админ-панели: заявки, сессии, отчёты, уведомления.
 * Отключить: AUTOSIM_SKIP_ADMIN_DEMO=1
 */
function seedAdminPanelDemo(db) {
  if (process.env.AUTOSIM_SKIP_ADMIN_DEMO === "1") return;
  if (db.prepare("SELECT 1 FROM app_meta WHERE key = ?").get("admin_panel_demo_v1")) {
    return;
  }

  const cust = db
    .prepare("SELECT id FROM users WHERE email = ?")
    .get("customer@autosim.local");
  const emp = db
    .prepare("SELECT id FROM users WHERE email = ?")
    .get("employee@autosim.local");
  if (!cust || !emp) {
    return;
  }

  function isoOffsetMs(ms) {
    return new Date(Date.now() + ms).toISOString();
  }

  const insUser = db.prepare(
    `INSERT INTO users (email, password_hash, role, display_name, bonus_points)
     VALUES (?, ?, 'customer', ?, ?)`
  );

  function ensureGuest(email, displayName, password, bonus) {
    const row = db.prepare("SELECT id FROM users WHERE email = ?").get(email);
    if (row) return row.id;
    const h = bcrypt.hashSync(password, 10);
    const info = insUser.run(email, h, displayName, bonus);
    return Number(info.lastInsertRowid);
  }

  const g1 = ensureGuest(
    "guest1@autosim.local",
    "Алексей (гость)",
    "GuestDemo11",
    40
  );
  const g2 = ensureGuest(
    "guest2@autosim.local",
    "Мария (гость)",
    "GuestDemo22",
    0
  );

  const sim = {};
  for (const code of ["STD-1", "STD-2", "PRO-1", "VR-1", "MOT-1"]) {
    const r = db.prepare("SELECT id FROM simulators WHERE code = ?").get(code);
    if (r) sim[code] = r.id;
  }
  if (!sim["STD-1"]) return;

  const insBk = db.prepare(
    `INSERT INTO bookings (customer_id, simulator_id, slot_start, duration_minutes, status, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  );
  const insSess = db.prepare(
    `INSERT INTO sessions (booking_id, simulator_id, started_by_user_id, started_at, planned_end_at, ended_at, actual_minutes, bonus_points, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'finished')`
  );
  const insNotif = db.prepare(
    `INSERT INTO notifications (user_id, kind, message, created_at) VALUES (?, ?, ?, ?)`
  );
  const insMaint = db.prepare(
    `INSERT INTO maintenance_orders (simulator_id, part_name, qty_notes, status, created_by_user_id, created_at)
     VALUES (?, ?, ?, 'ordered', ?, datetime('now', '-4 days'))`
  );

  const tx = db.transaction(() => {
    /* Активные заявки */
    const t1h = isoOffsetMs(-3600000);
    const t2h = isoOffsetMs(-2 * 3600000);
    const t3h = isoOffsetMs(-3 * 3600000);
    const t5h = isoOffsetMs(-5 * 3600000);
    const t6d = isoOffsetMs(-6 * 86400000);

    insBk.run(
      cust.id,
      sim["STD-1"],
      new Date(Date.now() + 86400000 * 2).toISOString(),
      60,
      "pending",
      t1h,
      t1h
    );
    insBk.run(
      g1,
      sim["STD-2"] || sim["STD-1"],
      new Date(Date.now() + 86400000 * 3).toISOString(),
      90,
      "pending",
      t2h,
      t2h
    );

    insBk.run(
      cust.id,
      sim["PRO-1"] || sim["STD-1"],
      new Date(Date.now() + 86400000 * 5).toISOString(),
      60,
      "confirmed",
      t3h,
      t3h
    );

    insBk.run(
      g2,
      sim["VR-1"] || sim["STD-1"],
      new Date(Date.now() + 86400000 * 7).toISOString(),
      120,
      "confirmed",
      t5h,
      t5h
    );

    /* Отменённая */
    insBk.run(
      g1,
      sim["STD-1"],
      new Date(Date.now() + 86400000 * 10).toISOString(),
      60,
      "cancelled",
      t6d,
      t6d
    );

    /* Завершённые брони + сессии (попадают в отчёты за последние 30 дней) */
    const finished = [
      {
        customer: cust.id,
        simCode: "STD-1",
        slotDays: -18,
        dur: 60,
        actual: 58,
        createdDaysAgo: 20,
      },
      {
        customer: g1,
        simCode: "PRO-1",
        slotDays: -14,
        dur: 90,
        actual: 95,
        createdDaysAgo: 15,
      },
      {
        customer: g2,
        simCode: "VR-1",
        slotDays: -8,
        dur: 60,
        actual: 120,
        createdDaysAgo: 9,
      },
      {
        customer: cust.id,
        simCode: "STD-2",
        slotDays: -3,
        dur: 30,
        actual: 35,
        createdDaysAgo: 4,
      },
    ];

    for (const f of finished) {
      const sid = sim[f.simCode] || sim["STD-1"];
      const slot = new Date();
      slot.setDate(slot.getDate() + f.slotDays);
      slot.setHours(18, 0, 0, 0);
      const createdAt = isoOffsetMs(-f.createdDaysAgo * 86400000);
      const info = insBk.run(
        f.customer,
        sid,
        slot.toISOString(),
        f.dur,
        "completed",
        createdAt,
        createdAt
      );
      const bid = Number(info.lastInsertRowid);
      const start = new Date(slot.getTime());
      const planned = new Date(start.getTime() + f.dur * 60000);
      const end = new Date(start.getTime() + f.actual * 60000);
      const bonus = Math.floor(f.actual / 60) * 10;
      insSess.run(
        bid,
        sid,
        emp.id,
        start.toISOString(),
        planned.toISOString(),
        end.toISOString(),
        f.actual,
        bonus
      );
    }

    db.prepare(
      `UPDATE users SET bonus_points = bonus_points + 80, updated_at = datetime('now') WHERE id = ?`
    ).run(cust.id);

    insNotif.run(
      cust.id,
      "booking",
      "Демо: бронь #1 подтверждена (пример уведомления).",
      isoOffsetMs(-2 * 86400000)
    );
    insNotif.run(
      cust.id,
      "session",
      "Демо: сессия завершена, начислено бонусов.",
      isoOffsetMs(-3 * 86400000)
    );

    if (sim["MOT-1"]) {
      insMaint.run(
        sim["MOT-1"],
        "Вентилятор 120 мм",
        "2 шт., для стойки MOT-1",
        emp.id
      );
    }

    db.prepare("INSERT INTO app_meta (key, value) VALUES (?, ?)").run(
      "admin_panel_demo_v1",
      new Date().toISOString()
    );
  });

  try {
    tx();
    console.warn("[autosim] Заполнена демо-данными админ-панель (брони, сессии, уведомления).");
  } catch (e) {
    console.error("[autosim] seedAdminPanelDemo:", e.message);
  }
}

let _db;

function getDb() {
  if (!_db) {
    _db = openDb();
    migrate(_db);
    seedInitialAdmin(_db);
    ensureAdminUserExists(_db);
    syncAdminPasswordFromEnv(_db);
    seedDemoUsers(_db);
    seedAdminPanelDemo(_db);
  }
  return _db;
}

module.exports = { getDb, dbPath };
