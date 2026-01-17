(function () {
  "use strict";

  const GG = window.GhostGuessr;

  GG.initialize = function () {
    GG.loadSettings();
    GG.setupHotkeyListener();

    const checkAndCreate = () => {
      if (!GG.buttonCreated && document.querySelector(".styles_columnTwo__kyT60")) {
        GG.createToggleButton();
      }
      if (GG.settings.enabled) {
        GG.ensureMarkerVisible();
      }

      const settingsContainer = document.querySelector(
        ".game-menu_settingsContainer__NeJu2",
      );
      if (settingsContainer && settingsContainer.offsetParent !== null) {
        GG.createGhostMarkerSettings();
      }
    };

    checkAndCreate();

    const observer = new MutationObserver(function () {
      const buttonContainerExists = document.querySelector(
        ".styles_columnTwo__kyT60",
      );
      const ourButtonExists = document.querySelector(
        '[data-qa="ghost-marker-toggle"]',
      );

      if (buttonContainerExists && !ourButtonExists) {
        setTimeout(() => {
          GG.buttonCreated = false;
          GG.toggleButton = null;
          GG.createToggleButton();
        }, 500);
      }
      if (GG.settings.enabled) {
        GG.ensureMarkerVisible();
      }

      const settingsContainer = document.querySelector(
        ".game-menu_settingsContainer__NeJu2",
      );
      if (settingsContainer && settingsContainer.offsetParent !== null) {
        GG.createGhostMarkerSettings();
      }
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
