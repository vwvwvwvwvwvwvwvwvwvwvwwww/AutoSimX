"use strict";

const express = require("express");
const { requireAuth, requireRoles } = require("../middleware/auth");

function createEmployeeRouter(db) {
  const router = express.Router();

  router.get("/summary", requireAuth, requireRoles("employee", "admin"), (_req, res) => {
    const totalUsers = db.prepare("SELECT COUNT(*) AS c FROM users").get().c;
    const byRole = db
      .prepare(
        `SELECT role, COUNT(*) AS c FROM users GROUP BY role`
      )
      .all();
    res.json({
      message: "Краткая сводка для персонала",
      totalUsers,
      byRole,
    });
  });

  return router;
}

module.exports = { createEmployeeRouter };
