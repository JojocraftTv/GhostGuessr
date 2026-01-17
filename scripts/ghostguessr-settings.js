(function () {
  "use strict";

  const GG = window.GhostGuessr;

  GG.loadSettings = function () {
    const saved = GM_getValue("ghostguessr_settings");
    if (saved) {
      GG.settings = { ...GG.DEFAULT_SETTINGS, ...saved };
    } else {
      GG.settings = { ...GG.DEFAULT_SETTINGS };
    }
    GG.settingsLoaded = true;
  };

  GG.saveSettings = function () {
    GM_setValue("ghostguessr_settings", GG.settings);
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
