(function () {
  var deferred = null;
  var btn = document.getElementById("btn-install-pwa");
  window.addEventListener("beforeinstallprompt", function (e) {
    e.preventDefault();
    deferred = e;
    if (btn) btn.style.display = "inline-flex";
  });
  if (btn) {
    btn.addEventListener("click", async function () {
      if (deferred) {
        deferred.prompt();
        await deferred.userChoice;
        deferred = null;
        return;
      }
      window.alert("Sur Android Chrome : menu ⋮ → « Ajouter à l’écran d’accueil » / « Installer l’application ».");
    });
  }
})();
