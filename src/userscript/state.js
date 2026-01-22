(function () {
  "use strict";

  const GG = (window.GhostGuessr = window.GhostGuessr || {});

  GG.UPDATE_CHECK_URL = "https://raw.githubusercontent.com/JojocraftTv/GhostGuessr/main/dist/ghostguessr-core.user.js";
  GG.GITHUB_URL = "https://github.com/JojocraftTv/GhostGuessr";

  GG.hasGMStorage =
    typeof GM_getValue === "function" && typeof GM_setValue === "function";
  
  GG.isSteam = (function() {
    try {
      if (window.location.pathname.includes('/steam')) {
        return true;
      }
      if (window.self !== window.top) {
        try {
          const gameIframe = window.parent.document.getElementById('game-iframe');
          if (gameIframe && gameIframe.src && gameIframe.src.includes('/steam')) {
            return true;
          }
        } catch (e) {
          if (document.referrer.includes('/steam')) {
            return true;
          }
        }
      }
      return false;
    } catch (e) {
      return false;
    }
  })();
  
  GG.isElectron = GG.isSteam;

  GG.DEFAULT_SETTINGS = {
    enabled: false,
    markerColor: "#FF0000",
    outlineColor: "#FFFFFF",
    opacity: 0.7,
    outlineWidth: 2,
    size: 10,
    hotkey: "1",
    autoClaimRewards: true,
    streamerMode: false,
    showScorePredictor: true,
    dailyShopNextClaimAt: null,
    lastClaimedLevel: null,
    scorePredictorDisplay: "both",
    showConnectionLine: false,
    showStreetviewMarker: false,
    streetviewMarkerColor: "#3B82F6",
    streetviewMarkerOutline: "#FFFFFF",
    streetviewMarkerSize: 6,
    streetviewMarkerOutlineWidth: 2,
    streetviewMarkerOpacity: 0.7,
  };

  GG.coords = { lat: 0, lng: 0 };
  GG.initialCoords = { lat: 0, lng: 0 };
  GG.marker = null;
  GG.streetviewMarker = null;
  GG.connectionLine = null;
  GG.currentRoundId = null;
  GG.currentRoundNumber = 0;
  GG.settings = { ...GG.DEFAULT_SETTINGS };
  GG.gmap = null;
  GG.toggleButton = null;
  GG.buttonCreated = false;
  GG.hotkeyInput = null;
  GG.markerRetryId = null;
  GG.lastMapUpdate = 0;
  GG.settingsLoaded = false;
})();
