(function () {
  "use strict";

  var homeScrollBound = false;

  function bind() {
    var burger = document.getElementById("burger");
    var nav = document.getElementById("nav");
    if (!burger || !nav) return;
    if (burger.getAttribute("data-nav-bound") === "1") return;
    burger.setAttribute("data-nav-bound", "1");

    function setOpen(open) {
      burger.setAttribute("aria-expanded", open ? "true" : "false");
      nav.classList.toggle("is-open", open);
    }

    burger.addEventListener("click", function () {
      var open = burger.getAttribute("aria-expanded") === "true";
      setOpen(!open);
    });

    nav.querySelectorAll("a").forEach(function (link) {
      link.addEventListener("click", function () {
        setOpen(false);
      });
    });

    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape") setOpen(false);
    });
  }

  function bindHomeHeaderScroll() {
    if (document.body.getAttribute("data-page") !== "home") return;
    if (homeScrollBound) return;
    var header = document.querySelector(".header");
    var hero = document.querySelector(".hero");
    if (!header || !hero) return;
    homeScrollBound = true;

    function onScroll() {
      var threshold = Math.min(hero.offsetHeight * 0.28, 220);
      header.classList.toggle("header--scrolled", window.scrollY > threshold);
    }

    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
  }

  function tryBindAll() {
    bind();
    bindHomeHeaderScroll();
  }

  /** Вызывается из shell.js после вставки шапки (шапка может появиться позже DOMContentLoaded). */
  window.autosimBindNav = tryBindAll;

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", tryBindAll);
  } else {
    tryBindAll();
  }
})();
