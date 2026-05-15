"use strict";

const { defaultPublicSite } = require("./site-public-defaults");

const META_KEY = "site_public_overrides_v1";

function deepMerge(base, patch) {
  if (!patch || typeof patch !== "object") return base;
  const out =
    base && typeof base === "object" && !Array.isArray(base)
      ? base
      : {};
  Object.keys(patch).forEach(function (k) {
    const pv = patch[k];
    if (pv && typeof pv === "object" && !Array.isArray(pv)) {
      out[k] = deepMerge(
        out[k] && typeof out[k] === "object" && !Array.isArray(out[k]) ? out[k] : {},
        pv
      );
    } else if (pv !== undefined) {
      out[k] = pv;
    }
  });
  return out;
}

function readOverrides(db) {
  const row = db.prepare("SELECT value FROM app_meta WHERE key = ?").get(META_KEY);
  if (!row || !row.value) return {};
  try {
    const j = JSON.parse(row.value);
    return j && typeof j === "object" ? j : {};
  } catch {
    return {};
  }
}

function writeOverrides(db, obj) {
  const json = JSON.stringify(obj);
  db.prepare(
    `INSERT INTO app_meta (key, value) VALUES (?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`
  ).run(META_KEY, json);
}

function deleteOverrides(db) {
  db.prepare("DELETE FROM app_meta WHERE key = ?").run(META_KEY);
}

function effectiveContent(db) {
  return deepMerge(JSON.parse(JSON.stringify(defaultPublicSite())), readOverrides(db));
}

/**
 * Оставляет в объекте только отличия от defaults (для хранения в БД).
 */
function minimalOverrides(defaults, merged) {
  const out = {};
  function walk(d, m, acc) {
    if (m === undefined) return;
    if (
      d &&
      typeof d === "object" &&
      !Array.isArray(d) &&
      m &&
      typeof m === "object" &&
      !Array.isArray(m)
    ) {
      Object.keys(d).forEach(function (k) {
        if (!(k in m)) return;
        const subD = d[k];
        const subM = m[k];
        if (
          subD &&
          typeof subD === "object" &&
          !Array.isArray(subD) &&
          subM &&
          typeof subM === "object" &&
          !Array.isArray(subM)
        ) {
          const inner = {};
          walk(subD, subM, inner);
          if (Object.keys(inner).length) acc[k] = inner;
        } else if (String(subM) !== String(subD)) {
          acc[k] = subM;
        }
      });
    }
  }
  walk(defaults.site || {}, merged.site || {}, out);
  const sitePart = Object.keys(out).length ? { site: out } : {};
  const homeOut = {};
  walk(defaults.homeHero || {}, merged.homeHero || {}, homeOut);
  const homePart = Object.keys(homeOut).length ? { homeHero: homeOut } : {};
  return Object.assign(sitePart, homePart);
}

const MAX_LEN = {
  short: 500,
  long: 4000,
};

function isAllowedUrl(s) {
  const t = String(s || "").trim();
  if (!t) return false;
  try {
    const u = new URL(t);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

function isAllowedPhoneHref(s) {
  const t = String(s || "").trim();
  if (!/^tel:/i.test(t)) return false;
  if (t.length > 80) return false;
  const digits = t.replace(/^tel:/i, "").replace(/\D/g, "");
  return digits.length >= 10 && digits.length <= 15;
}

/**
 * Санитизация входа админа: только известные поля, длины, URL.
 */
function sanitizeIncoming(body) {
  const d = defaultPublicSite();
  const raw = body && typeof body === "object" ? body : {};
  const siteIn = raw.site && typeof raw.site === "object" ? raw.site : {};
  const homeIn = raw.homeHero && typeof raw.homeHero === "object" ? raw.homeHero : {};

  function clip(s, max) {
    const t = String(s == null ? "" : s);
    return t.length > max ? t.slice(0, max) : t;
  }

  const site = JSON.parse(JSON.stringify(d.site));
  if (siteIn.brand && typeof siteIn.brand === "object") {
    if (siteIn.brand.shortMark != null) {
      site.brand.shortMark = clip(siteIn.brand.shortMark, 12);
    }
    if (siteIn.brand.name != null) {
      site.brand.name = clip(siteIn.brand.name, 80);
    }
  }
  if (siteIn.phone && typeof siteIn.phone === "object") {
    if (siteIn.phone.display != null) {
      site.phone.display = clip(siteIn.phone.display, MAX_LEN.short);
    }
    if (siteIn.phone.href != null) {
      const h = String(siteIn.phone.href || "").trim();
      if (isAllowedPhoneHref(h)) site.phone.href = h;
    }
  }
  if (siteIn.links && typeof siteIn.links === "object") {
    const keys = Object.keys(d.site.links);
    keys.forEach(function (k) {
      if (siteIn.links[k] == null) return;
      const u = String(siteIn.links[k] || "").trim();
      if (isAllowedUrl(u)) site.links[k] = u;
    });
  }
  if (siteIn.footerNote != null) {
    site.footerNote = clip(siteIn.footerNote, MAX_LEN.long);
  }

  const homeHero = JSON.parse(JSON.stringify(d.homeHero));
  Object.keys(d.homeHero).forEach(function (k) {
    if (homeIn[k] == null) return;
    homeHero[k] = clip(homeIn[k], k === "tagline" || k === "lead" ? MAX_LEN.long : MAX_LEN.short);
  });

  return { site, homeHero };
}

module.exports = {
  META_KEY,
  deepMerge,
  readOverrides,
  writeOverrides,
  deleteOverrides,
  effectiveContent,
  minimalOverrides,
  sanitizeIncoming,
  defaultPublicSite,
};
