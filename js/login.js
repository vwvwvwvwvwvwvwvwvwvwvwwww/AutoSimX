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
