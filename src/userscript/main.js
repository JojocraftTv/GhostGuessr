(function () {
  "use strict";

  const GG = window.GhostGuessr;

  GG.initialize = function () {
    GG.loadSettings();
    GG.setupHotkeyListener();
    if (typeof GG.tryRewardClaims === "function") {
      GG.tryRewardClaims();
    }

    const checkAndCreate = () => {
      if (typeof GG.createToggleButton === "function") {
        if (!document.querySelector('[data-qa="ghostguessr-toggle"]')) {
          GG.buttonCreated = false;
        }
        if (!GG.buttonCreated) {
          GG.createToggleButton();
        }
      }
      if (GG.settings.enabled) {
        GG.ensureMarkerVisible();
      }

      if (typeof GG.setupScorePredictorListeners === "function") {
        GG.setupScorePredictorListeners();
      }

      const settingsContainer = GG.getSettingsContainer
        ? GG.getSettingsContainer()
        : document.querySelector('[class*="game-menu_settingsContainer__"]');
      if (settingsContainer && settingsContainer.offsetParent !== null) {
        GG.createGhostMarkerSettings();
      }
    };

    const scheduleCheck = () => {
      checkAndCreate();
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
