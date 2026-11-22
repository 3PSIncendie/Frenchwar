(function () {
  var BUILD_KEY = "ombre-du-dojo-build";

  async function checkUpdates() {
    try {
      var res = await fetch("version.json?t=" + Date.now(), { cache: "no-store" });
      if (!res.ok) return;
      var remote = await res.json();
      var local = localStorage.getItem(BUILD_KEY);
      if (remote && remote.build) {
        if (local && local !== remote.build) {
          localStorage.setItem(BUILD_KEY, remote.build);
          location.reload();
          return;
        }
        localStorage.setItem(BUILD_KEY, remote.build);
      }
    } catch (_) {}
  }

  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("./sw.js").catch(function () {});
    navigator.serviceWorker.getRegistration().then(function (reg) {
      if (reg) reg.update();
    });
  }

  window.__ombreInstallPrompt = null;
  window.addEventListener("beforeinstallprompt", function (e) {
    e.preventDefault();
    window.__ombreInstallPrompt = e;
  });

  document.addEventListener("visibilitychange", function () {
    if (document.visibilityState === "visible") checkUpdates();
  });
  window.addEventListener("pageshow", function () {
    checkUpdates();
  });
  checkUpdates();

  var css = document.querySelector('link[rel="stylesheet"][href^="style.css"]');
  if (css) css.href = "style.css?v=" + Date.now().toString(36);
  var s = document.createElement("script");
  s.src = "game.js?v=" + Date.now().toString(36);
  document.body.appendChild(s);
})();
