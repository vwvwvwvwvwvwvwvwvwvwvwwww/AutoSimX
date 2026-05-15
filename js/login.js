(function () {
  "use strict";

  function normalizeEmail(str) {
    return String(str || "")
      .replace(/[\u200B-\u200D\uFEFF]/g, "")
      .trim()
      .toLowerCase();
  }

  function normalizePassword(str) {
    return String(str || "")
      .replace(/[\u200B-\u200D\uFEFF]/g, "")
      .trim()
      .replace(/\u2013/g, "-")
      .replace(/\u2014/g, "-")
      .replace(/\u2212/g, "-");
  }

  var form = document.getElementById("form-login");
  var msg = document.getElementById("form-msg");
  if (!form || !window.autosimApi) return;

  var emailInput = document.getElementById("email");
  var passwordInput = document.getElementById("password");

  var fills = {
    admin: { email: "admin@autosim.local", password: "admin-change-me" },
    employee: { email: "employee@autosim.local", password: "EmployeeDemo1" },
    customer: { email: "customer@autosim.local", password: "CustomerDemo1" },
  };

  form.querySelectorAll("[data-fill]").forEach(function (btn) {
    btn.addEventListener("click", function () {
      var key = btn.getAttribute("data-fill");
      var v = fills[key];
      if (!v || !emailInput || !passwordInput) return;
      emailInput.value = v.email;
      passwordInput.value = v.password;
      msg.textContent = "";
      msg.className = "form-msg";
    });
  });

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    msg.textContent = "";
    msg.className = "form-msg";

    var fd = new FormData(form);
    var email = normalizeEmail(fd.get("email"));
    var password = normalizePassword(fd.get("password"));

    window.autosimApi
      .fetchJson("/api/auth/login", {
        method: "POST",
        body: { email: email, password: password },
      })
      .then(function (data) {
        var role = data.user && data.user.role;
        if (role === "admin") window.location.href = "admin.html";
        else if (role === "employee") window.location.href = "employee.html";
        else window.location.href = "customer.html";
      })
      .catch(function (err) {
        msg.textContent = err.message || "Ошибка входа";
        msg.className = "form-msg form-msg--error";
      });
  });
})();



if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 16) {
  console.warn('[WARNING] JWT_SECRET is weak or missing!');
}

