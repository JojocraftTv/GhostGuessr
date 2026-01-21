(function () {
  "use strict";

  const GG = window.GhostGuessr;

  if (!GG.isSteam) {
    return;
  }

  const UPDATE_CHECK_INTERVAL = 24 * 60 * 60 * 1000;
  const STORAGE_KEY_LAST_CHECK = "gg_last_update_check";
  const STORAGE_KEY_DISMISSED_HASH = "gg_dismissed_update_hash";
  const STORAGE_KEY_CURRENT_HASH = "gg_current_script_hash";

  async function calculateHash(text) {
    const encoder = new TextEncoder();
    const data = encoder.encode(text);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }

  function shouldCheckForUpdates() {
    try {
      const lastCheck = localStorage.getItem(STORAGE_KEY_LAST_CHECK);
      if (!lastCheck) return true;
      
      const lastCheckTime = parseInt(lastCheck);
      return Date.now() - lastCheckTime > UPDATE_CHECK_INTERVAL;
    } catch (e) {
      return true;
    }
  }

  function updateLastCheckTime() {
    try {
      localStorage.setItem(STORAGE_KEY_LAST_CHECK, Date.now().toString());
    } catch (e) {
    }
  }

  function getCurrentHash() {
    try {
      return localStorage.getItem(STORAGE_KEY_CURRENT_HASH);
    } catch (e) {
      return null;
    }
  }

  function setCurrentHash(hash) {
    try {
      localStorage.setItem(STORAGE_KEY_CURRENT_HASH, hash);
    } catch (e) {
    }
  }

  function isDismissed(hash) {
    try {
      const dismissed = localStorage.getItem(STORAGE_KEY_DISMISSED_HASH);
      return dismissed === hash;
    } catch (e) {
      return false;
    }
  }

  GG.dismissUpdate = function(hash) {
    try {
      localStorage.setItem(STORAGE_KEY_DISMISSED_HASH, hash);
      const banner = document.getElementById('gg-update-banner');
      if (banner) {
        banner.remove();
      }
    } catch (e) {
    }
  };

  async function checkForUpdates() {
    if (!shouldCheckForUpdates()) {
      return;
    }

    try {
      const response = await fetch(GG.UPDATE_CHECK_URL, {
        cache: 'no-cache'
      });
      
      if (!response.ok) {
        updateLastCheckTime();
        return;
      }
      
      const scriptContent = await response.text();
      const remoteHash = await calculateHash(scriptContent);
      const currentHash = getCurrentHash();
      
      updateLastCheckTime();
      
      if (!currentHash) {
        setCurrentHash(remoteHash);
        return;
      }
      
      if (remoteHash !== currentHash) {
        if (typeof GG.showUpdateNotification === 'function') {
          GG.showUpdateNotification(remoteHash);
        }
      }
    } catch (error) {
      updateLastCheckTime();
    }
  }

  GG.updateScriptHash = function(hash) {
    setCurrentHash(hash);
  };

  setTimeout(() => {
    checkForUpdates();
  }, 5000);

  console.log("[GG Updater] Hash-based update checker initialized");
})();
