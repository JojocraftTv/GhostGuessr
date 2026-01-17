(function () {
  "use strict";

  const GG = window.GhostGuessr;

  GG.initialize = function () {
    GG.loadSettings();
    GG.setupHotkeyListener();

    const checkAndCreate = () => {
      if (
        !GG.buttonCreated &&
        document.querySelector(".styles_columnTwo__kyT60")
      ) {
        GG.createToggleButton();
      }
      if (GG.settings.enabled) {
        GG.ensureMarkerVisible();
      }

      const settingsContainer = GG.getSettingsContainer
        ? GG.getSettingsContainer()
        : document.querySelector(".game-menu_settingsContainer__NeJu2");
      if (settingsContainer && settingsContainer.offsetParent !== null) {
        GG.createGhostMarkerSettings();
      }
    };

    let checkTimer = null;
    const scheduleCheck = () => {
      if (checkTimer) return;
      checkTimer = setTimeout(() => {
        checkTimer = null;
        checkAndCreate();
      }, 20);
    };

    checkAndCreate();

    const observer = new MutationObserver(function () {
      scheduleCheck();
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["style"],
    });
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", GG.initialize);
  } else {
    GG.initialize();
  }
})();
