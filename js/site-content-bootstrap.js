/** Подгрузка контента с API в AUTOSIM_SITE до shell.js. */
(function () {
  "use strict";

  window.__AUTOSIM_MERGED_HOME_HERO = null;
  var site = window.AUTOSIM_SITE;
  if (!site) {
    window.__AUTOSIM_SITE_CONTENT_PROMISE = Promise.resolve();
    return;
  }

  window.__AUTOSIM_SITE_CONTENT_PROMISE = fetch("/api/site-content")
    .then(function (r) {
      if (!r.ok) throw new Error("site-content");
      return r.json();
    })
    .then(function (data) {
      if (!data || !data.site) return;
      var s = data.site;
      if (s.brand) {
        if (s.brand.shortMark != null) site.brand.shortMark = s.brand.shortMark;
        if (s.brand.name != null) site.brand.name = s.brand.name;
      }
      if (s.phone) {
        if (s.phone.href != null) site.phone.href = s.phone.href;
        if (s.phone.display != null) site.phone.display = s.phone.display;
      }
      if (s.links) {
        Object.keys(s.links).forEach(function (k) {
          if (s.links[k] != null) site.links[k] = s.links[k];
        });
      }
      if (s.footerNote != null) site.footerNote = s.footerNote;
      window.__AUTOSIM_MERGED_HOME_HERO = data.homeHero || null;
    })
    .catch(function () {
      window.__AUTOSIM_MERGED_HOME_HERO = null;
    });
})();
