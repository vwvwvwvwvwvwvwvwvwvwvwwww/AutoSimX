"use strict";

const express = require("express");
const { requireAuth, requireRoles } = require("../middleware/auth");
const {
  readOverrides,
  writeOverrides,
  deleteOverrides,
  effectiveContent,
  minimalOverrides,
  sanitizeIncoming,
  defaultPublicSite,
} = require("../lib/site-content-store");

function createSiteContentPublicRouter(db) {
  const router = express.Router();

  router.get("/site-content", (_req, res) => {
    res.json(effectiveContent(db));
  });

  return router;
}

function createSiteContentAdminRouter(db) {
  const router = express.Router();
  router.use(requireAuth);
  router.use(requireRoles("admin"));

  router.get("/site-content", (_req, res) => {
    res.json({
      merged: effectiveContent(db),
      overrides: readOverrides(db),
    });
  });

  router.patch("/site-content", (req, res) => {
    try {
      const cleaned = sanitizeIncoming(req.body || {});
      const defs = defaultPublicSite();
      const nextOverrides = minimalOverrides(defs, cleaned);
      if (!nextOverrides || Object.keys(nextOverrides).length === 0) {
        deleteOverrides(db);
      } else {
        writeOverrides(db, nextOverrides);
      }
      res.json({ ok: true, merged: effectiveContent(db) });
    } catch (e) {
      console.error(e);
      res.status(400).json({ error: "Не удалось сохранить контент" });
    }
  });

  router.post("/site-content/reset", (_req, res) => {
    deleteOverrides(db);
    res.json({ ok: true, merged: effectiveContent(db) });
  });

  return router;
}

module.exports = { createSiteContentPublicRouter, createSiteContentAdminRouter };
