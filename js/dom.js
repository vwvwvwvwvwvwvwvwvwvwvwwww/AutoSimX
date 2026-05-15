/**
 * Утилиты DOM без innerHTML: безопасная сборка разметки через createElement.
 */
(function () {
  "use strict";

  function clear(el) {
    while (el.firstChild) {
      el.removeChild(el.firstChild);
    }
  }

  /**
   * @param {string} tag
   * @param {object} [opt]
   * @param {string} [opt.className]
   * @param {string} [opt.id]
   * @param {string} [opt.textContent]
   * @param {string} [opt.innerHTML] — не используйте; оставлено пустым намеренно
   * @param {object} [opt.style] — объект { cssProperty: value }
   * @param {object} [opt.dataset] — data-* в camelCase
   * @param {Node[]} [opt.children]
   */
  function el(tag, opt) {
    opt = opt || {};
    var n = document.createElement(tag);
    if (opt.className != null) n.className = opt.className;
    if (opt.id != null) n.id = opt.id;
    if (opt.textContent != null) n.textContent = opt.textContent;
    if (opt.htmlFor != null) n.htmlFor = opt.htmlFor;
    if (opt.type != null) n.type = opt.type;
    if (opt.name != null) n.name = opt.name;
    if (opt.value != null) n.value = opt.value;
    if (opt.href != null) n.href = opt.href;
    if (opt.target != null) n.target = opt.target;
    if (opt.rel != null) n.rel = opt.rel;
    if (opt.role != null) n.setAttribute("role", opt.role);
    if (opt.hidden != null) n.hidden = opt.hidden;
    if (opt.required != null) n.required = opt.required;
    if (opt.selected != null) n.selected = opt.selected;
    if (opt.disabled != null) n.disabled = opt.disabled;
    if (opt.autocomplete != null) n.autocomplete = opt.autocomplete;
    if (opt.style != null) {
      Object.keys(opt.style).forEach(function (k) {
        n.style[k] = opt.style[k];
      });
    }
    if (opt.dataset != null) {
      Object.keys(opt.dataset).forEach(function (k) {
        n.dataset[k] = opt.dataset[k];
      });
    }
    if (opt.ariaLabel != null) n.setAttribute("aria-label", String(opt.ariaLabel));
    if (opt.ariaExpanded != null) n.setAttribute("aria-expanded", String(opt.ariaExpanded));
    if (opt.ariaControls != null) n.setAttribute("aria-controls", String(opt.ariaControls));
    if (opt.ariaCurrent != null) n.setAttribute("aria-current", String(opt.ariaCurrent));
    if (opt.ariaHidden != null) n.setAttribute("aria-hidden", String(opt.ariaHidden));
    (opt.children || []).forEach(function (c) {
      if (c != null) n.appendChild(c);
    });
    return n;
  }

  function setContent(parent, children) {
    if (!parent) return;
    var arr = Array.isArray(children) ? children : [children];
    parent.replaceChildren.apply(
      parent,
      arr.filter(function (c) {
        return c != null;
      })
    );
  }

  function link(href, text, className) {
    return el("a", {
      href: href,
      textContent: text,
      className: className || "",
    });
  }

  function option(value, label, selected) {
    return el("option", {
      value: value,
      textContent: label,
      selected: !!selected,
    });
  }

  function tableShell(headers) {
    var wrap = el("div", { className: "data-table-wrap" });
    var table = el("table", { className: "data-table", children: [el("thead"), el("tbody")] });
    var theadRow = el("tr");
    headers.forEach(function (h) {
      theadRow.appendChild(el("th", { textContent: h }));
    });
    table.querySelector("thead").appendChild(theadRow);
    wrap.appendChild(table);
    return { wrap: wrap, tbody: table.querySelector("tbody") };
  }

  window.autosimDom = {
    clear: clear,
    el: el,
    setContent: setContent,
    link: link,
    option: option,
    tableShell: tableShell,
  };
})();