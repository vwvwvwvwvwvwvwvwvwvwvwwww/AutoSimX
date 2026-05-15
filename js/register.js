(function () {
  "use strict";

  var form = document.getElementById("form-register");
  var msg = document.getElementById("form-msg");
  if (!form || !window.autosimApi) return;

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    msg.textContent = "";
    msg.className = "form-msg";

    var fd = new FormData(form);
    var email = String(fd.get("email") || "").trim();
    var password = String(fd.get("password") || "");
    var displayName = String(fd.get("displayName") || "").trim();

    window.autosimApi
      .fetchJson("/api/auth/register", {
        method: "POST",
        body: { email: email, password: password, displayName: displayName || null },
      })
      .then(function () {
        window.location.href = "customer.html";
      })
      .catch(function (err) {
        msg.textContent = err.message || "Ошибка регистрации";
        msg.className = "form-msg form-msg--error";
      });
  });
})();
