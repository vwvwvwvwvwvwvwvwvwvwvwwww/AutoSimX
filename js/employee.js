(function () {
  "use strict";

  var D = window.autosimDom;
  var out = document.getElementById("employee-content");
  var gate = document.getElementById("employee-gate");

  if (!window.autosimApi || !out || !D) return;

  function statusRu(st) {
    var m = {
      pending: "Ожидает",
      confirmed: "Подтверждено",
      cancelled: "Отмена",
      completed: "Завершено",
    };
    return m[st] || st;
  }

  function buildSimulatorsSection(sims) {
    var h2 = D.el("h2", {
      className: "section__title",
      style: { marginTop: "0", fontSize: "1.1rem" },
      textContent: "Стенды и ТО",
    });
    var note = D.el("p", {
      className: "muted",
      style: { fontSize: "0.88rem" },
      textContent:
        "На ТО — стенд исключается из брони; ожидающие заявки отменяются с уведомлением.",
    });
    var t = D.tableShell(["Код", "Название", "Тип", "Статус", "Действия"]);
    sims.forEach(function (s) {
      var maint;
      if (s.status === "ready") {
        maint = D.el("button", {
          type: "button",
          className: "btn btn--ghost",
          dataset: { toMaint: String(s.id) },
          textContent: "На ТО",
        });
      } else {
        maint = D.el("button", {
          type: "button",
          className: "btn btn--primary",
          dataset: { toReady: String(s.id) },
          textContent: "Готов",
        });
      }
      t.tbody.appendChild(
        D.el("tr", {
          children: [
            D.el("td", { textContent: String(s.code) }),
            D.el("td", { textContent: String(s.name) }),
            D.el("td", { textContent: String(s.type) }),
            D.el("td", { textContent: String(s.status) }),
            D.el("td", { children: [maint] }),
          ],
        })
      );
    });
    var card = D.el("div", {
      className: "card",
      style: { marginTop: "1rem", padding: "1rem" },
      children: [
        D.el("h3", {
          style: { margin: "0 0 0.5rem", fontSize: "1rem" },
          textContent: "Заявка на запчасти при переводе на ТО",
        }),
        D.el("p", {
          className: "muted",
          style: { fontSize: "0.85rem" },
          textContent:
            "Нажмите «На ТО» у стенда — появится запрос названия детали.",
        }),
      ],
    });
    var frag = document.createDocumentFragment();
    frag.appendChild(h2);
    frag.appendChild(note);
    frag.appendChild(t.wrap);
    frag.appendChild(card);
    return frag;
  }

  function buildOrdersSection(orders) {
    if (!orders.length) {
      return D.el("p", {
        className: "muted",
        style: { marginTop: "1rem" },
        textContent: "Заявок на запчасти пока нет.",
      });
    }
    var h2 = D.el("h2", {
      className: "section__title",
      style: { marginTop: "2rem", fontSize: "1.1rem" },
      textContent: "Заявки на запчасти",
    });
    var t = D.tableShell([
      "ID",
      "Стенд",
      "Деталь",
      "Кол-во / прим.",
      "Статус",
      "",
    ]);
    orders.forEach(function (o) {
      t.tbody.appendChild(
        D.el("tr", {
          children: [
            D.el("td", { textContent: String(o.id) }),
            D.el("td", { textContent: String(o.simulator_code || "") }),
            D.el("td", { textContent: String(o.part_name || "") }),
            D.el("td", { textContent: String(o.qty_notes || "—") }),
            D.el("td", { textContent: String(o.status || "") }),
            D.el("td", {
              children: [
                D.el("button", {
                  type: "button",
                  className: "btn btn--ghost",
                  dataset: { orderDone: String(o.id) },
                  textContent: "Выполнено",
                }),
              ],
            }),
          ],
        })
      );
    });
    var frag = document.createDocumentFragment();
    frag.appendChild(h2);
    frag.appendChild(t.wrap);
    return frag;
  }

  function buildSessionsSection(sessions) {
    if (!sessions.length) {
      return D.el("p", { className: "muted", textContent: "Нет активных сессий." });
    }
    var t = D.tableShell([
      "ID",
      "Бронь",
      "Клиент",
      "Стенд",
      "Начало",
      "План конец",
      "",
    ]);
    sessions.forEach(function (s) {
      t.tbody.appendChild(
        D.el("tr", {
          children: [
            D.el("td", { textContent: String(s.id) }),
            D.el("td", { textContent: String(s.booking_id) }),
            D.el("td", { textContent: String(s.customer_email || "") }),
            D.el("td", { textContent: String(s.simulator_code || "") }),
            D.el("td", { textContent: String(s.started_at || "") }),
            D.el("td", { textContent: String(s.planned_end_at || "") }),
            D.el("td", {
              children: [
                D.el("button", {
                  type: "button",
                  className: "btn btn--primary",
                  dataset: { endSession: String(s.id) },
                  textContent: "Завершить",
                }),
              ],
            }),
          ],
        })
      );
    });
    return t.wrap;
  }

  function buildBookingsStartSection(bookings) {
    var rows = bookings.filter(function (b) {
      return b.status === "confirmed";
    });
    if (!rows.length) {
      return D.el("p", {
        className: "muted",
        textContent: "Нет подтверждённых броней для старта.",
      });
    }
    var t = D.tableShell(["Бронь", "Клиент", "Стенд", "Слот", ""]);
    rows.forEach(function (b) {
      t.tbody.appendChild(
        D.el("tr", {
          children: [
            D.el("td", { textContent: String(b.id) }),
            D.el("td", { textContent: String(b.customer_email || "") }),
            D.el("td", { textContent: String(b.simulator_code || "") }),
            D.el("td", { textContent: String(b.slot_start || "") }),
            D.el("td", {
              children: [
                D.el("button", {
                  type: "button",
                  className: "btn btn--primary",
                  dataset: { startBooking: String(b.id) },
                  textContent: "Начать сессию",
                }),
              ],
            }),
          ],
        })
      );
    });
    return t.wrap;
  }

  function wireActions() {
    out.querySelectorAll("[data-to-maint]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var id = btn.getAttribute("data-to-maint");
        var part = window.prompt("Название запчасти (необязательно):", "");
        var notes = window.prompt("Кол-во / примечание:", "") || "";
        var body = { status: "maintenance" };
        if (part && String(part).trim()) {
          body.partOrder = { partName: String(part).trim(), qtyNotes: notes };
        }
        window.autosimApi
          .fetchJson("/api/simulators/" + id, { method: "PATCH", body: body })
          .then(function () {
            return refresh();
          })
          .catch(function (e) {
            alert(e.message);
          });
      });
    });

    out.querySelectorAll("[data-to-ready]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var id = btn.getAttribute("data-to-ready");
        window.autosimApi
          .fetchJson("/api/simulators/" + id, {
            method: "PATCH",
            body: { status: "ready" },
          })
          .then(function () {
            return refresh();
          })
          .catch(function (e) {
            alert(e.message);
          });
      });
    });

    out.querySelectorAll("[data-end-session]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var sid = btn.getAttribute("data-end-session");
        window.autosimApi
          .fetchJson("/api/sessions/" + sid + "/end", { method: "POST" })
          .then(function (r) {
            alert("Сессия завершена. Бонусы клиенту: " + (r.bonusPointsAwarded || 0));
            return refresh();
          })
          .catch(function (e) {
            alert(e.message);
          });
      });
    });

    out.querySelectorAll("[data-start-booking]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var bid = btn.getAttribute("data-start-booking");
        window.autosimApi
          .fetchJson("/api/sessions/start", {
            method: "POST",
            body: { bookingId: Number(bid) },
          })
          .then(function () {
            return refresh();
          })
          .catch(function (e) {
            alert(e.message);
          });
      });
    });

    out.querySelectorAll("[data-order-done]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var oid = btn.getAttribute("data-order-done");
        window.autosimApi
          .fetchJson("/api/simulators/maintenance-orders/" + oid, {
            method: "PATCH",
            body: { status: "done" },
          })
          .then(function () {
            return refresh();
          })
          .catch(function (e) {
            alert(e.message);
          });
      });
    });
  }

  function refresh() {
    return Promise.all([
      window.autosimApi.fetchJson("/api/simulators"),
      window.autosimApi.fetchJson("/api/bookings"),
      window.autosimApi.fetchJson("/api/sessions/active"),
      window.autosimApi.fetchJson("/api/simulators/maintenance-orders"),
    ]).then(function (arr) {
      var sims = arr[0].simulators || [];
      var bookings = arr[1].bookings || [];
      var sessions = arr[2].sessions || [];
      var orders = arr[3].orders || [];

      var intro = D.el("p", {
        children: [
          D.el("strong", { textContent: "Сотрудник" }),
          document.createTextNode(" — сессии, ТО, заявки на запчасти."),
        ],
      });

      var hSess = D.el("h2", {
        className: "section__title",
        style: { marginTop: "2rem", fontSize: "1.1rem" },
        textContent: "Активные сессии (таймер на стенде)",
      });
      var hStart = D.el("h2", {
        className: "section__title",
        style: { marginTop: "2rem", fontSize: "1.1rem" },
        textContent: "Старт по подтверждённой брони",
      });

      D.setContent(out, [
        intro,
        buildSimulatorsSection(sims),
        buildOrdersSection(orders),
        hSess,
        buildSessionsSection(sessions),
        hStart,
        buildBookingsStartSection(bookings),
      ]);

      wireActions();
    });
  }

  window.autosimApi.fetchJson("/api/auth/me").then(function (data) {
    if (!data.user) {
      var p = D.el("p", { className: "form-msg form-msg--error" });
      p.appendChild(D.link("login.html", "Войдите"));
      p.appendChild(document.createTextNode(" под учётной записью сотрудника."));
      D.setContent(gate, p);
      return;
    }
    var role = data.user.role;
    if (role !== "employee" && role !== "admin") {
      var p2 = D.el("p", { className: "form-msg form-msg--error" });
      p2.appendChild(document.createTextNode("Раздел для сотрудников. "));
      p2.appendChild(D.link("login.html", "Войти"));
      D.setContent(gate, p2);
      return;
    }
    gate.style.display = "none";
    document.getElementById("employee-panel").hidden = false;
    return refresh().catch(function (e) {
      D.setContent(
        out,
        D.el("p", {
          className: "form-msg form-msg--error",
          textContent: e.message || "Ошибка",
        })
      );
    });
  });

  var btnLogout = document.getElementById("btn-logout-emp");
  if (btnLogout) {
    btnLogout.addEventListener("click", function () {
      window.autosimApi
        .fetchJson("/api/auth/logout", { method: "POST" })
        .then(function () {
          window.location.href = "index.html";
        });
    });
  }
})();
