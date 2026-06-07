(function () {
  "use strict";

  var D = window.autosimDom;
  var out = document.getElementById("customer-content");
  var gate = document.getElementById("customer-gate");

  if (!window.autosimApi || !out || !D) return;

  function statusRu(st) {
    var m = {
      pending: "Ожидает подтверждения",
      confirmed: "Подтверждено",
      cancelled: "Отменено",
      completed: "Завершено",
    };
    return m[st] || st;
  }

  function typeRu(t) {
    var m = {
      standart: "Standart",
      pro: "Pro",
      vr: "VR",
      motion: "Подвижная",
      kids: "Детский",
    };
    return m[t] || t;
  }

  function buildBookingFormFragment(sims) {
    var ready = sims.filter(function (s) {
      return s.status === "ready";
    });

    var h2 = D.el("h2", {
      className: "cabinet-section__title",
      style: { marginTop: "0" },
      textContent: "Новая бронь",
    });
    var lead = D.el("p", {
      className: "muted",
      style: { fontSize: "0.9rem" },
      textContent:
        "Выберите стенд, дату и длительность. Сервер проверит пересечения и статус ТО.",
    });

    var typeSel = D.el("select", { id: "bk-type", children: [
      D.option("", "Все доступные"),
      D.option("standart", "Standart"),
      D.option("pro", "Pro"),
      D.option("vr", "VR"),
      D.option("motion", "Подвижная"),
      D.option("kids", "Детский"),
    ]});

    var simSel = D.el("select", {
      id: "bk-sim",
      name: "simulatorId",
      required: true,
      children: [],
    });

    function fillSimOptions() {
      D.clear(simSel);
      var t = typeSel.value;
      var list = ready.filter(function (s) {
        return !t || s.type === t;
      });
      if (!list.length) {
        simSel.appendChild(D.option("", "Нет свободных стендов"));
        return;
      }
      list.forEach(function (s) {
        simSel.appendChild(
          D.option(
            String(s.id),
            s.code + " — " + s.name + " (" + typeRu(s.type) + ")"
          )
        );
      });
    }
    fillSimOptions();

    var start = D.el("input", {
      id: "bk-start",
      name: "slotStart",
      type: "datetime-local",
      required: true,
    });

    var durSel = D.el("select", {
      id: "bk-dur",
      name: "durationMinutes",
      children: [
        D.option("30", "30"),
        D.option("60", "60", true),
        D.option("90", "90"),
        D.option("120", "120"),
      ],
    });

    var form = D.el("form", {
      id: "form-booking",
      className: "studio-form studio-form--grid",
      children: [
        D.el("div", {
          className: "form-row",
          children: [
            D.el("label", { htmlFor: "bk-type", textContent: "Тип (фильтр)" }),
            typeSel,
          ],
        }),
        D.el("div", {
          className: "form-row",
          children: [
            D.el("label", { htmlFor: "bk-sim", textContent: "Симулятор" }),
            simSel,
          ],
        }),
        D.el("div", {
          className: "form-row",
          children: [
            D.el("label", { htmlFor: "bk-start", textContent: "Начало слота" }),
            start,
          ],
        }),
        D.el("div", {
          className: "form-row",
          children: [
            D.el("label", { htmlFor: "bk-dur", textContent: "Длительность (мин)" }),
            durSel,
          ],
        }),
        D.el("p", {
          id: "bk-check-msg",
          className: "form-msg studio-form__full",
          role: "status",
        }),
        D.el("div", {
          className: "studio-form__actions studio-form__full",
          children: [
            D.el("button", {
              type: "button",
              className: "btn btn--ghost",
              id: "bk-check",
              textContent: "Проверить доступность",
            }),
            D.el("button", {
              type: "submit",
              className: "btn btn--primary",
              textContent: "Отправить заявку",
            }),
          ],
        }),
        D.el("p", {
          id: "bk-form-msg",
          className: "form-msg studio-form__full",
          role: "status",
        }),
      ],
    });

    typeSel.addEventListener("change", fillSimOptions);

    var frag = document.createDocumentFragment();
    frag.appendChild(h2);
    frag.appendChild(lead);
    frag.appendChild(form);
    return { fragment: frag };
  }

  function buildBookingsNode(rows) {
    if (!rows || !rows.length) {
      return D.el("p", { className: "muted", textContent: "Пока нет бронирований." });
    }
    var t = D.tableShell(["ID", "Стенд", "Тип", "Слот", "Мин", "Статус"]);
    rows.forEach(function (b) {
      var tr = D.el("tr", {
        children: [
          D.el("td", { textContent: String(b.id) }),
          D.el("td", { textContent: String(b.simulator_code || "") }),
          D.el("td", { textContent: typeRu(b.simulator_type) }),
          D.el("td", { textContent: String(b.slot_start || "") }),
          D.el("td", { textContent: String(b.duration_minutes) }),
          D.el("td", { textContent: statusRu(b.status) }),
        ],
      });
      t.tbody.appendChild(tr);
    });
    return t.wrap;
  }

  function buildNotificationsNode(rows) {
    if (!rows || !rows.length) {
      return D.el("p", {
        className: "muted",
        textContent: "Уведомлений пока нет (появятся после подтверждения брони и сессий).",
      });
    }
    var ul = D.el("ul", { className: "notif-list" });
    rows.forEach(function (n) {
      var unread = !n.read_at;
      var inner = D.el("div", {
        className: "notif-item__row",
        children: [
          D.el("div", {
            children: [
              D.el("strong", { textContent: String(n.kind) }),
              document.createTextNode(" · " + String(n.created_at || "")),
              D.el("br"),
              document.createTextNode(String(n.message)),
            ],
          }),
        ],
      });
      if (unread) {
        inner.appendChild(
          D.el("button", {
            type: "button",
            className: "btn btn--ghost",
            dataset: { notifRead: String(n.id) },
            textContent: "Ок",
          })
        );
      }
      ul.appendChild(
        D.el("li", {
          className: unread ? "notif-item notif-item--unread" : "notif-item",
          children: [inner],
        })
      );
    });
    return ul;
  }

  function wireBookingForm(simsAll) {
    var form = document.getElementById("form-booking");
    if (!form) return;

    document.getElementById("bk-check").addEventListener("click", function () {
      var msg = document.getElementById("bk-check-msg");
      msg.textContent = "";
      msg.className = "form-msg";
      var fd = new FormData(form);
      var simId = fd.get("simulatorId");
      var slot = fd.get("slotStart");
      var dur = fd.get("durationMinutes") || "60";
      if (!slot || !simId) {
        msg.textContent = "Укажите стенд и время";
        msg.className = "form-msg form-msg--error";
        return;
      }
      var iso = new Date(slot);
      if (Number.isNaN(iso.getTime())) {
        msg.textContent = "Некорректная дата";
        msg.className = "form-msg form-msg--error";
        return;
      }
      var q =
        "/api/bookings/availability-check?simulatorId=" +
        encodeURIComponent(String(simId)) +
        "&slotStart=" +
        encodeURIComponent(iso.toISOString()) +
        "&durationMinutes=" +
        encodeURIComponent(String(dur));
      window.autosimApi
        .fetchJson(q)
        .then(function (d) {
          msg.textContent = d.available
            ? "Слот свободен."
            : "Недоступно: " + (d.reason || "занято");
          msg.className = "form-msg " + (d.available ? "form-msg--ok" : "form-msg--error");
        })
        .catch(function (e) {
          msg.textContent = e.message || "Ошибка";
          msg.className = "form-msg form-msg--error";
        });
    });


    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var fm = document.getElementById("bk-form-msg");
      fm.textContent = "";
      fm.className = "form-msg";
      var fd = new FormData(form);
      var slotRaw = fd.get("slotStart");
      var simRaw = fd.get("simulatorId");
      var durRaw = fd.get("durationMinutes") || "60";

      if (!slotRaw || !simRaw) {
        fm.textContent = "Укажите стенд и время";
        fm.className = "form-msg form-msg--error";
        return;
      }

      var iso = new Date(slotRaw);
      if (Number.isNaN(iso.getTime())) {
        fm.textContent = "Некорректная дата";
        fm.className = "form-msg form-msg--error";
        return;
      }

      var simulatorId = parseInt(String(simRaw), 10);
      var durationMinutes = parseInt(String(durRaw), 10);
      if (!Number.isInteger(simulatorId) || simulatorId < 1) {
        fm.textContent = "Выберите симулятор из списка";
        fm.className = "form-msg form-msg--error";
        return;
      }
      if (
        !Number.isInteger(durationMinutes) ||
        durationMinutes < 30 ||
        durationMinutes > 240
      ) {
        fm.textContent = "Длительность: от 30 до 240 минут";
        fm.className = "form-msg form-msg--error";
        return;
      }

      window.autosimApi
        .fetchJson("/api/bookings", {
          method: "POST",
          body: {
            simulatorId: simulatorId,
            slotStart: iso.toISOString(),
            durationMinutes: durationMinutes,
          },
        })
        .then(function () {
          fm.textContent =
            "Заявка создана. Ожидайте подтверждения в панели администратора.";
          fm.className = "form-msg form-msg--ok";
          return refreshAll();
        })
        .catch(function (err) {
          fm.textContent =
            err && typeof err.message === "string" && err.message
              ? err.message
              : "Ошибка";
          fm.className = "form-msg form-msg--error";
        });
    });
  }

  function refreshAll() {
    return Promise.all([
      window.autosimApi.fetchJson("/api/bookings/mine"),
      window.autosimApi.fetchJson("/api/notifications"),
    ]).then(function (arr) {
      var bk = document.getElementById("cust-bookings");
      var nt = document.getElementById("cust-notifs");
      if (bk) D.setContent(bk, buildBookingsNode(arr[0].bookings || []));
      if (nt) D.setContent(nt, buildNotificationsNode(arr[1].notifications || []));
    });
  }

  var notifDelegationBound = false;

  function notifClickHandler(ev) {
    var root = document.getElementById("cust-notifs");
    if (!root || !root.contains(ev.target)) return;
    var btn = ev.target.closest("[data-notif-read]");
    if (!btn) return;
    var id = btn.getAttribute("data-notif-read");
    window.autosimApi
      .fetchJson("/api/notifications/" + id + "/read", { method: "PATCH", body: {} })
      .then(function () {
        return refreshAll();
      });
  }

  function buildDashboard(user, sims) {
    var userBar = D.el("div", {
      className: "cabinet-user",
      children: [
        D.el("span", {
          children: [
            document.createTextNode("Вы вошли как "),
            D.el("strong", { textContent: user.email }),
          ],
        }),
        D.el("span", {
          className: "cabinet-user__bonus",
          textContent:
            "Бонусы: " + String(user.bonusPoints != null ? user.bonusPoints : 0),
        }),
      ],
    });

    var hint = D.el("p", {
      className: "muted",
      style: { fontSize: "0.9rem", marginTop: "0" },
      textContent:
        "Сценарий: заявка → проверка слота → подтверждение админом → уведомление здесь.",
    });

    var built = buildBookingFormFragment(sims);

    var hBk = D.el("h2", {
      className: "cabinet-section__title",
      textContent: "Мои бронирования",
    });
    var divBk = D.el("div", { id: "cust-bookings" });
    var hNt = D.el("h2", {
      className: "cabinet-section__title",
      textContent: "Уведомления",
    });
    var divNt = D.el("div", { id: "cust-notifs" });

    D.setContent(out, [
      userBar,
      hint,
      built.fragment,
      hBk,
      divBk,
      hNt,
      divNt,
    ]);

    if (!notifDelegationBound) {
      var panel = document.getElementById("customer-panel");
      if (panel) {
        panel.addEventListener("click", notifClickHandler);
        notifDelegationBound = true;
      }
    }

    wireBookingForm(sims);
    return refreshAll();
  }

  window.autosimApi.fetchJson("/api/auth/me").then(function (data) {
    if (!data.user) {
      var p = D.el("p", { className: "form-msg form-msg--error" });
      p.appendChild(D.link("login.html", "Войдите"));
      p.appendChild(document.createTextNode(" или "));
      p.appendChild(D.link("register.html", "зарегистрируйтесь"));
      p.appendChild(document.createTextNode("."));
      D.setContent(gate, p);
      return;
    }
    if (data.user.role !== "customer") {
      var p2 = D.el("p", { className: "form-msg form-msg--error" });
      p2.appendChild(document.createTextNode("Бронирование доступно клиентам. "));
      p2.appendChild(D.link("login.html", "Войти"));
      D.setContent(gate, p2);
      return;
    }
    gate.style.display = "none";
    document.getElementById("customer-panel").hidden = false;

    return window.autosimApi
      .fetchJson("/api/simulators")
      .then(function (sdata) {
        return buildDashboard(data.user, sdata.simulators || []);
      })
      .catch(function (e) {
        D.setContent(
          out,
          D.el("p", {
            className: "form-msg form-msg--error",
            textContent: e.message || "Не удалось загрузить симуляторы",
          })
        );
      });
  });

  var btnLogout = document.getElementById("btn-logout-cust");
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

