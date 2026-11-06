(() => {
  "use strict";

  const btnInstall = document.getElementById("btn-install");
  const btnDownload = document.getElementById("btn-download");
  const installHint = document.getElementById("install-hint");
  const isAndroid = /Android/i.test(navigator.userAgent);
  const isStandalone =
    window.matchMedia("(display-mode: standalone)").matches ||
    window.navigator.standalone === true;

  let deferredPrompt = null;

  function setHint(text) {
    if (installHint) installHint.textContent = text;
  }

  function showInstallReady() {
    if (!btnInstall) return;
    btnInstall.hidden = false;
    btnInstall.textContent = isAndroid
      ? "INSTALLER SUR ANDROID"
      : "INSTALLER L’APP";
    setHint(
      isAndroid
        ? "Ajoute FRENCH WAR à l’écran d’accueil — jouable hors-ligne"
        : "Installe l’app pour y revenir hors-ligne"
    );
  }

  function showManualAndroidHelp() {
    if (!btnInstall) return;
    btnInstall.hidden = false;
    btnInstall.textContent = "COMMENT INSTALLER";
    setHint("Chrome · ⋮ · Installer l’application (ou Ajouter à l’écran d’accueil)");
  }

  if (isStandalone) {
    if (btnInstall) btnInstall.hidden = true;
    if (btnDownload) btnDownload.hidden = true;
    setHint("App installée — mode hors-ligne actif");
  } else if (isAndroid) {
    // Sur Android le .html téléchargé s’ouvre mal : prioriser l’install PWA
    if (btnDownload) btnDownload.hidden = true;
    showManualAndroidHelp();
  }

  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    deferredPrompt = event;
    showInstallReady();
  });

  window.addEventListener("appinstalled", () => {
    deferredPrompt = null;
    if (btnInstall) btnInstall.hidden = true;
    if (btnDownload) btnDownload.hidden = true;
    setHint("Installé sur l’appareil — lance depuis l’icône FRENCH WAR");
  });

  if (btnInstall) {
    btnInstall.addEventListener("click", async () => {
      if (deferredPrompt) {
        deferredPrompt.prompt();
        try {
          await deferredPrompt.userChoice;
        } catch (_) {
          /* ignore */
        }
        deferredPrompt = null;
        return;
      }
      // Aide manuelle Android / navigateurs sans prompt
      const help = document.getElementById("screen-install-help");
      if (help) {
        help.classList.remove("hidden");
      } else {
        setHint(
          isAndroid
            ? "Chrome · ⋮ · Installer l’application"
            : "Menu du navigateur → Installer / Ajouter à l’écran d’accueil"
        );
      }
    });
  }

  const btnCloseHelp = document.getElementById("btn-close-install-help");
  if (btnCloseHelp) {
    btnCloseHelp.addEventListener("click", () => {
      const help = document.getElementById("screen-install-help");
      if (help) help.classList.add("hidden");
    });
  }

  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("./sw.js").catch(() => {});
    });
  }
})();
