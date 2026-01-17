(function () {
  "use strict";

  const GG = window.GhostGuessr;
  const hasGMStorage =
    typeof GM_getValue === "function" && typeof GM_setValue === "function";

  const normalizeOpacity = (value) => {
    if (typeof value !== "number" || Number.isNaN(value)) return 0.7;
    if (value > 1) {
      return value > 100 ? 1 : value / 100;
    }
    return value < 0 ? 0 : value;
  };

  const loadLocalSettings = () => {
    try {
      const rawValue = window.localStorage.getItem("ghostguessr_settings");
      return rawValue ? JSON.parse(rawValue) : null;
    } catch {
      return null;
    }
  };

  const saveLocalSettings = (value) => {
    try {
      window.localStorage.setItem("ghostguessr_settings", JSON.stringify(value));
    } catch {}
  };

  GG.loadSettings = function () {
    let saved = null;
    if (hasGMStorage) {
      try {
        saved = GM_getValue("ghostguessr_settings");
      } catch {}
    } else {
      saved = loadLocalSettings();
    }
    if (saved) {
      GG.settings = { ...GG.DEFAULT_SETTINGS, ...saved };
    } else {
      GG.settings = { ...GG.DEFAULT_SETTINGS };
    }
    GG.settings.opacity = normalizeOpacity(GG.settings.opacity);
    GG.settingsLoaded = true;
  };

  GG.saveSettings = function () {
    if (hasGMStorage) {
      try {
        GM_setValue("ghostguessr_settings", GG.settings);
      } catch {}
    } else {
      saveLocalSettings(GG.settings);
    }
    if (GG.marker && GG.settings.enabled) {
      GG.updateMarkerStyle();
    }
  };

  GG.handleHotkey = function (event) {
    if (
      event.key.toLowerCase() === GG.settings.hotkey.toLowerCase() &&
      !event.ctrlKey &&
      !event.altKey &&
      !event.metaKey
    ) {
      event.stopPropagation();
      event.preventDefault();
      GG.toggleMarker();
      if (GG.toggleButton) GG.updateButtonState();
    }
  };

  GG.setupHotkeyListener = function () {
    document.removeEventListener("keydown", GG.handleHotkey, true);
    document.addEventListener("keydown", GG.handleHotkey, true);
  };

  if (!GG.settingsLoaded) {
    GG.loadSettings();
  }
})();
