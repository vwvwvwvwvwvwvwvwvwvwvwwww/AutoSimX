/**
 * Появление блоков при скролле + безопасные фолбэки (reduce motion, старые браузеры).
 */
(function () {
  "use strict";

  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    return;
  }

  var sel = [
    "main .card",
    "main .section__title",
    "main .sim-info",
    "main .glass-panel",
    "main .discipline-card",
    "main .gallery-bento__item",
    "main .pricing-card-off",
    "main .corp-block",
    "main .magnet-block",
    "main .promo-strip",
    "main .official-feature",
    "main .review-card-link",
    "main .faq-item",
    "main .data-table-wrap",
    "main .visit",
    "main .contact",
    "main .contact-channel",
    "main .auth-form",
    "main .auth-panel",
  ].join(", ");

  function mark(el) {
    if (el.classList.contains("no-reveal")) return;
    el.classList.add("reveal");
  }

  function revealAll(nodes) {
    for (var i = 0; i < nodes.length; i++) {
      nodes[i].classList.add("reveal--visible");
    }
  }

  var nodes = [];
  try {
    document.querySelectorAll(sel).forEach(function (el) {
      mark(el);
      nodes.push(el);
    });
  } catch (_) {
    return;
  }

  if (!nodes.length) return;

  if (!("IntersectionObserver" in window)) {
    revealAll(nodes);
    return;
  }

  var io = new IntersectionObserver(
    function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        entry.target.classList.add("reveal--visible");
        io.unobserve(entry.target);
      });
    },
    { threshold: 0.06, rootMargin: "0px 0px -24px 0px" }
  );

  nodes.forEach(function (el) {
    io.observe(el);
  });
})();
