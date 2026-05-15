(function () {
  "use strict";

  function bind() {
    var burger = document.getElementById("burger");
    var nav = document.getElementById("nav");
    if (!burger || !nav) return;

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
    var header = document.querySelector(".header");
    var hero = document.querySelector(".hero");
    if (!header || !hero) return;

    function onScroll() {
      var threshold = Math.min(hero.offsetHeight * 0.28, 220);
      header.classList.toggle("header--scrolled", window.scrollY > threshold);
    }

    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", function () {
      bind();
      bindHomeHeaderScroll();
    });
  } else {
    bind();
    bindHomeHeaderScroll();
  }
})();
