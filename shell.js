/**
 * Вставляет общую шапку и подвал на каждой странице.
 * Текущая страница: атрибут data-page на <body> (home | about | equipment | visit | contact).
 */
(function () {
  "use strict";

  function startShell() {
  var site = window.AUTOSIM_SITE;
  var D = window.autosimDom;
  if (!site || !D) return;

  function extAttrs() {
    return { target: "_blank", rel: "noopener noreferrer" };
  }

  function buildNav() {
    var nav = D.el("nav", { className: "nav", id: "nav" });
    var currentAttr = document.body.getAttribute("data-page");
    var current = currentAttr === null || currentAttr === "" ? "__none__" : currentAttr;

    site.nav.forEach(function (item) {
      var a = D.el("a", { href: item.href, textContent: item.label });
      if (current !== "__none__" && item.page === current) {
        a.setAttribute("aria-current", "page");
      }
      nav.appendChild(a);
    });
    return nav;
  }

  function buildHeader() {
    var logo = D.el("a", {
      className: "logo site-editable-target",
      id: "site-edit-logo",
      href: "index.html",
      dataset: { siteKind: "brand" },
      children: [
        D.el("span", { className: "logo__mark", textContent: site.brand.shortMark }),
        (function () {
          var span = D.el("span", { className: "logo__text" });
          var nm = String(site.brand.name || "AutoSimX");
          if (nm.length >= 1 && nm.charAt(nm.length - 1) === "X") {
            span.appendChild(document.createTextNode(nm.slice(0, -1)));
            span.appendChild(D.el("span", { className: "logo__x", textContent: "X" }));
          } else {
            span.appendChild(document.createTextNode(nm));
          }
          return span;
        })(),
      ],
    });

    var ext = extAttrs();
    var actions = D.el("div", {
      className: "header__actions",
      children: [
        D.el("a", {
          className: "btn btn--ghost site-editable-target",
          id: "site-edit-phone-btn",
          href: site.phone.href,
          textContent: "Позвонить",
          dataset: { siteKind: "phone" },
        }),
        D.el("a", {
          className: "btn btn--primary site-editable-target",
          id: "site-edit-tg-btn",
          href: site.links.telegram,
          textContent: "Забронировать",
          target: ext.target,
          rel: ext.rel,
          dataset: { sitePath: "site.links.telegram" },
        }),
        D.el("button", {
          className: "burger",
          type: "button",
          id: "burger",
          ariaLabel: "Меню",
          ariaExpanded: "false",
          ariaControls: "nav",
          children: [D.el("span"), D.el("span"), D.el("span")],
        }),
      ],
    });

    var inner = D.el("div", {
      className: "header__inner",
      children: [logo, buildNav(), actions],
    });

    return D.el("header", { className: "header", children: [inner] });
  }

  function buildFooter() {
    var auth = D.el("p", { className: "footer__auth" });
    auth.appendChild(D.link(site.authLinks.login, "Вход"));
    auth.appendChild(document.createTextNode(" · "));
    auth.appendChild(D.link(site.authLinks.register, "Регистрация"));
    auth.appendChild(document.createTextNode(" · "));
    auth.appendChild(D.link("employee.html", "Кабинет сотрудника"));
    auth.appendChild(document.createTextNode(" · "));
    auth.appendChild(D.link("customer.html", "Кабинет клиента"));
    auth.appendChild(document.createTextNode(" · "));
    auth.appendChild(D.link("admin.html", "Админ-панель"));

    return D.el("footer", {
      className: "footer",
      children: [
        D.el("div", {
          className: "container footer__inner",
          children: [
            D.el("div", {
              className: "footer__brand",
              children: [
                D.el("span", {
                  className: "logo__mark logo__mark--sm",
                  id: "site-edit-footer-mark",
                  textContent: site.brand.shortMark,
                }),
                D.el("span", {
                  id: "site-edit-footer-brand",
                  textContent: "© " + site.brand.name + ", Оренбург",
                }),
              ],
            }),
            auth,
            D.el("p", {
              className: "footer__note site-editable-target",
              id: "site-edit-footer-note",
              textContent: site.footerNote,
              dataset: { sitePath: "site.footerNote" },
            }),
          ],
        }),
      ],
    });
  }

  function svgEl(name, attrs) {
    var e = document.createElementNS("http://www.w3.org/2000/svg", name);
    if (attrs) {
      Object.keys(attrs).forEach(function (k) {
        e.setAttribute(k, attrs[k]);
      });
    }
    return e;
  }

  function buildScrollCarStrip() {
    var strip = D.el("div", {
      id: "scroll-car-strip",
      className: "scroll-car-strip",
      ariaHidden: "true",
    });
    strip.appendChild(D.el("div", { className: "scroll-car-road" }));

    var car = D.el("div", { className: "scroll-car", id: "scroll-car" });
    var svg = svgEl("svg", {
      viewBox: "0 0 120 48",
      xmlns: "http://www.w3.org/2000/svg",
      fill: "none",
    });
    svg.appendChild(
      svgEl("path", {
        fill: "#e4e4e7",
        d: "M8 32c0-6 4-10 10-10h4l6-10h52l8 10h6c6 0 10 4 10 10v6H8v-6z",
      })
    );
    svg.appendChild(
      svgEl("path", {
        fill: "#18181b",
        d: "M12 34h96v4H12v-4z",
      })
    );
    svg.appendChild(
      svgEl("rect", { x: "18", y: "22", width: "16", height: "10", rx: "2", fill: "#27272a" })
    );
    svg.appendChild(
      svgEl("rect", { x: "86", y: "22", width: "16", height: "10", rx: "2", fill: "#27272a" })
    );
    svg.appendChild(svgEl("circle", { cx: "28", cy: "38", r: "6", fill: "#0a0a0b" }));
    svg.appendChild(svgEl("circle", { cx: "92", cy: "38", r: "6", fill: "#0a0a0b" }));
    svg.appendChild(svgEl("circle", { cx: "28", cy: "38", r: "2.5", fill: "#71717a" }));
    svg.appendChild(svgEl("circle", { cx: "92", cy: "38", r: "2.5", fill: "#71717a" }));
    svg.appendChild(
      svgEl("path", {
        fill: "#e30613",
        d: "M38 14h44l-4 8H42l-4-8z",
        opacity: "0.95",
      })
    );
    car.appendChild(svg);
    strip.appendChild(car);
    return strip;
  }

  var mountTop = document.getElementById("shell-top");
  var mountBottom = document.getElementById("shell-bottom");
  if (mountTop) {
    D.setContent(mountTop, [D.el("div", { className: "noise", ariaHidden: "true" }), buildHeader()]);
  }
  if (mountBottom) {
    D.setContent(mountBottom, buildFooter());
  }

  /** Декоративная машина, едет вдоль экрана при вертикальной прокрутке страницы */
  function initScrollCar() {
    if (document.getElementById("scroll-car-strip")) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      return;
    }

    var strip = buildScrollCarStrip();
    document.body.appendChild(strip);

    var car = document.getElementById("scroll-car");
    if (!car) {
      strip.remove();
      return;
    }

    document.documentElement.classList.add("scroll-car-active");

    var carW = 92;
    var ticking = false;

    function update() {
      ticking = false;
      var doc = document.documentElement;
      var max = doc.scrollHeight - window.innerHeight;
      var t = max <= 0 ? 0 : doc.scrollTop / max;
      if (t < 0) t = 0;
      if (t > 1) t = 1;
      var vw = window.innerWidth;
      var x = -carW + t * (vw + carW * 1.4);
      car.style.transform = "translate3d(" + x + "px,0,0)";
    }

    function onScroll() {
      if (!ticking) {
        ticking = true;
        window.requestAnimationFrame(update);
      }
    }

    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll, { passive: true });
  }

    initScrollCar();

    applyHomeHero(site, D);
  }

  function applyHomeHero(site, D) {
    var h = window.__AUTOSIM_MERGED_HOME_HERO;
    var page = document.body && document.body.getAttribute("data-page");
    if (page !== "home" || !h || !D) return;

    function setText(id, key) {
      var el = document.getElementById(id);
      if (el && h[key] != null) el.textContent = h[key];
    }

    setText("hero-eyebrow", "eyebrow");
    var promoRoot = document.getElementById("hero-promo-root");
    if (promoRoot) {
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
    setText("hero-title-line1", "titleLine1");
    setText("hero-title-before", "titleBefore");
    setText("hero-title-highlight", "titleHighlight");
    setText("hero-tagline", "tagline");
    setText("hero-lead", "lead");

    var book = document.getElementById("hero-cta-book");
    if (book) {
      if (h.ctaBook != null) book.textContent = h.ctaBook;
      if (site.links && site.links.telegram) book.href = site.links.telegram;
    }
    var vk = document.getElementById("hero-cta-vk");
    if (vk) {
      if (h.ctaVk != null) vk.textContent = h.ctaVk;
      if (site.links && site.links.vk) vk.href = site.links.vk;
    }

    setText("hero-stat-mode-label", "statModeLabel");
    setText("hero-stat-mode-value", "statModeValue");
    setText("hero-stat-addr-label", "statAddrLabel");
    setText("hero-stat-addr-value", "statAddrValue");
    setText("hero-stat-guests-label", "statGuestsLabel");
    setText("hero-stat-guests-value", "statGuestsValue");
  }

  var p = window.__AUTOSIM_SITE_CONTENT_PROMISE;
  if (p && typeof p.then === "function") {
    p.then(startShell, startShell);
  } else {
    startShell();
  }
})();
