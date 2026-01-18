(function () {
  "use strict";

  const GG = (window.GhostGuessr = window.GhostGuessr || {});

  GG.DEFAULT_SETTINGS = {
    enabled: false,
    markerColor: "#FF0000",
    outlineColor: "#FFFFFF",
    opacity: 0.7,
    outlineWidth: 2,
    size: 10,
    hotkey: "1",
    autoClaimRewards: true,
    dailyShopNextClaimAt: null,
    lastClaimedLevel: null,
  };

  GG.coords = { lat: 0, lng: 0 };
  GG.marker = null;
  GG.settings = { ...GG.DEFAULT_SETTINGS };
  GG.gmap = null;
  GG.toggleButton = null;
  GG.buttonCreated = false;
  GG.hotkeyInput = null;
  GG.markerRetryId = null;
  GG.settingsLoaded = false;
})();
