/**
 * Базовый URL API (если фронт отдаётся не с того же хоста).
 * По умолчанию пустая строка — запросы на тот же origin.
 */
window.AUTOSIM_API_BASE = window.AUTOSIM_API_BASE || "";

function apiUrl(path) {
  var base = window.AUTOSIM_API_BASE || "";
  if (!path.startsWith("/")) path = "/" + path;
  return base + path;
}

function readJsonSafe(text) {
  try {
    return JSON.parse(text);
  } catch {
    return { error: text || "Ошибка ответа" };
  }
}

window.autosimApi = {
  /** GET бинарные ответы (например CSV). */
  fetchBlob: function (path) {
    return fetch(apiUrl(path), { credentials: "include" }).then(function (res) {
      return res.blob().then(function (blob) {
        if (!res.ok) {
          return blob.text().then(function (t) {
            throw new Error(t || res.statusText || "Ошибка");
          });
        }
        return blob;
      });
    });
  },
  fetchJson: function (path, options) {
    options = options || {};
    var headers = Object.assign(
      { Accept: "application/json" },
      options.headers || {}
    );
    if (options.body && typeof options.body === "object" && !(options.body instanceof FormData)) {
      headers["Content-Type"] = "application/json";
      options.body = JSON.stringify(options.body);
    }
    return fetch(apiUrl(path), {
      credentials: "include",
      method: options.method || "GET",
      headers: headers,
      body: options.body,
    }).then(function (res) {
      return res.text().then(function (text) {
        var data = text ? readJsonSafe(text) : {};
        if (!res.ok) {
          var msgErr = data.error || res.statusText || "Ошибка";
          if (
            typeof text === "string" &&
            text.trim().charAt(0) === "<" &&
            (res.status === 404 || res.status === 405)
          ) {
            msgErr =
              "API не найден по этому адресу. Откройте страницу с того же хоста и порта, где запущен сервер (например http://localhost:3888/login.html), а не через «Открыть файл» или другой порт.";
          }
          var err = new Error(msgErr);
          err.status = res.status;
          err.data = data;
          throw err;
        }
        return data;
      });
    });
  },
};
