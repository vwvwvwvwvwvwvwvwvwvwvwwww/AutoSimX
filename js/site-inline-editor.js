/**
 * Редактирование публичного контента на самих страницах (только роль admin).
 * Панель внизу: подсветка зон, клик → всплывающее окно; шапка/подвал/бренд — выезжающая панель.
 */
(function () {
  "use strict";

  if (!window.autosimApi) return;

  var draft = null;
  var editMode = false;
  var drawerOpen = false;
  var popEl = null;
  var backdropEl = null;
  var drawerEl = null;
  var barEl = null;
  var statusEl = null;

  function deepClone(o) {
    return JSON.parse(JSON.stringify(o));
  }

  function getPath(root, path) {
    var parts = path.split(".");
    var cur = root;
    for (var i = 0; i < parts.length; i++) {
      if (cur == null) return undefined;
      cur = cur[parts[i]];
    }
    return cur;
  }

  function setPath(root, path, value) {
    var parts = path.split(".");
    var cur = root;
    for (var i = 0; i < parts.length - 1; i++) {
      var k = parts[i];
      if (!cur[k] || typeof cur[k] !== "object") cur[k] = {};
      cur = cur[k];
    }
    cur[parts[parts.length - 1]] = value;
  }

  var PATH_TITLES = {
    "homeHero.eyebrow": "Строка над заголовком",
    "homeHero.titleLine1": "Заголовок, первая строка",
    "homeHero.titleBefore": "Заголовок: перед акцентом",
    "homeHero.titleHighlight": "Акцент в заголовке",
    "homeHero.tagline": "Подзаголовок",
    "homeHero.lead": "Текст под заголовком",
    "homeHero.statModeLabel": "Подпись «режим»",
    "homeHero.statModeValue": "Значение «режим»",
    "homeHero.statAddrLabel": "Подпись «адрес»",
    "homeHero.statAddrValue": "Значение «адрес»",
    "homeHero.statGuestsLabel": "Подпись «гости»",
    "homeHero.statGuestsValue": "Значение «гости»",
    "site.footerNote": "Текст в подвале",
    "site.links.telegram": "Ссылка Telegram в шапке",
  };

  function titleForSitePath(path) {
    return PATH_TITLES[path] || "Правка текста";
  }

  function whenContentReady(cb) {
    var p = window.__AUTOSIM_SITE_CONTENT_PROMISE;
    if (p && typeof p.then === "function") {
      p.then(function () {
        setTimeout(cb, 80);
      });
    } else {
      setTimeout(cb, 80);
    }
  }

  function rebuildPromoFromDraft(D) {
    var h = draft.homeHero || {};
    var promoRoot = document.getElementById("hero-promo-root");
    if (!promoRoot || !D) return;
    D.setContent(promoRoot, [
      document.createTextNode(h.promoLead != null ? h.promoLead : ""),
      D.el("strong", { textContent: h.promoBold != null ? h.promoBold : "" }),
      document.createTextNode(h.promoNote != null ? h.promoNote : ""),
      D.el("span", {
        className: "hero__promo-note",
        textContent: h.promoSuffix != null ? h.promoSuffix : "",
      }),
    ]);
    promoRoot.classList.add("site-editable-target");
    promoRoot.setAttribute("data-site-kind", "promo");
  }

  function applyDraftToDom() {
    var h = draft.homeHero || {};
    var s = draft.site || {};
    var D = window.autosimDom;
    function setText(id, val) {
      var el = document.getElementById(id);
      if (el && val != null) el.textContent = val;
    }
    setText("hero-eyebrow", h.eyebrow);
    rebuildPromoFromDraft(D);
    setText("hero-title-line1", h.titleLine1);
    setText("hero-title-before", h.titleBefore);
    setText("hero-title-highlight", h.titleHighlight);
    setText("hero-tagline", h.tagline);
    setText("hero-lead", h.lead);
    var book = document.getElementById("hero-cta-book");
    if (book) {
      if (h.ctaBook != null) book.textContent = h.ctaBook;
      if (s.links && s.links.telegram) book.href = s.links.telegram;
    }
    var vk = document.getElementById("hero-cta-vk");
    if (vk) {
      if (h.ctaVk != null) vk.textContent = h.ctaVk;
      if (s.links && s.links.vk) vk.href = s.links.vk;
    }
    setText("hero-stat-mode-label", h.statModeLabel);
    setText("hero-stat-mode-value", h.statModeValue);
    setText("hero-stat-addr-label", h.statAddrLabel);
    setText("hero-stat-addr-value", h.statAddrValue);
    setText("hero-stat-guests-label", h.statGuestsLabel);
    setText("hero-stat-guests-value", h.statGuestsValue);

    var foot = document.getElementById("site-edit-footer-note");
    if (foot && s.footerNote != null) foot.textContent = s.footerNote;
    var ph = document.getElementById("site-edit-phone-btn");
    if (ph && s.phone && s.phone.href) ph.href = s.phone.href;
    var tg = document.getElementById("site-edit-tg-btn");
    if (tg && s.links && s.links.telegram) tg.href = s.links.telegram;

    var logo = document.getElementById("site-edit-logo");
    if (logo && s.brand && D) {
      logo.classList.add("site-editable-target");
      logo.id = "site-edit-logo";
      logo.setAttribute("data-site-kind", "brand");
      D.clear(logo);
      logo.appendChild(
        D.el("span", { className: "logo__mark", textContent: s.brand.shortMark || "" })
      );
      var span = D.el("span", { className: "logo__text" });
      var nm = String(s.brand.name || "AutoSimX");
      if (nm.length >= 1 && nm.charAt(nm.length - 1) === "X") {
        span.appendChild(document.createTextNode(nm.slice(0, -1)));
        span.appendChild(D.el("span", { className: "logo__x", textContent: "X" }));
      } else {
        span.appendChild(document.createTextNode(nm));
      }
      logo.appendChild(span);
    }

    var site = window.AUTOSIM_SITE;
    if (site && s.brand) {
      if (s.brand.shortMark != null) site.brand.shortMark = s.brand.shortMark;
      if (s.brand.name != null) site.brand.name = s.brand.name;
      var fb = document.getElementById("site-edit-footer-brand");
      if (fb && s.brand.name != null) {
        fb.textContent = "© " + s.brand.name + ", Оренбург";
      }
      var fm = document.getElementById("site-edit-footer-mark");
      if (fm && s.brand.shortMark != null) {
        fm.textContent = s.brand.shortMark;
      }
    }
    if (site && s.phone) {
      if (s.phone.href != null) site.phone.href = s.phone.href;
      if (s.phone.display != null) site.phone.display = s.phone.display;
    }
    if (site && s.links) {
      Object.keys(s.links).forEach(function (k) {
        if (s.links[k] != null) site.links[k] = s.links[k];
      });
    }
    if (site && s.footerNote != null) site.footerNote = s.footerNote;
  }

  function closePopover() {
    if (backdropEl) {
      backdropEl.remove();
      backdropEl = null;
    }
    if (popEl) {
      popEl.remove();
      popEl = null;
    }
  }

  function openPopover(title, fields, onSave) {
    closePopover();
    backdropEl = document.createElement("div");
    backdropEl.className = "site-edit-backdrop";
    backdropEl.addEventListener("click", closePopover);

    popEl = document.createElement("div");
    popEl.className = "site-edit-pop";
    popEl.setAttribute("role", "dialog");
    popEl.setAttribute("aria-modal", "true");
    popEl.setAttribute("aria-label", title);

    var h2 = document.createElement("h2");
    h2.className = "site-edit-pop__title";
    h2.textContent = title;
    popEl.appendChild(h2);

    var inputs = [];
    fields.forEach(function (f) {
      var lab = document.createElement("label");
      lab.className = "site-edit-pop__label";
      lab.textContent = f.label;
      popEl.appendChild(lab);
      var inp;
      if (f.type === "textarea") {
        inp = document.createElement("textarea");
      } else {
        inp = document.createElement("input");
        inp.type = f.type === "url" ? "url" : "text";
      }
      inp.className = "site-edit-pop__input";
      inp.value = f.value != null ? String(f.value) : "";
      if (f.maxLength) inp.maxLength = f.maxLength;
      if (f.rows) inp.rows = f.rows;
      popEl.appendChild(inp);
      inputs.push({ path: f.path, el: inp, type: f.type });
    });

    var row = document.createElement("div");
    row.className = "site-edit-pop__actions";

    var btnCancel = document.createElement("button");
    btnCancel.type = "button";
    btnCancel.className = "btn btn--ghost";
    btnCancel.textContent = "Отмена";
    btnCancel.addEventListener("click", closePopover);

    var btnOk = document.createElement("button");
    btnOk.type = "button";
    btnOk.className = "btn btn--primary";
    btnOk.textContent = "Применить";
    btnOk.addEventListener("click", function () {
      var vals = {};
      inputs.forEach(function (x) {
        vals[x.path] =
          x.type === "textarea"
            ? String(x.el.value || "")
            : String(x.el.value || "").trim();
      });
      onSave(vals);
      applyDraftToDom();
      closePopover();
      setStatus("Нажмите «Сохранить», чтобы записать изменения.");
    });

    row.appendChild(btnCancel);
    row.appendChild(btnOk);
    popEl.appendChild(row);

    document.body.appendChild(backdropEl);
    document.body.appendChild(popEl);
    inputs[0].el.focus();
  }

  function handleEditableClick(ev) {
    if (!editMode) return;
    if (
      ev.target.closest(".site-edit-bar") ||
      ev.target.closest(".site-edit-drawer") ||
      ev.target.closest(".site-edit-pop")
    ) {
      return;
    }
    var t = ev.target.closest(".site-editable-target");
    if (!t || !document.body.contains(t)) return;
    ev.preventDefault();

    var kind = t.getAttribute("data-site-kind");
    var path = t.getAttribute("data-site-path");

    if (kind === "promo") {
      var hh = draft.homeHero || {};
      openPopover("Акция под заголовком", [
        { path: "homeHero.promoLead", label: "Текст до суммы", value: hh.promoLead, maxLength: 500 },
        { path: "homeHero.promoBold", label: "Сумма (жирным)", value: hh.promoBold, maxLength: 500 },
        { path: "homeHero.promoNote", label: "После суммы", value: hh.promoNote, maxLength: 500 },
        { path: "homeHero.promoSuffix", label: "Примечание мелким", value: hh.promoSuffix, maxLength: 500 },
      ], function (vals) {
        Object.keys(vals).forEach(function (p) {
          setPath(draft, p, vals[p]);
        });
      });
      return;
    }

    if (kind === "phone") {
      var p = draft.site.phone || {};
      openPopover("Телефон", [
        { path: "site.phone.display", label: "Подпись номера", value: p.display, maxLength: 500 },
        { path: "site.phone.href", label: "Номер для звонка (ссылка)", value: p.href, maxLength: 80 },
      ], function (vals) {
        Object.keys(vals).forEach(function (k) {
          setPath(draft, k, vals[k]);
        });
      });
      return;
    }

    if (kind === "brand") {
      var b = draft.site.brand || {};
      openPopover("Бренд в шапке", [
        { path: "site.brand.shortMark", label: "Марк (2 буквы)", value: b.shortMark, maxLength: 12 },
        { path: "site.brand.name", label: "Название", value: b.name, maxLength: 80 },
      ], function (vals) {
        Object.keys(vals).forEach(function (k) {
          setPath(draft, k, vals[k]);
        });
      });
      return;
    }

    if (kind === "hero-cta-book") {
      var hh2 = draft.homeHero || {};
      var lk = draft.site.links || {};
      openPopover("Кнопка «Забронировать»", [
        { path: "homeHero.ctaBook", label: "Текст кнопки", value: hh2.ctaBook, maxLength: 500 },
        { path: "site.links.telegram", label: "Ссылка Telegram", value: lk.telegram, type: "url", maxLength: 500 },
      ], function (vals) {
        Object.keys(vals).forEach(function (k) {
          setPath(draft, k, vals[k]);
        });
      });
      return;
    }

    if (kind === "hero-cta-vk") {
      var hh3 = draft.homeHero || {};
      var lk2 = draft.site.links || {};
      openPopover("Кнопка «ВКонтакте»", [
        { path: "homeHero.ctaVk", label: "Текст кнопки", value: hh3.ctaVk, maxLength: 500 },
        { path: "site.links.vk", label: "Ссылка ВК", value: lk2.vk, type: "url", maxLength: 500 },
      ], function (vals) {
        Object.keys(vals).forEach(function (k) {
          setPath(draft, k, vals[k]);
        });
      });
      return;
    }

    if (path) {
      var cur = getPath(draft, path);
      var isLong =
        path.indexOf("tagline") >= 0 ||
        path.indexOf("lead") >= 0 ||
        path.indexOf("footerNote") >= 0;
      openPopover(
        titleForSitePath(path),
        [
          {
            path: path,
            label: "Текст",
            value: cur,
            type: isLong ? "textarea" : "text",
            rows: isLong ? 4 : undefined,
            maxLength: isLong ? 4000 : 500,
          },
        ],
        function (vals) {
          setPath(draft, path, vals[path]);
        }
      );
    }
  }

  function fillDrawerFields() {
    if (!drawerEl) return;
    var s = draft.site || {};
    var b = s.brand || {};
    var p = s.phone || {};
    var ln = s.links || {};
    function set(id, val) {
      var el = drawerEl.querySelector("#" + id);
      if (el) el.value = val != null ? String(val) : "";
    }
    set("sed-brand-short", b.shortMark);
    set("sed-brand-name", b.name);
    set("sed-phone-display", p.display);
    set("sed-phone-href", p.href);
    set("sed-ln-tg", ln.telegram);
    set("sed-ln-vk", ln.vk);
    set("sed-ln-ig", ln.instagram);
    set("sed-ln-2gis", ln.map2gis);
    set("sed-ln-ya", ln.yandexReviews);
    set("sed-ln-off", ln.official);
    set("sed-footer", s.footerNote);
  }

  function readDrawerIntoDraft() {
    if (!drawerEl) return;
    function g(id) {
      var el = drawerEl.querySelector("#" + id);
      return el ? String(el.value || "").trim() : "";
    }
    draft.site.brand = draft.site.brand || {};
    draft.site.brand.shortMark = g("sed-brand-short");
    draft.site.brand.name = g("sed-brand-name");
    draft.site.phone = draft.site.phone || {};
    draft.site.phone.display = g("sed-phone-display");
    draft.site.phone.href = g("sed-phone-href");
    draft.site.links = draft.site.links || {};
    draft.site.links.telegram = g("sed-ln-tg");
    draft.site.links.vk = g("sed-ln-vk");
    draft.site.links.instagram = g("sed-ln-ig");
    draft.site.links.map2gis = g("sed-ln-2gis");
    draft.site.links.yandexReviews = g("sed-ln-ya");
    draft.site.links.official = g("sed-ln-off");
    draft.site.footerNote = g("sed-footer");
  }

  function buildDrawer() {
    drawerEl = document.createElement("aside");
    drawerEl.className = "site-edit-drawer";
    drawerEl.setAttribute("aria-label", "Шапка и подвал");
    drawerEl.innerHTML =
      '<div class="site-edit-drawer__head">' +
      '<h2 class="site-edit-drawer__title">Шапка, бренд, ссылки, подвал</h2>' +
      '<button type="button" class="btn btn--ghost site-edit-drawer__close" id="sed-drawer-x">Закрыть</button></div>' +
      '<div class="site-edit-drawer__body">' +
      '<p class="site-edit-drawer__hint">Бренд, телефон, ссылки и подвал. Тексты на главной — по клику при включённой подсветке.</p>' +
      '<label class="site-edit-pop__label" for="sed-brand-short">Марк логотипа</label>' +
      '<input class="site-edit-pop__input" id="sed-brand-short" maxlength="12" />' +
      '<label class="site-edit-pop__label" for="sed-brand-name">Название бренда</label>' +
      '<input class="site-edit-pop__input" id="sed-brand-name" maxlength="80" />' +
      '<label class="site-edit-pop__label" for="sed-phone-display">Телефон (отображение)</label>' +
      '<input class="site-edit-pop__input" id="sed-phone-display" maxlength="500" />' +
      '<label class="site-edit-pop__label" for="sed-phone-href">Ссылка для звонка</label>' +
      '<input class="site-edit-pop__input" id="sed-phone-href" maxlength="80" />' +
      '<label class="site-edit-pop__label" for="sed-ln-tg">Telegram</label>' +
      '<input class="site-edit-pop__input" id="sed-ln-tg" type="url" />' +
      '<label class="site-edit-pop__label" for="sed-ln-vk">ВКонтакте</label>' +
      '<input class="site-edit-pop__input" id="sed-ln-vk" type="url" />' +
      '<label class="site-edit-pop__label" for="sed-ln-ig">Instagram</label>' +
      '<input class="site-edit-pop__input" id="sed-ln-ig" type="url" />' +
      '<label class="site-edit-pop__label" for="sed-ln-2gis">2ГИС</label>' +
      '<input class="site-edit-pop__input" id="sed-ln-2gis" type="url" />' +
      '<label class="site-edit-pop__label" for="sed-ln-ya">Яндекс отзывы</label>' +
      '<input class="site-edit-pop__input" id="sed-ln-ya" type="url" />' +
      '<label class="site-edit-pop__label" for="sed-ln-off">Официальный сайт</label>' +
      '<input class="site-edit-pop__input" id="sed-ln-off" type="url" />' +
      '<label class="site-edit-pop__label" for="sed-footer">Текст в подвале</label>' +
      '<textarea class="site-edit-pop__input" id="sed-footer" rows="4" maxlength="4000"></textarea>' +
      '<div class="site-edit-drawer__foot">' +
      '<button type="button" class="btn btn--primary" id="sed-drawer-apply">Применить на странице</button>' +
      "</div></div>";

    drawerEl.querySelector("#sed-drawer-x").addEventListener("click", function () {
      drawerOpen = false;
      drawerEl.classList.remove("site-edit-drawer--open");
    });
    drawerEl.querySelector("#sed-drawer-apply").addEventListener("click", function () {
      readDrawerIntoDraft();
      applyDraftToDom();
      drawerOpen = false;
      drawerEl.classList.remove("site-edit-drawer--open");
      setStatus("Шапка и подвал обновлены на экране.");
    });

    document.body.appendChild(drawerEl);
  }

  function setStatus(msg) {
    if (statusEl) {
      statusEl.textContent = msg || "";
      statusEl.className = "site-edit-bar__status" + (msg ? "" : " site-edit-bar__status--empty");
    }
  }

  function buildBar() {
    barEl = document.createElement("div");
    barEl.className = "site-edit-bar";
    barEl.innerHTML =
      '<div class="site-edit-bar__inner">' +
      '<span class="site-edit-bar__badge">Админ</span>' +
      '<button type="button" class="btn btn--ghost btn--sm site-edit-bar__btn" id="sed-toggle">Подсветка правки</button>' +
      '<button type="button" class="btn btn--ghost btn--sm site-edit-bar__btn" id="sed-drawer">Шапка и подвал</button>' +
      '<button type="button" class="btn btn--primary btn--sm site-edit-bar__btn" id="sed-save">Сохранить</button>' +
      '<button type="button" class="btn btn--ghost btn--sm site-edit-bar__btn" id="sed-reset">Сброс</button>' +
      '<span class="site-edit-bar__status site-edit-bar__status--empty" id="sed-status"></span>' +
      "</div>";
    document.body.appendChild(barEl);
    statusEl = barEl.querySelector("#sed-status");

    barEl.querySelector("#sed-toggle").addEventListener("click", function () {
      editMode = !editMode;
      document.body.classList.toggle("site-edit-mode", editMode);
      barEl.querySelector("#sed-toggle").textContent = editMode
        ? "Подсветка: вкл"
        : "Подсветка правки";
      barEl.querySelector("#sed-toggle").classList.toggle("btn--primary", editMode);
      setStatus(editMode ? "Кликните по подсвеченному блоку." : "");
    });

    barEl.querySelector("#sed-drawer").addEventListener("click", function () {
      if (!drawerEl) buildDrawer();
      fillDrawerFields();
      drawerOpen = !drawerOpen;
      drawerEl.classList.toggle("site-edit-drawer--open", drawerOpen);
    });

    barEl.querySelector("#sed-save").addEventListener("click", function () {
      if (drawerEl && drawerEl.classList.contains("site-edit-drawer--open")) {
        readDrawerIntoDraft();
      }
      window.autosimApi
        .fetchJson("/api/admin/site-content", {
          method: "PATCH",
          body: draft,
        })
        .then(function () {
          setStatus("Сохранено.");
          setTimeout(function () {
            window.location.reload();
          }, 600);
        })
        .catch(function (e) {
          setStatus(e.message || "Ошибка сохранения");
        });
    });

    barEl.querySelector("#sed-reset").addEventListener("click", function () {
      if (!confirm("Сбросить сохранённый контент к умолчанию?")) return;
      window.autosimApi
        .fetchJson("/api/admin/site-content/reset", { method: "POST" })
        .then(function () {
          window.location.reload();
        })
        .catch(function (e) {
          alert(e.message);
        });
    });
  }

  function start() {
    window.autosimApi.fetchJson("/api/auth/me").then(function (me) {
      if (!me.user || me.user.role !== "admin") return;

      window.autosimApi
        .fetchJson("/api/admin/site-content")
        .then(function (data) {
          draft = deepClone(data.merged || {});
          buildBar();
          document.addEventListener("click", handleEditableClick, true);
        })
        .catch(function () {
          /* не админ или сеть */
        });
    });
  }

  whenContentReady(start);
})();
