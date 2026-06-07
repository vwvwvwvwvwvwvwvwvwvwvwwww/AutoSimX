(function () {
  "use strict";

  var D = window.autosimDom;
  var listEl = document.getElementById("users-list");
  var form = document.getElementById("form-create-user");
  var formMsg = document.getElementById("form-create-msg");
  var simForm = document.getElementById("form-create-simulator");
  var simFormMsg = document.getElementById("form-create-simulator-msg");
  var simListEl = document.getElementById("simulators-list");
  var gate = document.getElementById("admin-gate");
  var chartBookings = null;
  var chartRevenue = null;

  if (!window.autosimApi || !listEl || !D) return;

  function statusRu(st) {
    var m = {
      pending: "Ожидает",
      confirmed: "Подтверждено",
      cancelled: "Отмена",
      completed: "Завершено",
    };
    return m[st] || st;
  }

  function simTypeRu(t) {
    var m = {
      standart: "Standart",
      pro: "Pro",
      vr: "VR",
      motion: "Подвижная",
      kids: "Детский",
    };
    return m[t] || t;
  }

  function simStatusRu(st) {
    var m = { ready: "Готов", maintenance: "На ТО" };
    return m[st] || st;
  }

  function renderSimulators(sims) {
    if (!simListEl) return;
    D.clear(simListEl);
    if (!sims || !sims.length) {
      simListEl.appendChild(
        D.el("tr", {
          children: [
            D.el("td", {
              colSpan: 6,
              className: "muted",
              textContent: "Стендов пока нет — добавьте первый через форму ниже.",
            }),
          ],
        })
      );
      return;
    }
    sims.forEach(function (s) {
      simListEl.appendChild(
        D.el("tr", {
          children: [
            D.el("td", { textContent: String(s.id) }),
            D.el("td", { textContent: String(s.code) }),
            D.el("td", { textContent: String(s.name) }),
            D.el("td", { textContent: simTypeRu(s.type) }),
            D.el("td", { textContent: String(s.hourly_rate_rub) }),
            D.el("td", { textContent: simStatusRu(s.status) }),
          ],
        })
      );
    });
  }

  function loadSimulators() {
    return window.autosimApi.fetchJson("/api/simulators").then(function (data) {
      renderSimulators(data.simulators || []);
    });
  }

  function renderUsers(users) {
    D.clear(listEl);
    (users || []).forEach(function (u) {
      var pill = D.el("span", {
        className: "role-pill role-pill--" + String(u.role),
        textContent: String(u.role),
      });
      listEl.appendChild(
        D.el("tr", {
          children: [
            D.el("td", { textContent: String(u.id) }),
            D.el("td", { textContent: String(u.email) }),
            D.el("td", { children: [pill] }),
            D.el("td", { textContent: String(u.display_name || "—") }),
            D.el("td", {
              textContent: String(u.bonus_points != null ? u.bonus_points : 0),
            }),
            D.el("td", { textContent: String(u.created_at || "") }),
          ],
        })
      );
    });
  }

  function patchBooking(id, status) {
    return window.autosimApi
      .fetchJson("/api/bookings/" + id, { method: "PATCH", body: { status: status } })
      .then(function () {
        return loadPortal();
      })
      .catch(function (e) {
        alert(e.message);
      });
  }

  function renderBookingsAdmin(bookings) {
    var wrap = document.getElementById("admin-bookings-body");
    if (!wrap) return;

    var t = D.tableShell([
      "ID",
      "Клиент",
      "Стенд",
      "Слот",
      "Мин",
      "Статус",
      "",
    ]);

    (bookings || []).forEach(function (b) {
      var actions = D.el("td");
      if (b.status === "pending") {
        actions.appendChild(
          D.el("button", {
            type: "button",
            className: "btn btn--primary",
            dataset: { bkOk: String(b.id) },
            textContent: "Подтвердить",
          })
        );
        actions.appendChild(document.createTextNode(" "));
        actions.appendChild(
          D.el("button", {
            type: "button",
            className: "btn btn--ghost",
            dataset: { bkX: String(b.id) },
            textContent: "Отмена",
          })
        );
      } else if (b.status === "confirmed") {
        actions.appendChild(
          D.el("button", {
            type: "button",
            className: "btn btn--primary",
            dataset: { sessStart: String(b.id) },
            textContent: "Начать сессию",
          })
        );
        actions.appendChild(document.createTextNode(" "));
        actions.appendChild(
          D.el("button", {
            type: "button",
            className: "btn btn--ghost",
            dataset: { bkX: String(b.id) },
            textContent: "Отмена",
          })
        );
      }

      t.tbody.appendChild(
        D.el("tr", {
          children: [
            D.el("td", { textContent: String(b.id) }),
            D.el("td", { textContent: String(b.customer_email || "") }),
            D.el("td", { textContent: String(b.simulator_code || "") }),
            D.el("td", { textContent: String(b.slot_start || "") }),
            D.el("td", { textContent: String(b.duration_minutes) }),
            D.el("td", { textContent: statusRu(b.status) }),
            actions,
          ],
        })
      );
    });

    D.setContent(wrap, t.wrap);

    wrap.onclick = function (ev) {
      var tBtn = ev.target.closest("button");
      if (!tBtn || !wrap.contains(tBtn)) return;
      var ok = tBtn.getAttribute("data-bk-ok");
      var cx = tBtn.getAttribute("data-bk-x");
      var st = tBtn.getAttribute("data-sess-start");
      if (ok) {
        return patchBooking(ok, "confirmed");
      }
      if (cx) {
        return patchBooking(cx, "cancelled");
      }
      if (st) {
        return window.autosimApi
          .fetchJson("/api/sessions/start", {
            method: "POST",
            body: { bookingId: Number(st) },
          })
          .then(function () {
            return loadPortal();
          })
          .catch(function (e) {
            alert(e.message);
          });
      }
    };
  }

  function renderSessionsAdmin(sessions) {
    var wrap = document.getElementById("admin-sessions-body");
    if (!wrap) return;
    if (!sessions || !sessions.length) {
      D.setContent(
        wrap,
        D.el("p", { className: "muted", textContent: "Нет активных сессий." })
      );
      return;
    }

    var t = D.tableShell([
      "ID",
      "Бронь",
      "Клиент",
      "Стенд",
      "План",
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
            D.el("td", { textContent: String(s.planned_end_at || "") }),
            D.el("td", {
              children: [
                D.el("button", {
                  type: "button",
                  className: "btn btn--primary",
                  dataset: { endS: String(s.id) },
                  textContent: "Завершить",
                }),
              ],
            }),
          ],
        })
      );
    });

    D.setContent(wrap, t.wrap);

    wrap.querySelectorAll("[data-end-s]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var sid = btn.getAttribute("data-end-s");
        window.autosimApi
          .fetchJson("/api/sessions/" + sid + "/end", { method: "POST" })
          .then(function (r) {
            alert("Бонусы начислены: " + (r.bonusPointsAwarded || 0));
            return loadPortal();
          })
          .catch(function (e) {
            alert(e.message);
          });
      });
    });
  }

  function defaultRange() {
    var to = new Date();
    var from = new Date(to.getTime() - 30 * 24 * 60 * 60 * 1000);
    return {
      from: from.toISOString().slice(0, 10),
      to: to.toISOString().slice(0, 10),
    };
  }

  function buildReportSummaryNode(data) {
    var sf = data.sessionsFinished || {};
    var p = D.el("p");
    p.appendChild(D.el("strong", { textContent: "Завершённых сессий:" }));
    p.appendChild(document.createTextNode(" " + String(sf.cnt || 0) + " · "));
    p.appendChild(D.el("strong", { textContent: "минут:" }));
    p.appendChild(document.createTextNode(" " + String(sf.minutes_sum || 0) + " · "));
    p.appendChild(D.el("strong", { textContent: "бонусов выдано:" }));
    p.appendChild(document.createTextNode(" " + String(sf.bonus_sum || 0) + " · "));
    p.appendChild(D.el("strong", { textContent: "выручка (оценка):" }));
    p.appendChild(
      document.createTextNode(" " + String(data.totalRevenueRub || 0) + " ₽")
    );
    return p;
  }

  function loadReportsCharts(data) {
    if (typeof Chart === "undefined") return;
    var elB = document.getElementById("chart-bookings");
    var elR = document.getElementById("chart-revenue");
    if (!elB || !elR) return;

    var labelsB = (data.bookingsByStatus || []).map(function (x) {
      return statusRu(x.status);
    });
    var valsB = (data.bookingsByStatus || []).map(function (x) {
      return x.cnt;
    });
    if (!labelsB.length) {
      labelsB = ["Нет данных"];
      valsB = [0];
    }

    if (chartBookings) chartBookings.destroy();
    chartBookings = new Chart(elB, {
      type: "doughnut",
      data: {
        labels: labelsB,
        datasets: [{ data: valsB, backgroundColor: ["#52525b", "#e30613", "#a3a3a3", "#22c55e"] }],
      },
      options: { plugins: { legend: { labels: { color: "#e4e4e7" } } } },
    });

    var labelsR = (data.revenueBySimulatorType || []).map(function (x) {
      return x.type;
    });
    var valsR = (data.revenueBySimulatorType || []).map(function (x) {
      return Number(x.revenue_rub || 0);
    });
    if (!labelsR.length) {
      labelsR = ["—"];
      valsR = [0];
    }

    if (chartRevenue) chartRevenue.destroy();
    chartRevenue = new Chart(elR, {
      type: "bar",
      data: {
        labels: labelsR,
        datasets: [
          {
            label: "Выручка ₽",
            data: valsR,
            backgroundColor: "rgba(227, 6, 19, 0.65)",
          },
        ],
      },
      options: {
        scales: {
          x: { ticks: { color: "#a3a3a3" } },
          y: { ticks: { color: "#a3a3a3" } },
        },
        plugins: { legend: { labels: { color: "#e4e4e7" } } },
      },
    });

    var sum = document.getElementById("admin-report-summary");
    if (sum) D.setContent(sum, buildReportSummaryNode(data));
  }

  function loadReports() {
    var r = defaultRange();
    var fromEl = document.getElementById("rep-from");
    var toEl = document.getElementById("rep-to");
    if (fromEl && !fromEl.value) fromEl.value = r.from;
    if (toEl && !toEl.value) toEl.value = r.to;
    var from = (fromEl && fromEl.value) || r.from;
    var to = (toEl && toEl.value) || r.to;
    var q =
      "/api/admin/reports?from=" +
      encodeURIComponent(from) +
      "&to=" +
      encodeURIComponent(to);
    return window.autosimApi.fetchJson(q).then(function (data) {
      loadReportsCharts(data);
    });
  }

  function loadPortal() {
    return Promise.all([
      window.autosimApi.fetchJson("/api/bookings"),
      window.autosimApi.fetchJson("/api/sessions/active"),
    ]).then(function (arr) {
      renderBookingsAdmin(arr[0].bookings || []);
      renderSessionsAdmin(arr[1].sessions || []);
    });
  }

  function load() {
    return window.autosimApi
      .fetchJson("/api/users")
      .then(function (data) {
        gate.style.display = "none";
        document.getElementById("admin-panel").hidden = false;
        renderUsers(data.users || []);
        return loadPortal().then(function () {
          return Promise.all([loadReports(), loadSimulators()]);
        });
      })
      .catch(function (err) {
        gate.style.display = "block";
        var p = D.el("p", { className: "form-msg form-msg--error" });
        p.appendChild(
          document.createTextNode((err.message || "Не удалось загрузить список") + ". ")
        );
        p.appendChild(D.link("login.html", "Войти снова"));
        D.setContent(gate, p);
        document.getElementById("admin-panel").hidden = true;
      });
  }

  window.autosimApi.fetchJson("/api/auth/me").then(function (data) {
    if (!data.user) {
      var p1 = D.el("p", { className: "form-msg form-msg--error" });
      p1.appendChild(document.createTextNode("Сначала "));
      p1.appendChild(D.link("login.html", "войдите"));
      p1.appendChild(document.createTextNode(" как администратор."));
      D.setContent(gate, p1);
      return;
    }
    if (data.user.role !== "admin") {
      var p2 = D.el("p", { className: "form-msg form-msg--error" });
      p2.appendChild(document.createTextNode("Нужны права администратора. "));
      p2.appendChild(D.link("login.html", "Войти другим пользователем"));
      D.setContent(gate, p2);
      return;
    }
    return load();
  });

  if (form) {
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      formMsg.textContent = "";
      formMsg.className = "form-msg";

      var fd = new FormData(form);
      window.autosimApi
        .fetchJson("/api/users", {
          method: "POST",
          body: {
            email: String(fd.get("email") || "").trim(),
            password: String(fd.get("password") || ""),
            role: String(fd.get("role") || "employee"),
            displayName: String(fd.get("displayName") || "").trim() || null,
          },
        })
        .then(function () {
          formMsg.textContent = "Пользователь создан";
          formMsg.className = "form-msg form-msg--ok";
          form.reset();
          return load();
        })
        .catch(function (err) {
          formMsg.textContent = err.message || "Ошибка";
          formMsg.className = "form-msg form-msg--error";
        });
    });
  }

  if (simForm) {
    simForm.addEventListener("submit", function (e) {
      e.preventDefault();
      if (simFormMsg) {
        simFormMsg.textContent = "";
        simFormMsg.className = "form-msg studio-form__full";
      }

      var fd = new FormData(simForm);
      var rateRaw = fd.get("hourlyRateRub");
      var rate = parseInt(String(rateRaw), 10);

      window.autosimApi
        .fetchJson("/api/simulators", {
          method: "POST",
          body: {
            code: String(fd.get("code") || "").trim(),
            name: String(fd.get("name") || "").trim(),
            type: String(fd.get("type") || "standart"),
            hourlyRateRub: rate,
            status: String(fd.get("status") || "ready"),
          },
        })
        .then(function () {
          if (simFormMsg) {
            simFormMsg.textContent = "Стенд добавлен";
            simFormMsg.className = "form-msg form-msg--ok studio-form__full";
          }
          simForm.reset();
          var rateEl = document.getElementById("s-rate");
          if (rateEl) rateEl.value = "350";
          var statusEl = document.getElementById("s-status");
          if (statusEl) statusEl.value = "ready";
          return loadSimulators();
        })
        .catch(function (err) {
          if (simFormMsg) {
            simFormMsg.textContent = err.message || "Ошибка";
            simFormMsg.className = "form-msg form-msg--error studio-form__full";
          }
        });
    });
  }

  var btnLogout = document.getElementById("btn-logout");
  if (btnLogout) {
    btnLogout.addEventListener("click", function () {
      window.autosimApi
        .fetchJson("/api/auth/logout", { method: "POST" })
        .then(function () {
          window.location.href = "index.html";
        });
    });
  }

  document.addEventListener("click", function (ev) {
    if (ev.target && ev.target.id === "btn-rep-load") {
      loadReports().catch(function (e) {
        alert(e.message);
      });
    }
    if (ev.target && ev.target.id === "btn-rep-csv") {
      var from = document.getElementById("rep-from").value;
      var to = document.getElementById("rep-to").value;
      var path =
        "/api/admin/reports/export.csv?from=" +
        encodeURIComponent(from) +
        "&to=" +
        encodeURIComponent(to);
      window.autosimApi.fetchBlob(path).then(function (blob) {
        var a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = "autosim-report.csv";
        a.click();
        URL.revokeObjectURL(a.href);
      });
    }
  });
})();
