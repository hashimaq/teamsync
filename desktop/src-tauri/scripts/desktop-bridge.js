(function () {
  if (window.__TEAMSYNC_DESKTOP__) return;
  window.__TEAMSYNC_DESKTOP__ = true;

  function banner(text, kind) {
    var id = "teamsync-desktop-banner";
    var el = document.getElementById(id);
    if (!el) {
      el = document.createElement("div");
      el.id = id;
      el.setAttribute("role", "status");
      el.style.cssText = [
        "position:fixed",
        "left:0",
        "right:0",
        "top:0",
        "z-index:2147483647",
        "padding:10px 16px",
        "font:600 13px/1.4 system-ui,sans-serif",
        "text-align:center",
        "letter-spacing:0.01em",
        "transition:transform .2s ease",
        "transform:translateY(-120%)",
        "pointer-events:none",
      ].join(";");
      document.documentElement.appendChild(el);
    }
    el.textContent = text;
    if (kind === "offline") {
      el.style.background = "#0f172a";
      el.style.color = "#f8fafc";
    } else if (kind === "online") {
      el.style.background = "#059669";
      el.style.color = "#ecfdf5";
    } else {
      el.style.background = "#1d4ed8";
      el.style.color = "#eff6ff";
    }
    el.style.transform = "translateY(0)";
    if (kind !== "offline") {
      clearTimeout(el.__hide);
      el.__hide = setTimeout(function () {
        el.style.transform = "translateY(-120%)";
      }, 2800);
    }
  }

  function setOnline(online) {
    if (online) {
      banner("Back online — reconnecting TeamSync…", "online");
    } else {
      banner(
        "You're offline. Changes will sync when the connection returns.",
        "offline"
      );
    }
  }

  window.addEventListener("offline", function () {
    setOnline(false);
  });
  window.addEventListener("online", function () {
    setOnline(true);
  });
  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    setOnline(false);
  }

  window.addEventListener("teamsync-desktop-shortcut", function (event) {
    var detail = (event && event.detail) || {};
    if (detail.action === "search") {
      banner("Quick search (Ctrl+K) — command palette placeholder", "info");
      return;
    }
    if (detail.action === "new-task") {
      banner(
        "New task (Ctrl+N) — open a workspace Tasks panel to create tasks",
        "info"
      );
    }
  });

  document.documentElement.dataset.teamsyncDesktop = "1";
})();
