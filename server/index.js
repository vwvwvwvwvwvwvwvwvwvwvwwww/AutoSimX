"use strict";

require("dotenv").config();

const path = require("path");
const express = require("express");
const cookieParser = require("cookie-parser");
const { getDb } = require("./db");
const { attachUser, COOKIE_NAME } = require("./middleware/auth");
const { createAuthRouter } = require("./routes/auth");
const { createUsersRouter } = require("./routes/users");
const { createEmployeeRouter } = require("./routes/employee");
const { createSimulatorsRouter } = require("./routes/simulators");
const { createBookingsRouter } = require("./routes/bookings");
const { createSessionsRouter } = require("./routes/sessions");
const { createNotificationsRouter } = require("./routes/notifications");
const { createReportsRouter } = require("./routes/reports");
const {
  createSiteContentPublicRouter,
  createSiteContentAdminRouter,
} = require("./routes/site-content");

/** Порт по умолчанию — не 3000, чтобы не пересекаться с другими проектами. */
const PORT = Number(process.env.PORT) || 3888;
const root = path.join(__dirname, "..");

const app = express();
const db = getDb();

app.disable("x-powered-by");
app.use(cookieParser());
app.use(express.json({ limit: "64kb" }));
app.use(attachUser(db));

app.use("/api/auth", createAuthRouter(db));
app.use("/api/users", createUsersRouter(db));
app.use("/api/employee", createEmployeeRouter(db));
app.use("/api/simulators", createSimulatorsRouter(db));
app.use("/api/bookings", createBookingsRouter(db));
app.use("/api/sessions", createSessionsRouter(db));
app.use("/api/notifications", createNotificationsRouter(db));
app.use("/api/admin/reports", createReportsRouter(db));
app.use("/api", createSiteContentPublicRouter(db));
app.use("/api/admin", createSiteContentAdminRouter(db));

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, cookie: COOKIE_NAME });
});

app.use((req, res, next) => {
  const p = req.path.split("?")[0];
  if (
    p.startsWith("/server") ||
    p.startsWith("/node_modules") ||
    p.startsWith("/data") ||
    p === "/package.json" ||
    p === "/package-lock.json" ||
    p === "/.env"
  ) {
    return res.status(403).end();
  }
  next();
});

app.use(
  express.static(root, {
    index: ["index.html"],
    extensions: ["html"],
    dotfiles: "deny",
    setHeaders(res, filePath) {
      if (String(filePath).toLowerCase().endsWith(".html")) {
        res.setHeader("Cache-Control", "no-cache, must-revalidate");
      }
    },
  })
);

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: "Внутренняя ошибка сервера" });
});

app.listen(PORT, () => {
  console.log(`[autosim] http://localhost:${PORT}`);
  if (!process.env.JWT_SECRET && process.env.NODE_ENV !== "production") {
    console.warn("[autosim] JWT_SECRET не задан — для разработки используется временный секрет");
  }
});
