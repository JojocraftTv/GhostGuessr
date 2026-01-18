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
      if (
        typeof GG.settings.autoClaimRewards !== "boolean" &&
        typeof saved.autoClaimDailyShop === "boolean"
      ) {
        GG.settings.autoClaimRewards = saved.autoClaimDailyShop;
      }
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

  GG.tryDailyShopClaim = function () {
    if (!GG.settings || !GG.settings.autoClaimRewards) return;
    if (GG.dailyShopClaimedThisSession) return;
    if (GG.settings.dailyShopNextClaimAt) {
      const nextClaimMs = Date.parse(GG.settings.dailyShopNextClaimAt);
      if (!Number.isNaN(nextClaimMs) && Date.now() < nextClaimMs) {
        return;
      }
    }
    GG.dailyShopClaimedThisSession = true;
    fetch("https://www.geoguessr.com/api/v4/webshop/daily-shop-claim", {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
      },
      body: "{}",
    })
      .then((response) => response.json())
      .then((data) => {
        if (data && data.nextPossibleClaim) {
          GG.settings.dailyShopNextClaimAt = data.nextPossibleClaim;
          GG.saveSettings();
        }
      })
      .catch(() => {});
  };

  GG.tryLevelClaim = function () {
    if (!GG.settings || !GG.settings.autoClaimRewards) return;
    if (GG.levelClaimedThisSession) return;
    GG.levelClaimedThisSession = true;
    fetch("https://www.geoguessr.com/api/v3/profiles/", {
      credentials: "include",
    })
      .then((response) => response.json())
      .then((data) => {
        const user = data && data.user;
        const progress = user && user.progress;
        if (!user || !progress) return;
        const lastClaimed = Number(user.lastClaimedLevel);
        const currentLevel = Number(progress.level);
        if (
          Number.isNaN(lastClaimed) ||
          Number.isNaN(currentLevel) ||
          currentLevel <= lastClaimed
        ) {
          return;
        }
        const claims = [];
        for (let level = lastClaimed + 1; level <= currentLevel; level += 1) {
          claims.push(
            fetch(`https://www.geoguessr.com/api/v4/level/claim/${level}`, {
              method: "POST",
              credentials: "include",
              headers: {
                "Content-Type": "application/json",
              },
              body: "{}",
            })
              .then(() => {
                GG.settings.lastClaimedLevel = level;
                GG.saveSettings();
              })
              .catch(() => {}),
          );
        }
        return Promise.all(claims);
      })
      .catch(() => {});
  };

  GG.tryRewardClaims = function () {
    GG.tryDailyShopClaim();
    GG.tryLevelClaim();
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
