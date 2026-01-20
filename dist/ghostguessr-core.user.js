// ==UserScript==
// @name         GhostGuessr (Auto-Build Version)
// @namespace    https://github.com/JojocraftTv/GhostGuessr
// @version      Auto-Build Version
// @description  Marks your Current Streetview Location on the GeoGuessr Map with a Red Dot. Toggle with hotkey.
// @author       VellusFox, Niceas
// @match        https://www.geoguessr.com/*
// @run-at       document-start
// @inject-into  page
// @icon         https://raw.githubusercontent.com/JojocraftTv/GhostGuessr/refs/heads/main/icons/GhostGuessr.png
// @grant        GM_setValue
// @grant        GM_getValue
// @downloadURL  https://raw.githubusercontent.com/JojocraftTv/GhostGuessr/refs/heads/main/dist/ghostguessr-core.user.js
// @updateURL    https://raw.githubusercontent.com/JojocraftTv/GhostGuessr/refs/heads/main/dist/ghostguessr-core.user.js
// @license      MIT
// ==/UserScript==

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
  GG.settings = { ...GG.DEFAULT_SETTINGS };
  GG.gmap = null;
  GG.toggleButton = null;
  GG.buttonCreated = false;
  GG.hotkeyInput = null;
  GG.markerRetryId = null;
  GG.settingsLoaded = false;
})();



(function () {
  "use strict";

  const GG = window.GhostGuessr;

  GG.hexToRgba = function (hex, alpha) {
    let r = parseInt(hex.slice(1, 3), 16);
    let g = parseInt(hex.slice(3, 5), 16);
    let b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  };
})();


(() => {
  "use strict";

  if (window.GhostGuessr && window.GhostGuessr.isSteam) {
    console.log("[GG Skinchanger] Disabled in Electron/Steam environment");
    return;
  }

  const STORE_KEY = "gg_avatar_equippedIds_v1";
  const STORE_TOGGLE = "gg_local_save_only_v1";
  const MSG_SAVE = "GG_AVATAR_SAVE_EQUIPPED_IDS";
  const MSG_APPLY = "GG_AVATAR_APPLY_EQUIPPED_IDS";
  const MSG_TOGGLE = "GG_AVATAR_LOCAL_SAVE_ONLY";
  const MSG_HOOK_READY = "GG_AVATAR_HOOK_READY";

  const hasGMStorage =
    typeof GM_getValue === "function" && typeof GM_setValue === "function";

  function storageGet(key, fallback) {
    if (hasGMStorage) {
      try {
        return GM_getValue(key, fallback);
      } catch (e) {
        console.warn("[GG Skinchanger] GM_getValue failed:", e);
      }
    }
    try {
      const raw = window.localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (e) {
      console.warn("[GG Skinchanger] localStorage.getItem failed:", e);
      return fallback;
    }
  }

  function storageSet(key, value) {
    if (hasGMStorage) {
      try {
        GM_setValue(key, value);
        return;
      } catch (e) {
        console.warn("[GG Skinchanger] GM_setValue failed:", e);
      }
    }
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
    } catch (e) {
      console.warn("[GG Skinchanger] localStorage.setItem failed:", e);
    }
  }

  const saved = storageGet(STORE_KEY, null);
  console.log("[GG Skinchanger] Loaded saved data:", saved);
  console.log("[GG Skinchanger] Saved assets count:", saved && saved.equippedIds ? saved.equippedIds.length : 0);
  const initialEquipped =
    saved && Array.isArray(saved.equippedIds) ? saved.equippedIds : [];
  const initialLocalSaveOnly = storageGet(STORE_TOGGLE, true);

  let hookReady = false;
  let autoLoadTriggered = false;

  function sendEquippedToPage(ids) {
    window.postMessage({ type: MSG_APPLY, ids }, "*");
  }

  function autoLoadSavedAvatars() {
    if (!hookReady || autoLoadTriggered) return;
    
    const savedData = storageGet(STORE_KEY, null);
    if (savedData && Array.isArray(savedData.equippedIds) && savedData.equippedIds.length > 0) {
      console.log("[GG Skinchanger] Auto-loading saved avatars:", savedData.equippedIds);
      
      setTimeout(() => {
        sendEquippedToPage(savedData.equippedIds);
        autoLoadTriggered = true;
      }, 2000);
    }
  }

  window.addEventListener("message", (ev) => {
    try {
      if (!ev || !ev.data) return;
      if (ev.data.type === MSG_HOOK_READY) {
        hookReady = true;
        sendToggleToPage(initialLocalSaveOnly);
        autoLoadSavedAvatars();
        return;
      }
      if (ev.data.type === MSG_SAVE) {
        const ids = Array.isArray(ev.data.equippedIds)
          ? ev.data.equippedIds.filter((x) => typeof x === "string")
          : [];
        if (!ids.length) return;

        console.log("[GG Skinchanger] Saving equipped IDs:", ids);
        storageSet(STORE_KEY, { equippedIds: ids, savedAt: Date.now() });
        
        window.postMessage({ type: MSG_APPLY, equippedIds: ids }, "*");
        
        setTimeout(() => {
          sendEquippedToPage(ids);
        }, 100);
        return;
      }
    } catch (e) {}
  });

  function sendEquippedToPage(ids) {
    try {
      window.postMessage({ type: MSG_APPLY, equippedIds: ids }, "*");
    } catch {}
  }

  function sendToggleToPage(value) {
    try {
      window.postMessage({ type: MSG_TOGGLE, value: !!value }, "*");
    } catch {}
  }

  function injectHook() {
    const hookCode = `
          (() => {
        const MSG_SAVE = ${JSON.stringify(MSG_SAVE)};
        const MSG_APPLY = ${JSON.stringify(MSG_APPLY)};
        const MSG_TOGGLE = ${JSON.stringify(MSG_TOGGLE)};
        const MSG_HOOK_READY = ${JSON.stringify(MSG_HOOK_READY)};

        const SAVE_PATH = "/api/v4/avatar/save";
        const AVATAR_USER = "/api/v4/avatar/user";
        const AVATAR_USER_PREFIX = "/api/v4/avatar/user/";
        const CUSTOMIZATION = "/api/v4/customization";
        const SHOP_FEATURED = "/api/v4/webshop/featured-deals/world-championship";
        const SHOP_FEATURED_GENERIC = "/api/v4/webshop/featured-deals";
        const SHOP_CREATOR = "/api/v4/webshop/creator-shop/products";
        const SHOP_CONVEYOR = "/api/v4/webshop/conveyor-belt";
        const PROFILES = "/api/v3/profiles/";
        const RANKED_TEAMS_PREFIX = "/api/v4/ranked-team-duels/me/teams/";
        const ELITE_DAYS = "/api/v4/customization/elite-days";

        const initialEquipped = ${JSON.stringify(initialEquipped)};
        const initialLocalSaveOnly = ${JSON.stringify(initialLocalSaveOnly)};

        let savedEquippedIds = Array.isArray(initialEquipped)
          ? initialEquipped.filter((x) => typeof x === "string")
          : [];
        let localSaveOnly = !!initialLocalSaveOnly;
        let profileNick = null;
        let profileUserId = null;
        const assetsById = new Map();
        const originalFetch = window.fetch;
        let baseFetch = originalFetch;
        let wrappedFetch = null;
        let assetsReadyResolve = null;
        let assetsReadyPromise = null;

        window.addEventListener("message", (ev) => {
          try {
            if (!ev || !ev.data) return;
            if (ev.data.type === MSG_APPLY) {
              const ids = Array.isArray(ev.data.equippedIds)
                ? ev.data.equippedIds.filter((x) => typeof x === "string")
                : [];
              if (arraysEqual(savedEquippedIds, ids)) return;
              console.log('[GG Skinchanger Hook] Applying equipped IDs:', ids);
              savedEquippedIds = ids;
              return;
            }
            if (ev.data.type === MSG_TOGGLE) {
              localSaveOnly = !!ev.data.value;
              return;
            }
          } catch {}
        });

        function toPath(urlLike) {
          try {
            return new URL(String(urlLike), location.origin).pathname;
          } catch {
            return String(urlLike || "")
              .replace(location.origin, "")
              .split("?")[0];
          }
        }

        function isPath(urlLike, path) {
          const p = toPath(urlLike);
          return p === path || p === path + "/";
        }

        function isPrefix(urlLike, prefix) {
          const p = toPath(urlLike);
          return p.startsWith(prefix);
        }

        function isSavePath(urlLike) {
          return isPath(urlLike, SAVE_PATH) || isPrefix(urlLike, SAVE_PATH + "/");
        }

        function bustUrl(urlLike) {
          try {
            const u = new URL(String(urlLike), location.origin);
            u.searchParams.set("_gg", String(Date.now()));
            return u.toString();
          } catch {
            const s = String(urlLike || "");
            return s + (s.includes("?") ? "&" : "?") + "_gg=" + Date.now();
          }
        }

        function deepForceUnlockedTrue(value) {
          if (!value || typeof value !== "object") return value;
          if (Array.isArray(value)) {
            for (let i = 0; i < value.length; i++) {
              value[i] = deepForceUnlockedTrue(value[i]);
            }
            return value;
          }
          for (const k of Object.keys(value)) {
            if (k === "unlocked") value[k] = true;
            else value[k] = deepForceUnlockedTrue(value[k]);
          }
          return value;
        }

        function forceEliteOwnership(value) {
          if (!value || typeof value !== "object") return value;
          if (Array.isArray(value)) {
            for (let i = 0; i < value.length; i++) {
              value[i] = forceEliteOwnership(value[i]);
            }
            return value;
          }
          if (value.isEliteExclusive === true) value.isEliteExclusive = false;
          if (value.isOwned === false) value.isOwned = true;
          if (value.isInUserInventory === false) value.isInUserInventory = true;
          for (const k of Object.keys(value)) {
            value[k] = forceEliteOwnership(value[k]);
          }
          return value;
        }

        function forceEmptyRequirements(value) {
          if (!value || typeof value !== "object") return value;
          if (Array.isArray(value)) {
            for (let i = 0; i < value.length; i++) {
              value[i] = forceEmptyRequirements(value[i]);
            }
            return value;
          }
          if (Array.isArray(value.requirements)) value.requirements = [];
          for (const k of Object.keys(value)) {
            value[k] = forceEmptyRequirements(value[k]);
          }
          return value;
        }

        function getEquippedBorderUrl() {
          for (const id of savedEquippedIds) {
            const asset = assetsById.get(id);
            if (!asset) continue;
            if (asset.type === "DEFAULT_BORDER" || asset.slot === 22) {
              if (typeof asset.icon === "string" && asset.icon) return asset.icon;
            }
          }
          return null;
        }

        function forceEliteProfile(data, url) {
          if (!data || typeof data !== "object") return;
          if (!data.user || typeof data.user !== "object") data.user = {};

          if (isPath(url, PROFILES)) {
            if (typeof data.user.id === "string" && data.user.id) {
              profileUserId = data.user.id;
            }
            if (typeof data.user.nick === "string" && data.user.nick) {
              profileNick = data.user.nick;
            } else if (
              typeof data.user.userName === "string" &&
              data.user.userName
            ) {
              profileNick = data.user.userName;
            } else if (
              typeof data.user.username === "string" &&
              data.user.username
            ) {
              profileNick = data.user.username;
            }
          }

          if (profileUserId && data.user.id === profileUserId) {
            data.user.type = "Elite";
            const borderUrl = getEquippedBorderUrl();
            if (borderUrl) data.user.borderUrl = borderUrl;
          }
        }

        function forceEliteDays() {
          return 999;
        }

        function applyRankedTeamBorder(data) {
          if (!data || typeof data !== "object") return;
          if (!data.team || !Array.isArray(data.team.members)) return;
          const borderUrl = getEquippedBorderUrl();
          if (!borderUrl) return;
          for (const member of data.team.members) {
            if (!member) continue;
            if (profileUserId && member.userId === profileUserId) {
              member.borderUrl = borderUrl;
              continue;
            }
            if (profileNick && member.nick === profileNick) {
              member.borderUrl = borderUrl;
            }
          }
        }

        function markAssetsReady() {
          if (assetsReadyResolve && haveAllSavedAssets()) {
            assetsReadyResolve(true);
            assetsReadyResolve = null;
          }
        }

        function arraysEqual(a, b) {
          if (a === b) return true;
          if (!Array.isArray(a) || !Array.isArray(b)) return false;
          if (a.length !== b.length) return false;
          for (let i = 0; i < a.length; i++) {
            if (a[i] !== b[i]) return false;
          }
          return true;
        }

        function filterSavedEquippedIds() {
          if (!Array.isArray(savedEquippedIds) || !savedEquippedIds.length) {
            return;
          }
          if (!assetsById.size) return;
          if (!haveAllSavedAssets()) return;
          const valid = savedEquippedIds.filter((id) => assetsById.has(id));
          if (arraysEqual(savedEquippedIds, valid)) return;
          console.log('[GG Skinchanger Hook] Filtering and saving equipped IDs:', valid);
          savedEquippedIds = valid;
          window.postMessage({ type: MSG_SAVE, equippedIds: valid }, "*");
        }

        let isRefreshing = false;
        let refreshDebounceTimer = null;

        function collectAssetsFromCustomization(data, filterSet) {
          try {
            const seen = new Set();
            let assetCount = 0;
            const MAX_ASSETS = 2000;

            function maybeStoreAsset(obj) {
              if (!obj || typeof obj !== "object") return;
              const id = obj.id;
              if (typeof id !== "string") return;
              if (filterSet && !filterSet.has(id)) return;
              const looksLikeAsset =
                typeof obj.slot === "number" ||
                typeof obj.meshGlb === "string" ||
                typeof obj.texture === "string" ||
                typeof obj.icon === "string";
              if (looksLikeAsset) {
                if (assetCount >= MAX_ASSETS) {
                  console.warn('[GG Skinchanger Hook] Asset limit reached, stopping collection');
                  return;
                }
                assetsById.set(id, obj);
                assetCount++;
              }
            }

            function walk(obj, depth = 0) {
              if (!obj || typeof obj !== "object") return;
              if (seen.has(obj)) return;
              if (seen.size > 50000) return;
              if (depth > 20) return;
              seen.add(obj);

              if (Array.isArray(obj)) {
                for (const item of obj) walk(item, depth + 1);
                return;
              }

              if (obj.asset) maybeStoreAsset(obj.asset);
              else maybeStoreAsset(obj);

              for (const key of Object.keys(obj)) {
                const value = obj[key];
                if (value && typeof value === "object") walk(value, depth + 1);
              }
            }

            walk(data);
            console.log('[GG Skinchanger Hook] Collected assets:', assetCount, 'Total in map:', assetsById.size);
            markAssetsReady();
            filterSavedEquippedIds();
          } catch (e) {
            console.error('[GG Skinchanger Hook] Error collecting assets:', e);
          }
        }

        function fetchOwnProfile() {
          try {
            return baseFetch(PROFILES, {
              method: "GET",
              headers: {
                accept: "*/*",
                "accept-language": "en-US,en;q=0.6",
                "content-type": "application/json",
                "x-client": "web",
                "cache-control": "no-cache",
                pragma: "no-cache",
              },
              mode: "cors",
              credentials: "include",
              cache: "reload",
            })
              .then((res) => res.json())
              .then((data) => {
                try {
                  const user = data && data.user;
                  if (!user) return;
                  if (typeof user.id === "string" && user.id) profileUserId = user.id;
                  if (typeof user.nick === "string" && user.nick) profileNick = user.nick;
                  else if (typeof user.userName === "string" && user.userName) profileNick = user.userName;
                  else if (typeof user.username === "string" && user.username) profileNick = user.username;
                } catch {}
              })
              .catch(() => {});
          } catch {
            return Promise.resolve();
          }
        }

        function getSavedIdSet() {
          return new Set(
            Array.isArray(savedEquippedIds)
              ? savedEquippedIds.filter((x) => typeof x === "string")
              : [],
          );
        }

        function haveAllSavedAssets() {
          if (!Array.isArray(savedEquippedIds) || !savedEquippedIds.length) {
            return false;
          }
          for (const id of savedEquippedIds) {
            if (!assetsById.has(id)) {
              return false;
            }
          }
          return true;
        }

        function ensureAssetsReady() {
          if (haveAllSavedAssets()) return Promise.resolve(true);
          if (!assetsReadyPromise) {
            assetsReadyPromise = new Promise((resolve) => {
              assetsReadyResolve = resolve;
            });
            baseFetch(CUSTOMIZATION, { credentials: "include" })
              .then(async (res) => {
                try {
                  const data = await res.clone().json();
                  deepForceUnlockedTrue(data);
                  const filterSet = localSaveOnly ? getSavedIdSet() : null;
                  collectAssetsFromCustomization(data, filterSet);
                } catch {}
              })
              .catch(() => {})
              .finally(() => {
                setTimeout(() => {
                  if (assetsReadyResolve) {
                    assetsReadyResolve(false);
                    assetsReadyResolve = null;
                  }
                }, 1500);
              });
          }
          return assetsReadyPromise;
        }

        function refreshShopData() {
          if (isRefreshing) {
            console.log('[GG Skinchanger Hook] refreshShopData skipped - already refreshing');
            return;
          }
          
          if (refreshDebounceTimer) {
            clearTimeout(refreshDebounceTimer);
          }
          
          refreshDebounceTimer = setTimeout(() => {
            refreshDebounceTimer = null;
            doRefreshShopData();
          }, 100);
        }

        function doRefreshShopData() {
          if (isRefreshing) {
            console.log('[GG Skinchanger Hook] doRefreshShopData skipped - already refreshing');
            return;
          }
          
          isRefreshing = true;
          const bust = "_gg=" + Date.now();
          const urls = [
            CUSTOMIZATION,
            SHOP_FEATURED,
            SHOP_FEATURED_GENERIC,
            SHOP_CREATOR,
            SHOP_CONVEYOR,
          ].map((u) => (u.includes("?") ? u + "&" + bust : u + "?" + bust));

          const headers = {
            accept: "*/*",
            "content-type": "application/json",
            "x-client": "web",
            "cache-control": "no-cache",
            pragma: "no-cache",
          };

          console.log('[GG Skinchanger Hook] refreshShopData starting, clearing assets. Current count:', assetsById.size);
          assetsById.clear();
          assetsReadyPromise = null;
          assetsReadyResolve = null;

          let completed = 0;
          const total = urls.length;

          for (const u of urls) {
            baseFetch(u, {
              method: "GET",
              headers,
              mode: "cors",
              credentials: "include",
              cache: "reload",
            })
              .then(async (res) => {
                try {
                  const data = await res.clone().json();
                  if (localSaveOnly) deepForceUnlockedTrue(data);
                  const filterSet = localSaveOnly ? getSavedIdSet() : null;
                  if (
                    toPath(u) === CUSTOMIZATION ||
                    toPath(u) === SHOP_FEATURED ||
                    toPath(u) === SHOP_FEATURED_GENERIC ||
                    toPath(u) === SHOP_CREATOR ||
                    toPath(u) === SHOP_CONVEYOR
                  ) {
                    collectAssetsFromCustomization(data, filterSet);
                  }
                } catch {}
              })
              .catch(() => {})
              .finally(() => {
                completed++;
                if (completed >= total) {
                  isRefreshing = false;
                  console.log('[GG Skinchanger Hook] refreshShopData completed');
                }
              });
          }
        }

        function refreshAvatarUser() {
          const url = AVATAR_USER;
          baseFetch(url, {
            method: "GET",
            headers: {
              accept: "*/*",
              "accept-language": "en-US,en;q=0.6",
              "content-type": "application/json",
              "x-client": "web",
              "cache-control": "no-cache",
              pragma: "no-cache",
            },
            mode: "cors",
            credentials: "include",
            cache: "reload",
          }).catch(() => {});
        }

        function buildAvatarPayload() {
          const equipped = [];
          for (const id of savedEquippedIds) {
            const asset = assetsById.get(id);
            if (asset) equipped.push(asset);
          }
          return { equipped, equippedBadge: null, borderUrl: getEquippedBorderUrl() };
        }

        function createJsonResponse(obj) {
          return new Response(JSON.stringify(obj), {
            status: 200,
            headers: {
              "content-type": "application/json; charset=utf-8",
              "cache-control": "no-store, no-cache, must-revalidate",
              pragma: "no-cache",
            },
          });
        }

        function tryParseEquippedIds(bodyText) {
          try {
            const data = JSON.parse(bodyText);
            const ids =
              data && Array.isArray(data.equippedIds) ? data.equippedIds : null;
            return Array.isArray(ids)
              ? ids.filter((x) => typeof x === "string")
              : null;
          } catch {
            return null;
          }
        }

        function makeFetchWrapper() {
          return async function (input, init) {
          const url =
            typeof input === "string"
              ? input
              : input && input.url
                ? input.url
                : "";
          const method = String(
            (init && init.method) || (input && input.method) || "GET",
          ).toUpperCase();
          
          if (url.includes('api/v4') || url.includes('api/v3')) {
            console.log('[GG Skinchanger Hook] Fetch intercepted:', method, toPath(url), 'localSaveOnly:', localSaveOnly);
          }
          
          const isAvatarUser =
            isPath(url, AVATAR_USER) || 
            (profileUserId && toPath(url) === AVATAR_USER_PREFIX + profileUserId) ||
            (toPath(url).startsWith(AVATAR_USER_PREFIX) && localSaveOnly);

          if (method === "GET" && isPath(url, ELITE_DAYS)) {
            return new Response("999", {
              status: 200,
              headers: {
                "content-type": "application/json; charset=utf-8",
                "cache-control": "no-store, no-cache, must-revalidate",
                pragma: "no-cache",
              },
            });
          }

          if (localSaveOnly && method !== "GET" && isSavePath(url)) {
            let bodyText = null;
            if (init && typeof init.body === "string") bodyText = init.body;
            else if (input && typeof input.clone === "function") {
              try {
                bodyText = await input.clone().text();
              } catch {}
            }
            if (bodyText) {
              const ids = tryParseEquippedIds(bodyText);
              if (ids && ids.length) {
                console.log('[GG Skinchanger Hook] Intercepted save (fetch), sending to script:', ids);
                window.postMessage(
                  { type: MSG_SAVE, equippedIds: ids },
                  "*",
                );
              }
            }
            return new Response(
              JSON.stringify({ ok: true, blocked: true, localSaved: true }),
              { status: 200, headers: { "Content-Type": "application/json" } },
            );
          }

          if (
            localSaveOnly &&
            method === "GET" &&
            isAvatarUser &&
            savedEquippedIds.length
          ) {
            const ready = await ensureAssetsReady();
            if (!ready) {
              return baseFetch.apply(this, arguments);
            }
            return createJsonResponse(buildAvatarPayload());
          }

          if (!localSaveOnly && isAvatarUser) {
            const headers = new Headers(
              (init && init.headers) ||
                (input && input.headers ? input.headers : undefined),
            );
            headers.set("cache-control", "no-cache");
            headers.set("pragma", "no-cache");

            const nextInit = Object.assign({}, init || {});
            nextInit.method = method;
            nextInit.cache = "no-store";
            nextInit.headers = headers;

            return baseFetch(bustUrl(url), nextInit);
          }

          const res = await baseFetch.apply(this, arguments);
          try {
            if (
              isPath(url, CUSTOMIZATION) ||
              isPath(url, SHOP_FEATURED) ||
              isPath(url, SHOP_FEATURED_GENERIC) ||
              isPath(url, SHOP_CREATOR) ||
              isPath(url, SHOP_CONVEYOR) ||
              isPath(url, PROFILES) ||
              isPath(url, ELITE_DAYS) ||
              isPrefix(url, RANKED_TEAMS_PREFIX)
            ) {
              if (localSaveOnly && isPath(url, PROFILES)) {
                await ensureAssetsReady();
              }
              const clone = res.clone();
              const text = await clone.text();
              let data = JSON.parse(text);
              if (isPath(url, ELITE_DAYS)) data = forceEliteDays();
              if (localSaveOnly) deepForceUnlockedTrue(data);
              if (localSaveOnly && typeof data === "object") forceEmptyRequirements(data);
              if (localSaveOnly && typeof data === "object") forceEliteOwnership(data);
              if (localSaveOnly && isPrefix(url, PROFILES)) forceEliteProfile(data, url);
              if (localSaveOnly && isPrefix(url, RANKED_TEAMS_PREFIX)) {
                await ensureAssetsReady();
                applyRankedTeamBorder(data);
              }
              const filterSet = localSaveOnly ? getSavedIdSet() : null;
              if (
                isPath(url, CUSTOMIZATION) ||
                isPath(url, SHOP_FEATURED) ||
                isPath(url, SHOP_FEATURED_GENERIC) ||
                isPath(url, SHOP_CREATOR) ||
                isPath(url, SHOP_CONVEYOR)
              ) {
                collectAssetsFromCustomization(data, filterSet);
              }

              const headers = new Headers(res.headers);
              headers.delete("content-length");
              headers.set("cache-control", "no-store, no-cache, must-revalidate");
              headers.set("pragma", "no-cache");
              return new Response(JSON.stringify(data), {
                status: res.status,
                statusText: res.statusText,
                headers,
              });
            }
          } catch {}
          return res;
          };
        }

        function installFetchHook() {
          if (window.fetch === wrappedFetch) return;
          wrappedFetch = makeFetchWrapper();
          window.fetch = wrappedFetch;
        }

        const origOpen = XMLHttpRequest.prototype.open;
        const origSend = XMLHttpRequest.prototype.send;

        installFetchHook();
        
        if (!window.__ggFetchHookInterval) {
          window.__ggFetchHookInterval = setInterval(installFetchHook, 5000);
        }

        XMLHttpRequest.prototype.open = function (method, url) {
          this.__gg_method = String(method || "GET").toUpperCase();
          let nextUrl = String(url || "");
          if (isPath(nextUrl, AVATAR_USER) || isPrefix(nextUrl, AVATAR_USER_PREFIX)) {
            nextUrl = bustUrl(nextUrl);
          }
          this.__gg_url = nextUrl;
          return origOpen.call(this, method, nextUrl, arguments[2], arguments[3], arguments[4]);
        };

        XMLHttpRequest.prototype.send = function (body) {
          const sendArgs = arguments;
          try {
            const method = this.__gg_method || "GET";
            const url = this.__gg_url || "";

            if (method === "GET" && isPath(url, ELITE_DAYS)) {
              const xhr = this;
              setTimeout(() => {
                try {
                  Object.defineProperty(xhr, "readyState", { value: 4 });
                  Object.defineProperty(xhr, "status", { value: 200 });
                  Object.defineProperty(xhr, "responseText", { value: "999" });
                  Object.defineProperty(xhr, "response", { value: "999" });
                  xhr.dispatchEvent(new Event("readystatechange"));
                  xhr.dispatchEvent(new Event("load"));
                  xhr.dispatchEvent(new Event("loadend"));
                } catch {}
              }, 0);
              return;
            }

            if (localSaveOnly && method !== "GET" && isSavePath(url)) {
              if (typeof body === "string") {
                const ids = tryParseEquippedIds(body);
                if (ids && ids.length) {
                  console.log('[GG Skinchanger Hook] Intercepted save (XHR), sending to script:', ids);
                  window.postMessage(
                    { type: MSG_SAVE, equippedIds: ids },
                    "*",
                  );
                }
              }
              const xhr = this;
              setTimeout(() => {
                try {
                  Object.defineProperty(xhr, "readyState", { value: 4 });
                  Object.defineProperty(xhr, "status", { value: 200 });
                  Object.defineProperty(xhr, "responseText", {
                    value: JSON.stringify({
                      ok: true,
                      blocked: true,
                      localSaved: true,
                    }),
                  });
                  xhr.dispatchEvent(new Event("readystatechange"));
                  xhr.dispatchEvent(new Event("load"));
                  xhr.dispatchEvent(new Event("loadend"));
                } catch {}
              }, 0);
              return;
            }

            if (
              localSaveOnly &&
              method === "GET" &&
              (isPath(url, AVATAR_USER) || (profileUserId && toPath(url) === AVATAR_USER_PREFIX + profileUserId)) &&
              savedEquippedIds.length
            ) {
              const xhr = this;
              ensureAssetsReady().then((ready) => {
                if (!ready) {
                  origSend.apply(xhr, sendArgs);
                  return;
                }
                const responseText = JSON.stringify(buildAvatarPayload());
                setTimeout(() => {
                  try {
                    Object.defineProperty(xhr, "status", { value: 200 });
                    Object.defineProperty(xhr, "readyState", { value: 4 });
                    Object.defineProperty(xhr, "responseText", {
                      value: responseText,
                    });
                    Object.defineProperty(xhr, "response", {
                      value: responseText,
                    });
                    xhr.dispatchEvent(new Event("readystatechange"));
                    xhr.dispatchEvent(new Event("load"));
                    xhr.dispatchEvent(new Event("loadend"));
                  } catch {}
                }, 0);
              });
              return;
            }

            this.addEventListener("readystatechange", function () {
              try {
                if (this.readyState !== 4) return;
                const rUrl = this.__gg_url || "";
                if (
                  !isPath(rUrl, CUSTOMIZATION) &&
                  !isPath(rUrl, SHOP_FEATURED) &&
                  !isPath(rUrl, SHOP_FEATURED_GENERIC) &&
                  !isPath(rUrl, SHOP_CREATOR) &&
                  !isPath(rUrl, SHOP_CONVEYOR) &&
                  !isPath(rUrl, PROFILES) &&
                  !isPath(rUrl, ELITE_DAYS) &&
                  !isPrefix(rUrl, RANKED_TEAMS_PREFIX)
                ) {
                  return;
                }

              const raw = this.responseText;
              let data = JSON.parse(raw);
              if (isPath(rUrl, ELITE_DAYS)) data = forceEliteDays();
              if (localSaveOnly) deepForceUnlockedTrue(data);
              if (localSaveOnly && typeof data === "object") forceEmptyRequirements(data);
              if (localSaveOnly && typeof data === "object") forceEliteOwnership(data);
              if (localSaveOnly && isPrefix(rUrl, PROFILES)) forceEliteProfile(data, rUrl);
              if (localSaveOnly && isPrefix(rUrl, RANKED_TEAMS_PREFIX)) {
                applyRankedTeamBorder(data);
              }
              const filterSet = localSaveOnly ? getSavedIdSet() : null;
              if (
                isPath(rUrl, CUSTOMIZATION) ||
                isPath(rUrl, SHOP_FEATURED) ||
                isPath(rUrl, SHOP_FEATURED_GENERIC) ||
                isPath(rUrl, SHOP_CREATOR) ||
                isPath(rUrl, SHOP_CONVEYOR)
              ) {
                  collectAssetsFromCustomization(data, filterSet);
                }
                const patched = JSON.stringify(data);

                if (patched !== raw) {
                  this.__gg_patchedText = patched;
                  Object.defineProperty(this, "responseText", {
                    configurable: true,
                    get: () => this.__gg_patchedText,
                  });
                  Object.defineProperty(this, "response", {
                    configurable: true,
                    get: () => this.__gg_patchedText,
                  });
                }
              } catch {}
            });
          } catch {}

          return origSend.apply(this, arguments);
        };

        window.__ggShopSkinHookInstalled = true;
        window.postMessage({ type: MSG_HOOK_READY }, "*");
        fetchOwnProfile();
      })();
    `;

    const s = document.createElement("script");
    s.textContent = hookCode;
    document.documentElement.appendChild(s);
    s.remove();
  }

  injectHook();
  setTimeout(() => {
    if (!hookReady) injectHook();
  }, 1000);
  let initialEquippedLocal = initialEquipped;
  let initialLocalSaveOnlyLocal = initialLocalSaveOnly;
  try {
    if (window.GhostGuessr && GhostGuessr.avatarStorage) {
      const s =
        GhostGuessr.avatarStorage.getSaved &&
        GhostGuessr.avatarStorage.getSaved();
      if (s && Array.isArray(s.equippedIds))
        initialEquippedLocal = s.equippedIds;
      if (typeof GhostGuessr.avatarStorage.getLocalSaveOnly === "function") {
        initialLocalSaveOnlyLocal =
          GhostGuessr.avatarStorage.getLocalSaveOnly();
      }
    }
  } catch {}

  if (initialEquippedLocal.length) sendEquippedToPage(initialEquippedLocal);
  sendToggleToPage(initialLocalSaveOnlyLocal);

  try {
    if (
      window.GhostGuessr &&
      typeof GhostGuessr.injectSkinchangerToggle === "function"
    ) {
      GhostGuessr.injectSkinchangerToggle(initialLocalSaveOnlyLocal);
    }
  } catch {}
})();


(function () {
  "use strict";

  const GG = window.GhostGuessr;

  if (GG.isSteam || GG.isElectron) {
    console.log("[GG Streamer Mode] Disabled in Steam environment");
    return;
  }

  const ANONYMOUS_NAMES = [
    "Player", "User", "Guesser", "Explorer", "Traveler", 
    "Navigator", "Mapper", "Wanderer", "Scout", "Adventurer"
  ];
  
  const PLACEHOLDER_AVATAR = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='144' height='144'%3E%3Crect fill='%23666' width='144' height='144'/%3E%3Ctext x='50%25' y='50%25' font-size='48' fill='%23ccc' text-anchor='middle' dy='.3em'%3E%3F%3C/text%3E%3C/svg%3E";

  const processedElements = new WeakSet();
  let anonymousCounter = 0;

  function getAnonymousName(index) {
    const baseName = ANONYMOUS_NAMES[index % ANONYMOUS_NAMES.length];
    const number = Math.floor(index / ANONYMOUS_NAMES.length) + 1;
    return number > 1 ? `${baseName}${number}` : baseName;
  }

  function anonymizeUsernames() {
    if (!GG.settings || !GG.settings.streamerMode) return;

    const userNickSelectors = [
      '.user-nick_nick__sRjZ2',
      '.header-profile_title__vqkkK label',
      '._token__container__qvdIo label',
      '.chat-friend_name__V0nzL',
      '.stylized-text_main__5S_jb',
      '[class*="player-name"]',
      '[class*="userName"]',
      '[class*="user-name"]',
      '[class*="nickname"]',
      '[class*="teamName"]',
      '[class*="team-name"]',
      '[class*="name"]'
    ];

    userNickSelectors.forEach(selector => {
      const elements = document.querySelectorAll(selector);
      elements.forEach(el => {
        if (processedElements.has(el)) return;
        
        const originalText = el.textContent.trim();
        
        if (!originalText || 
            originalText.length < 2 || 
            originalText.length > 30 ||
            originalText.startsWith('Player') || 
            originalText.startsWith('User') || 
            originalText.startsWith('Guesser') ||
            originalText.startsWith('Waiting') ||
            originalText.includes('...') ||
            /^\d+$/.test(originalText)) {
          return;
        }
        
        processedElements.add(el);
        el.textContent = getAnonymousName(anonymousCounter++);
        el.setAttribute('data-original', originalText);
      });
    });
  }

  function hideClubTags() {
    if (!GG.settings || !GG.settings.streamerMode) return;

    const clubTags = document.querySelectorAll('.club-tag_clubTag__UquGW');
    clubTags.forEach(tag => {
      if (!processedElements.has(tag)) {
        processedElements.add(tag);
        tag.style.display = 'none';
      }
    });
  }

  function hideFlags() {
    if (!GG.settings || !GG.settings.streamerMode) return;

    const flags = document.querySelectorAll('.user-nick_flag__24EXB, .country-flag_flag__tlHIr');
    flags.forEach(flag => {
      if (!processedElements.has(flag)) {
        processedElements.add(flag);
        flag.style.display = 'none';
      }
    });
  }

  function anonymizeAvatars() {
    if (!GG.settings || !GG.settings.streamerMode) return;

    const avatarContainers = document.querySelectorAll('.avatar_titleAvatarImage__sXIP7, .play-along-standings_avatar__2FtjJ');
    
    avatarContainers.forEach(container => {
      if (processedElements.has(container)) return;
      processedElements.add(container);
      
      const images = container.querySelectorAll('img');
      
      images.forEach((img, index) => {
        if (index === 0) {
          if (!img.src.startsWith('data:')) {
            img.setAttribute('data-original-src', img.src);
            img.src = PLACEHOLDER_AVATAR;
          }
        } else {
          img.style.display = 'none';
        }
      });
    });
  }

  function anonymizeMapPins() {
    if (!GG.settings || !GG.settings.streamerMode) return;

    const mapPinImages = document.querySelectorAll('[data-qa="guess-marker"] img, .map-pin_mapPin__vG6pA img');
    
    mapPinImages.forEach(img => {
      if (processedElements.has(img)) return;
      processedElements.add(img);
      
      if (img.alt && img.alt.length > 0) {
        img.setAttribute('data-original-alt', img.alt);
        img.alt = getAnonymousName(anonymousCounter++);
      }
      
      if (img.src && !img.src.startsWith('data:')) {
        img.setAttribute('data-original-src', img.src);
        img.src = PLACEHOLDER_AVATAR;
      }
    });
  }

  function restoreOriginals() {
    const usernameElements = document.querySelectorAll('[data-original]');
    usernameElements.forEach(el => {
      const original = el.getAttribute('data-original');
      if (original) {
        el.textContent = original;
        el.removeAttribute('data-original');
      }
      processedElements.delete(el);
    });

    const clubTags = document.querySelectorAll('.club-tag_clubTag__UquGW');
    clubTags.forEach(tag => {
      tag.style.display = '';
      processedElements.delete(tag);
    });

    const flags = document.querySelectorAll('.user-nick_flag__24EXB, .country-flag_flag__tlHIr');
    flags.forEach(flag => {
      flag.style.display = '';
      processedElements.delete(flag);
    });

    const avatarContainers = document.querySelectorAll('.avatar_titleAvatarImage__sXIP7, .play-along-standings_avatar__2FtjJ');
    avatarContainers.forEach(container => {
      const images = container.querySelectorAll('img');
      images.forEach((img, index) => {
        if (index === 0) {
          const originalSrc = img.getAttribute('data-original-src');
          if (originalSrc) {
            img.src = originalSrc;
            img.removeAttribute('data-original-src');
          }
        } else {
          img.style.display = '';
        }
      });
      processedElements.delete(container);
    });

    const mapPinImages = document.querySelectorAll('img[data-original-alt], img[data-original-src]');
    mapPinImages.forEach(img => {
      const originalAlt = img.getAttribute('data-original-alt');
      if (originalAlt) {
        img.alt = originalAlt;
        img.removeAttribute('data-original-alt');
      }
      
      const originalSrc = img.getAttribute('data-original-src');
      if (originalSrc) {
        img.src = originalSrc;
        img.removeAttribute('data-original-src');
      }
      
      processedElements.delete(img);
    });

    anonymousCounter = 0;
  }

  GG.applyStreamerMode = function() {
    if (!GG.settings || !GG.settings.streamerMode) {
      restoreOriginals();
      return;
    }
    
    anonymizeUsernames();
    hideClubTags();
    hideFlags();
    anonymizeAvatars();
    anonymizeMapPins();
  };

  GG.toggleStreamerMode = function() {
    GG.settings.streamerMode = !GG.settings.streamerMode;
    GG.saveSettings();
    GG.applyStreamerMode();
  };

  const observer = new MutationObserver(() => {
    if (GG.settings && GG.settings.streamerMode) {
      setTimeout(() => {
        GG.applyStreamerMode();
      }, 50);
    }
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true
  });

  if (GG.settings && GG.settings.streamerMode) {
    GG.applyStreamerMode();
  }

  console.log("[GG Streamer Mode] Initialized");
})();



(function () {
  "use strict";

  const GG = window.GhostGuessr;

  function detectRoundId() {
    const url = window.location.href;
    const match = url.match(/\/game\/([^\/]+)/);
    return match ? match[1] : null;
  }

  const originalOpen = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function (method, url) {
    if (
      method.toUpperCase() === "POST" &&
      url.includes("maps.googleapis.com") &&
      (url.includes("GetMetadata") || url.includes("SingleImageSearch"))
    ) {
      this.addEventListener("load", function () {
        try {
          let result = this.responseText;
          let pattern = /-?\d+\.\d+,-?\d+\.\d+/g;
          let matches = result.match(pattern);
          if (matches && matches.length > 0) {
            let match = matches[0];
            let split = match.split(",");
            const newLat = Number.parseFloat(split[0]);
            const newLng = Number.parseFloat(split[1]);

            const roundId = detectRoundId();
            const isGetMetadata = url.includes("GetMetadata");

            if ((roundId && roundId !== GG.currentRoundId) || isGetMetadata) {
              if (roundId) GG.currentRoundId = roundId;
              GG.initialCoords.lat = newLat;
              GG.initialCoords.lng = newLng;

              if (GG.marker) {
                GG.marker.setMap(null);
                GG.marker = null;
              }
              if (GG.streetviewMarker) {
                GG.streetviewMarker.setMap(null);
                GG.streetviewMarker = null;
              }
              if (GG.connectionLine) {
                GG.connectionLine.setMap(null);
                GG.connectionLine = null;
              }

              if (GG._scorePredictorObserver) {
                GG._scorePredictorObserver.disconnect();
                GG._scorePredictorObserver = null;
              }
            }

            GG.coords.lat = newLat;
            GG.coords.lng = newLng;
            if (GG.settings.enabled && GG.gmap) GG.placeMarker();
          }
        } catch (e) {}
      });
    }
    return originalOpen.apply(this, arguments);
  };

  GG.getGoogleMap = function () {
    let container =
      document.querySelector('[class*="guess-map_canvas__"]') ||
      document.querySelector('[class*="run-game-guess-map-contents_canvas__"]') ||
      document.querySelector('[data-qa="guess-map-canvas"]');
    if (!container) return null;
    if (GG.gmap && GG.gmap.getDiv && GG.gmap.getDiv() === container) {
      return GG.gmap;
    }
    GG.gmap = null;
    try {
      let reactKey = Object.keys(container).find((key) =>
        key.startsWith("__reactFiber$"),
      );
      if (reactKey) {
        let fiber = container[reactKey];
        let current = fiber;
        while (current) {
          if (current.memoizedProps && current.memoizedProps.map) {
            GG.gmap = current.memoizedProps.map;
            return GG.gmap;
          }
          current = current.return;
        }
      }
    } catch (e) {}
    return null;
  };

  GG.createMarker = function () {
    if (!GG.initialCoords.lat || !GG.initialCoords.lng) return;
    GG.gmap = GG.getGoogleMap();
    if (!GG.gmap) return;
    if (GG.marker) {
      GG.marker.setMap(null);
      GG.marker = null;
    }
    try {
      if (typeof google !== "undefined" && google.maps) {
        let position = new google.maps.LatLng(GG.initialCoords.lat, GG.initialCoords.lng);
        let icon = {
          path: google.maps.SymbolPath.CIRCLE,
          fillColor: GG.hexToRgba(GG.settings.markerColor, GG.settings.opacity),
          fillOpacity: 1,
          strokeColor: GG.settings.outlineColor,
          strokeWeight: GG.settings.outlineWidth,
          scale: GG.settings.size,
        };
        GG.marker = new google.maps.Marker({
          position: position,
          map: GG.gmap,
          icon: icon,
          opacity: GG.settings.opacity,
          zIndex: 999,
          optimized: false,
          clickable: false,
          draggable: false,
        });

        if (GG.marker) {
          google.maps.event.clearListeners(GG.marker, "click");
          google.maps.event.clearListeners(GG.marker, "mousedown");
          google.maps.event.clearListeners(GG.marker, "mouseup");
        }
      }
    } catch (e) {
      GG.createDivMarker();
    }
  };

  GG.updateMarkerStyle = function () {
    if (!GG.marker || !GG.marker.setIcon) return;

    try {
      if (typeof google !== "undefined" && google.maps) {
        let icon = {
          path: google.maps.SymbolPath.CIRCLE,
          fillColor: GG.hexToRgba(GG.settings.markerColor, GG.settings.opacity),
          fillOpacity: 1,
          strokeColor: GG.settings.outlineColor,
          strokeWeight: GG.settings.outlineWidth,
          scale: GG.settings.size,
        };
        GG.marker.setIcon(icon);
        GG.marker.setOpacity(GG.settings.opacity);
      }
    } catch (e) {}

    GG.updateStreetviewMarkerStyle();
  };

  GG.createStreetviewMarker = function () {
    if (!GG.coords.lat || !GG.coords.lng) return;
    GG.gmap = GG.getGoogleMap();
    if (!GG.gmap) return;
    if (GG.streetviewMarker) {
      GG.streetviewMarker.setMap(null);
      GG.streetviewMarker = null;
    }
    try {
      if (typeof google !== "undefined" && google.maps) {
        const opacity = GG.settings.streetviewMarkerOpacity ?? GG.settings.opacity;
        let position = new google.maps.LatLng(GG.coords.lat, GG.coords.lng);
        let icon = {
          path: google.maps.SymbolPath.CIRCLE,
          fillColor: GG.hexToRgba(GG.settings.streetviewMarkerColor, opacity),
          fillOpacity: 1,
          strokeColor: GG.settings.streetviewMarkerOutline,
          strokeWeight: GG.settings.streetviewMarkerOutlineWidth ?? GG.settings.outlineWidth,
          scale: GG.settings.streetviewMarkerSize,
        };
        GG.streetviewMarker = new google.maps.Marker({
          position: position,
          map: GG.gmap,
          icon: icon,
          opacity: opacity,
          zIndex: 997,
          optimized: false,
          clickable: false,
          draggable: false,
        });
      }
    } catch (e) {}
  };

  GG.updateStreetviewMarkerStyle = function () {
    if (!GG.streetviewMarker || !GG.streetviewMarker.setIcon) return;

    try {
      if (typeof google !== "undefined" && google.maps) {
        const opacity = GG.settings.streetviewMarkerOpacity ?? GG.settings.opacity;
        let icon = {
          path: google.maps.SymbolPath.CIRCLE,
          fillColor: GG.hexToRgba(GG.settings.streetviewMarkerColor, opacity),
          fillOpacity: 1,
          strokeColor: GG.settings.streetviewMarkerOutline,
          strokeWeight: GG.settings.streetviewMarkerOutlineWidth ?? GG.settings.outlineWidth,
          scale: GG.settings.streetviewMarkerSize,
        };
        GG.streetviewMarker.setIcon(icon);
        GG.streetviewMarker.setOpacity(opacity);
      }
    } catch (e) {}
  };

  GG.updateStreetviewMarkerPosition = function () {
    if (!GG.streetviewMarker) return;
    if (!GG.coords.lat || !GG.coords.lng) return;
    try {
      if (typeof google !== "undefined" && google.maps && GG.streetviewMarker.setPosition) {
        let position = new google.maps.LatLng(GG.coords.lat, GG.coords.lng);
        GG.streetviewMarker.setPosition(position);
      }
    } catch (e) {}
  };

  GG.updateConnectionLine = function (guessLat, guessLng) {
    if (!GG.settings.showConnectionLine) {
      if (GG.connectionLine) {
        GG.connectionLine.setMap(null);
        GG.connectionLine = null;
      }
      return;
    }

    if (!GG.initialCoords.lat || !GG.initialCoords.lng) return;
    if (!guessLat || !guessLng) return;
    GG.gmap = GG.getGoogleMap();
    if (!GG.gmap) return;

    try {
      if (typeof google !== "undefined" && google.maps) {
        const path = [
          new google.maps.LatLng(guessLat, guessLng),
          new google.maps.LatLng(GG.initialCoords.lat, GG.initialCoords.lng),
        ];

        if (GG.connectionLine) {
          GG.connectionLine.setPath(path);
        } else {
          GG.connectionLine = new google.maps.Polyline({
            path: path,
            geodesic: false,
            strokeColor: GG.settings.markerColor,
            strokeOpacity: 0.7,
            strokeWeight: 2,
            map: GG.gmap,
            zIndex: 996,
            clickable: false,
          });
        }
      }
    } catch (e) {}
  };

  GG.createDivMarker = function () {
    let container =
      document.querySelector('[class*="guess-map_canvas__"]') ||
      document.querySelector('[class*="run-game-guess-map-contents_canvas__"]') ||
      document.querySelector('[data-qa="guess-map-canvas"]');
    if (!container) return;
    let existing = document.getElementById("geo-div-marker");
    if (existing) existing.remove();
    let markerDiv = document.createElement("div");
    markerDiv.id = "geo-div-marker";
    markerDiv.style.cssText = `
            position: absolute !important;
            top: 50% !important;
            left: 50% !important;
            transform: translate(-50%, -50%) !important;
            width: ${GG.settings.size * 2.5}px !important;
            height: ${GG.settings.size * 2.5}px !important;
            background: ${GG.hexToRgba(
              GG.settings.markerColor,
              GG.settings.opacity,
            )} !important;
            border: ${GG.settings.outlineWidth}px solid ${
              GG.settings.outlineColor
            } !important;
            border-radius: 50% !important;
            pointer-events: none !important;
            z-index: 9999 !important;
            box-shadow: 0 0 10px ${GG.hexToRgba(
              GG.settings.markerColor,
              GG.settings.opacity * 0.5,
            )} !important;
            cursor: default !important;
        `;
    container.appendChild(markerDiv);
  };

  GG.placeMarker = function () {
    if (!GG.initialCoords.lat || !GG.initialCoords.lng) return;
    if (!GG.marker) {
      GG.createMarker();
    } else {
      try {
        if (
          typeof google !== "undefined" &&
          google.maps &&
          GG.marker.setPosition
        ) {
          let position = new google.maps.LatLng(GG.initialCoords.lat, GG.initialCoords.lng);
          GG.marker.setPosition(position);
        }
      } catch (e) {}
    }

    if (GG.settings.showStreetviewMarker && GG.coords.lat && GG.coords.lng) {
      if (!GG.streetviewMarker) {
        GG.createStreetviewMarker();
      } else {
        GG.updateStreetviewMarkerPosition();
      }
    }
  };

  GG.ensureMarkerVisible = function (attempt) {
    if (!GG.settings) {
      setTimeout(() => GG.ensureMarkerVisible(attempt), 100);
      return;
    }

    if (!GG.settings.enabled) return;
    if (!GG.coords.lat || !GG.coords.lng) return;
    if (GG.divMarkerActive) {
      const mapNow = GG.getGoogleMap();
      if (!mapNow || typeof mapNow.getDiv !== "function") return;
      const divMarker = document.getElementById("geo-div-marker");
      if (divMarker) divMarker.remove();
      GG.divMarkerActive = false;
    }

    let isOnMapView =
      document.querySelector('[class*="coordinate-guess_mapContainer__"]') ||
      document.querySelector('[class*="guess-map_canvas__"]') ||
      document.querySelector('[class*="run-game-guess-map-contents_canvas__"]');
    if (!isOnMapView) return;

    GG.placeMarker();

    if (!GG.marker) {
      const nextAttempt = (attempt || 0) + 1;
      if (nextAttempt <= 30) {
        if (GG.markerRetryId) {
          clearTimeout(GG.markerRetryId);
        }
        GG.markerRetryId = setTimeout(
          () => GG.ensureMarkerVisible(nextAttempt),
          500,
        );
      }
    }
  };

  GG.toggleMarker = function () {
    if (!GG.coords.lat || !GG.coords.lng) return;

    let isOnMapView =
      document.querySelector('[class*="coordinate-guess_mapContainer__"]') ||
      document.querySelector('[class*="guess-map_canvas__"]') ||
      document.querySelector('[class*="run-game-guess-map-contents_canvas__"]');
    if (!isOnMapView) return;

    GG.settings.enabled = !GG.settings.enabled;
    GG.saveSettings();

    if (GG.settings.enabled) {
      GG.placeMarker();
    } else {
      if (GG.marker && GG.marker.setMap) GG.marker.setMap(null);
      if (GG.streetviewMarker && GG.streetviewMarker.setMap) GG.streetviewMarker.setMap(null);
      if (GG.connectionLine && GG.connectionLine.setMap) GG.connectionLine.setMap(null);
      let divMarker = document.getElementById("geo-div-marker");
      if (divMarker) divMarker.style.display = "none";
      GG.marker = null;
      GG.streetviewMarker = null;
      GG.connectionLine = null;
    }
  };
})();



(function () {
  "use strict";

  const GG = window.GhostGuessr;

  let scorePredictorElement = null;
  let guessMarker = null;

  function calculateDistance(lat1, lng1, lat2, lng2) {
    try {
      if (typeof google !== 'undefined' && google.maps && google.maps.geometry) {
        const point1 = new google.maps.LatLng(lat1, lng1);
        const point2 = new google.maps.LatLng(lat2, lng2);
        const distanceInMeters = google.maps.geometry.spherical.computeDistanceBetween(point1, point2);
        return distanceInMeters / 1000;
      }
    } catch (e) {
      console.warn('[GG Score Predictor] Google Maps geometry not available, using fallback');
    }
    
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLng / 2) * Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  function calculateScore(distanceKm) {
    if (distanceKm === 0) return 5000;
    
    // GeoGuessr uses approximately 2000km for 5000 score decay on World map
    // Formula: 5000 * e^(-10 * distance / mapSize)
    // mapSize for World Map is approx 14916.862 km
    // -10 * distance / 14916.862 = -distance / 1491.6862
    const score = Math.round(5000 * Math.exp(-distanceKm / 1491.6862));
    return Math.max(0, Math.min(5000, score));
  }

  function formatDistance(km) {
    if (km < 1) {
      return `${Math.round(km * 1000)} m`;
    } else if (km < 10) {
      return `${km.toFixed(2)} km`;
    } else {
      return `${Math.round(km)} km`;
    }
  }

  function createScorePredictorUI() {
    if (scorePredictorElement) return;

    scorePredictorElement = document.createElement('div');
    scorePredictorElement.id = 'gg-score-predictor';
    scorePredictorElement.style.cssText = `
      position: absolute;
      bottom: 80px;
      left: 20px;
      width: auto;
      max-height: 40px;
      background: rgba(0, 0, 0, 0.85);
      color: white;
      padding: 8px 12px;
      border-radius: 8px;
      font-family: 'Neo Sans', 'Arial', sans-serif;
      font-size: 14px;
      font-weight: 600;
      z-index: 1000;
      display: none;
      pointer-events: none;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.4);
      border: 2px solid rgba(255, 255, 255, 0.2);
      backdrop-filter: blur(10px);
      overflow: hidden;
    `;

    const scoreText = document.createElement('span');
    scoreText.id = 'gg-score-text';
    scoreText.style.cssText = `
      font-size: 20px;
      font-weight: 700;
      margin-right: 8px;
      background: linear-gradient(135deg, #FFD700, #FFA500);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
      display: inline-block;
    `;

    const distanceText = document.createElement('span');
    distanceText.id = 'gg-distance-text';
    distanceText.style.cssText = `
      font-size: 11px;
      color: rgba(255, 255, 255, 0.7);
      font-weight: 400;
      display: inline-block;
      vertical-align: middle;
    `;

    scorePredictorElement.appendChild(scoreText);
    scorePredictorElement.appendChild(distanceText);
  }

  function updateScorePredictor(guessLat, guessLng) {
    if (!GG.settings.showScorePredictor) return;

    const refLat = GG.initialCoords.lat || GG.coords.lat;
    const refLng = GG.initialCoords.lng || GG.coords.lng;
    if (!refLat || !refLng) return;

    createScorePredictorUI();

    const distance = calculateDistance(refLat, refLng, guessLat, guessLng);
    const score = calculateScore(distance);

    const scoreTextEl = document.getElementById('gg-score-text');
    const distanceTextEl = document.getElementById('gg-distance-text');
    const displayMode = GG.settings.scorePredictorDisplay || 'both';

    if (scoreTextEl && distanceTextEl) {
      if (displayMode === 'score') {
        scoreTextEl.textContent = `~${score.toLocaleString()}`;
        scoreTextEl.style.marginRight = '0';
        distanceTextEl.style.display = 'none';
      } else if (displayMode === 'distance') {
        scoreTextEl.textContent = formatDistance(distance);
        scoreTextEl.style.marginRight = '0';
        distanceTextEl.style.display = 'none';
      } else {
        scoreTextEl.textContent = `~${score.toLocaleString()}`;
        scoreTextEl.style.marginRight = '8px';
        distanceTextEl.textContent = formatDistance(distance);
        distanceTextEl.style.display = 'inline-block';
      }

      if (score >= 4500) {
        scoreTextEl.style.background = 'linear-gradient(135deg, #00FF00, #32CD32)';
      } else if (score >= 3000) {
        scoreTextEl.style.background = 'linear-gradient(135deg, #FFD700, #FFA500)';
      } else if (score >= 1500) {
        scoreTextEl.style.background = 'linear-gradient(135deg, #FFA500, #FF6347)';
      } else {
        scoreTextEl.style.background = 'linear-gradient(135deg, #FF6347, #DC143C)';
      }
      scoreTextEl.style.webkitBackgroundClip = 'text';
      scoreTextEl.style.webkitTextFillColor = 'transparent';
      scoreTextEl.style.backgroundClip = 'text';
    }

    scorePredictorElement.style.display = 'block';

    if (typeof GG.updateConnectionLine === 'function') {
      GG.updateConnectionLine(guessLat, guessLng);
    }
  }

  function hideScorePredictor() {
    if (scorePredictorElement) {
      scorePredictorElement.style.display = 'none';
    }
  }

  GG.setupScorePredictorListeners = function() {
    const mapContainer = document.querySelector('[class*="guess-map_canvas__"]') ||
                        document.querySelector('[class*="run-game-guess-map-contents_canvas__"]') ||
                        document.querySelector('[data-qa="guess-map-canvas"]');
    
    if (!mapContainer) return;

    if (!scorePredictorElement || !mapContainer.contains(scorePredictorElement)) {
      createScorePredictorUI();
      if (scorePredictorElement) {
        mapContainer.appendChild(scorePredictorElement);
      }
    }

    if (GG._scorePredictorObserver) return;

    let updateTimeout = null;
    let lastUpdateTime = 0;
    const MIN_UPDATE_INTERVAL = 100;
    let lastBounds = null;
    let lastZoom = null;

    function updateFromMarker() {
      const guessMarker = document.querySelector('[data-qa="guess-marker"]');
      
      if (guessMarker && GG.settings.showScorePredictor && GG.coords.lat && GG.coords.lng) {
        const gmap = GG.getGoogleMap();
        if (!gmap) return;

        try {
          const bounds = gmap.getBounds();
          if (!bounds) return;

          const currentZoom = gmap.getZoom();
          const boundsChanged = !lastBounds || 
                               lastBounds.toString() !== bounds.toString() ||
                               lastZoom !== currentZoom;

          if (boundsChanged) {
            lastBounds = bounds;
            lastZoom = currentZoom;
          }

          let guessLat = null;
          let guessLng = null;

          const findReactProps = (dom) => {
            const key = Object.keys(dom).find(k => k.startsWith('__reactFiber$'));
            return key ? dom[key] : null;
          };

          const fiber = findReactProps(guessMarker);
          let current = fiber;
          while (current) {
            const props = current.memoizedProps;
            if (props && (props.lat || props.lng)) {
               guessLat = props.lat;
               guessLng = props.lng;
               break;
            }
            if (props && props.position && (props.position.lat || props.position.lng)) {
               guessLat = typeof props.position.lat === 'function' ? props.position.lat() : props.position.lat;
               guessLng = typeof props.position.lng === 'function' ? props.position.lng() : props.position.lng;
               break;
            }
            current = current.return;
          }

          if (guessLat === null || guessLng === null) {
              const markerRect = guessMarker.getBoundingClientRect();
              const mapRect = mapContainer.getBoundingClientRect();
              if (markerRect.width === 0 || mapRect.width === 0) return;

              const relX = (markerRect.left + markerRect.width / 2 - mapRect.left) / mapRect.width;
              const relY = (markerRect.top + markerRect.height / 2 - mapRect.top) / mapRect.height;
              const ne = bounds.getNorthEast();
              const sw = bounds.getSouthWest();
              guessLng = sw.lng() + (ne.lng() - sw.lng()) * relX;
              guessLat = ne.lat() - (ne.lat() - sw.lat()) * relY;
          }

          updateScorePredictor(guessLat, guessLng);
        } catch (e) {
          console.error('[GG Score Predictor] Error calculating position:', e);
          hideScorePredictor();
        }
      } else {
        hideScorePredictor();
        lastBounds = null;
        lastZoom = null;
      }
    }

    const debouncedUpdate = () => {
      if (updateTimeout) return;
      updateTimeout = setTimeout(() => {
        updateTimeout = null;
        updateFromMarker();
      }, 50);
    };

    const observer = new MutationObserver(debouncedUpdate);

    const guessMapContainer = document.querySelector('[class*="guess-map_"]') || mapContainer;
    
    observer.observe(guessMapContainer, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['style']
    });

    GG._scorePredictorObserver = observer;
  };

  GG.toggleScorePredictor = function() {
    GG.settings.showScorePredictor = !GG.settings.showScorePredictor;
    GG.saveSettings();
    
    if (!GG.settings.showScorePredictor) {
      hideScorePredictor();
    }
  };

  console.log("[GG Score Predictor] Initialized");
})();



(function () {
  "use strict";

  const GG = window.GhostGuessr;

  const hasClassPrefix = (element, prefix) => {
    if (!element) return false;
    return Array.from(element.classList).some((name) =>
      name.startsWith(prefix),
    );
  };

  const getClassByPrefix = (element, prefix) => {
    if (!element) return null;
    return Array.from(element.classList).find((name) =>
      name.startsWith(prefix),
    );
  };

  const buildAutoClaimToggle = () => {
    if (GG.isElectron || GG.isSteam) return;
    const toggleContainer = document.createElement("div");
    toggleContainer.className = "game-menu_optionsContainer__Eafrd";
    toggleContainer.style.transform = "translateX(-2px)";
    toggleContainer.style.marginLeft = "-2px";

    const option = document.createElement("label");
    option.className =
      "game-options_option__xQZVa game-options_editableOption__0hL4c";
    option.style.cssText = `
        width: 400px;
        max-width: 400px;
        min-width: 400px;
        display: flex;
        align-items: center;
        justify-content: space-between;
    `;

    const labelWrap = document.createElement("div");
    labelWrap.className = "game-menu_imgAndLabelWrapper__tHcGz";

    const icon = document.createElement("img");
    icon.alt = "";
    icon.loading = "lazy";
    icon.width = 25;
    icon.height = 25;
    icon.decoding = "async";
    icon.setAttribute("data-nimg", "1");
    icon.className = "game-menu_fullscreenIcon__agaGg";
    icon.style.color = "transparent";

    icon.src =
      "data:image/svg+xml," +
      encodeURIComponent(
        `<svg width="25" height="25" viewBox="0 0 25 25" fill="none" xmlns="http://www.w3.org/2000/svg">
          <circle cx="12.5" cy="12.5" r="9" fill="#8b5cf6"/>
          <path d="M9.5 12.5L11.5 14.5L15.5 10.5" stroke="#ffffff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>`,
      );

    const labelText = document.createElement("div");
    labelText.className = "game-options_optionLabel__Vk5xN";
    labelText.textContent = "Auto Claim Rewards";

    const inputWrap = document.createElement("div");
    inputWrap.className = "game-options_optionInput__paPBZ";

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.className = "toggle_toggle__qfXpL";
    checkbox.checked = Boolean(GG.settings.autoClaimRewards);

    const updateToggleVisuals = () => {
      labelText.textContent = "Auto Claim Rewards";
    };

    updateToggleVisuals();

    checkbox.addEventListener("change", function () {
      GG.settings.autoClaimRewards = checkbox.checked;
      GG.saveSettings();
      updateToggleVisuals();
      if (GG.settings.autoClaimRewards && GG.tryRewardClaims) {
        GG.tryRewardClaims();
      }
    });

    labelWrap.appendChild(icon);
    labelWrap.appendChild(labelText);
    inputWrap.appendChild(checkbox);
    option.appendChild(labelWrap);
    option.appendChild(inputWrap);

    toggleContainer.appendChild(option);

    return toggleContainer;
  };

  const createScorePredictorToggle = () => {
    const toggleContainer = document.createElement("div");
    toggleContainer.className = "game-menu_optionsContainer__Eafrd";
    toggleContainer.style.transform = "translateX(-2px)";
    toggleContainer.style.marginLeft = "-2px";

    const option = document.createElement("label");
    option.className =
      "game-options_option__xQZVa game-options_editableOption__0hL4c";
    option.style.cssText = `
        width: 400px;
        max-width: 400px;
        min-width: 400px;
        display: flex;
        align-items: center;
        justify-content: space-between;
    `;

    const labelWrap = document.createElement("div");
    labelWrap.className = "game-menu_imgAndLabelWrapper__tHcGz";

    const icon = document.createElement("img");
    icon.alt = "";
    icon.loading = "lazy";
    icon.width = 25;
    icon.height = 25;
    icon.decoding = "async";
    icon.setAttribute("data-nimg", "1");
    icon.className = "game-menu_fullscreenIcon__agaGg";
    icon.style.color = "transparent";

    icon.src =
      "data:image/svg+xml," +
      encodeURIComponent(
        `<svg width="25" height="25" viewBox="0 0 25 25" fill="none" xmlns="http://www.w3.org/2000/svg">
          <circle cx="12.5" cy="12.5" r="10" stroke="#8b5cf6" stroke-width="2" fill="none"/>
          <text x="12.5" y="17" text-anchor="middle" font-size="11" fill="#8b5cf6" font-weight="bold">5K</text>
        </svg>`,
      );

    const labelText = document.createElement("div");
    labelText.className = "game-options_optionLabel__Vk5xN";
    labelText.textContent = "Score Predictor (Beta)";

    const inputWrap = document.createElement("div");
    inputWrap.className = "game-options_optionInput__paPBZ";

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.className = "toggle_toggle__qfXpL";
    checkbox.checked = Boolean(GG.settings.showScorePredictor);

    checkbox.addEventListener("change", function () {
      GG.settings.showScorePredictor = checkbox.checked;
      GG.saveSettings();
      if (!checkbox.checked) {
        const predictor = document.getElementById('gg-score-predictor');
        if (predictor) predictor.style.display = 'none';
      }
    });

    labelWrap.appendChild(icon);
    labelWrap.appendChild(labelText);
    inputWrap.appendChild(checkbox);
    option.appendChild(labelWrap);
    option.appendChild(inputWrap);

    toggleContainer.appendChild(option);

    return toggleContainer;
  };

  const buildScorePredictorSettings = () => {
    const container = document.createElement("div");
    container.className = "gg-score-predictor-settings";
    container.style.cssText = "margin-top: 16px;";

    const displayModeContainer = document.createElement("div");
    displayModeContainer.className = "slider-option_wrapper__3gsTQ";
    displayModeContainer.style.cssText = "margin-bottom: 16px; display: flex; align-items: center; gap: 12px;";

    const displayModeIcon = document.createElement("div");
    displayModeIcon.className = "slider-option_icon__qtnY8";
    displayModeIcon.style.cssText = "flex-shrink: 0; width: 24px; height: 24px;";
    displayModeIcon.innerHTML = `
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="12" cy="12" r="9" stroke="#8b5cf6" stroke-width="2" fill="none"/>
        <text x="12" y="16" text-anchor="middle" font-size="9" fill="#8b5cf6" font-weight="bold">5K</text>
      </svg>
    `;

    const displayModeLabel = document.createElement("div");
    displayModeLabel.className = "slider-option_label__HSXrJ";
    displayModeLabel.style.cssText = "flex: 1; font-size: 14px; color: #fff;";
    displayModeLabel.textContent = "Display Mode";

    const displayModeValue = document.createElement("div");
    displayModeValue.className = "slider-option_value__OM__C";
    displayModeValue.style.cssText = "flex-shrink: 0;";

    const displayModeSelect = document.createElement("select");
    displayModeSelect.style.cssText = `
      width: 140px;
      height: 32px;
      background: rgba(255, 255, 255, 0.1);
      border: 1px solid #8b5cf6;
      border-radius: 6px;
      color: #fff;
      padding: 0 8px;
      font-size: 14px;
      cursor: pointer;
      outline: none;
    `;

    [
      { value: "both", label: "Score + Distance" },
      { value: "score", label: "Score Only" },
      { value: "distance", label: "Distance Only" },
    ].forEach(opt => {
      const optionEl = document.createElement("option");
      optionEl.value = opt.value;
      optionEl.textContent = opt.label;
      optionEl.style.background = "#1a1a2e";
      if (GG.settings.scorePredictorDisplay === opt.value) {
        optionEl.selected = true;
      }
      displayModeSelect.appendChild(optionEl);
    });

    displayModeSelect.addEventListener("change", function () {
      GG.settings.scorePredictorDisplay = this.value;
      GG.saveSettings();
    });

    displayModeValue.appendChild(displayModeSelect);
    displayModeContainer.appendChild(displayModeIcon);
    displayModeContainer.appendChild(displayModeLabel);
    displayModeContainer.appendChild(displayModeValue);
    container.appendChild(displayModeContainer);

    const createNativeToggle = (labelTextStr, settingKey, iconSvg) => {
        const toggleContainer = document.createElement("div");
        toggleContainer.className = "game-menu_optionsContainer__Eafrd";
        toggleContainer.style.transform = "translateX(-2px)";
        toggleContainer.style.marginLeft = "-2px";
    
        const option = document.createElement("label");
        option.className = "game-options_option__xQZVa game-options_editableOption__0hL4c";
        option.style.cssText = `
            width: 100%;
            display: flex;
            align-items: center;
            justify-content: space-between;
        `;

      const labelWrap = document.createElement("div");
      labelWrap.className = "game-menu_imgAndLabelWrapper__tHcGz";
      labelWrap.style.cssText = "display: flex; align-items: center; gap: 10px;";

      const icon = document.createElement("img");
      icon.alt = "";
      icon.loading = "lazy";
      icon.width = 25;
      icon.height = 25;
      icon.decoding = "async";
      icon.setAttribute("data-nimg", "1");
      icon.className = "game-menu_fullscreenIcon__agaGg";
      icon.style.cssText = "color: transparent; flex-shrink: 0;";
      icon.src = "data:image/svg+xml," + encodeURIComponent(iconSvg);

      const labelText = document.createElement("div");
      labelText.className = "game-options_optionLabel__Vk5xN";
      labelText.style.cssText = "font-size: 14px; color: #fff;";
      labelText.textContent = labelTextStr;

      const inputWrap = document.createElement("div");
      inputWrap.className = "game-options_optionInput__paPBZ";
      inputWrap.style.cssText = "margin-left: auto;";

      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.className = "toggle_toggle__qfXpL";
      checkbox.checked = Boolean(GG.settings[settingKey]);

      checkbox.addEventListener("change", function () {
        GG.settings[settingKey] = checkbox.checked;
        GG.saveSettings();
      });

      labelWrap.appendChild(icon);
      labelWrap.appendChild(labelText);
      inputWrap.appendChild(checkbox);
      option.appendChild(labelWrap);
      option.appendChild(inputWrap);
      toggleContainer.appendChild(option);

      return toggleContainer;
    };

    container.appendChild(createNativeToggle("Connection Line (Beta)", "showConnectionLine",
      `<svg width="25" height="25" viewBox="0 0 25 25" fill="none" xmlns="http://www.w3.org/2000/svg">
        <line x1="5" y1="20" x2="20" y2="5" stroke="#8b5cf6" stroke-width="2" stroke-linecap="round"/>
        <circle cx="5" cy="20" r="3" fill="#8b5cf6"/>
        <circle cx="20" cy="5" r="3" fill="#8b5cf6"/>
      </svg>`
    ));

    container.appendChild(createNativeToggle("Streetview Marker", "showStreetviewMarker",
      `<svg width="25" height="25" viewBox="0 0 25 25" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="12.5" cy="12.5" r="6" fill="#3B82F6" stroke="#FFFFFF" stroke-width="2"/>
      </svg>`
    ));

    const createMarkerSection = (title, titleColor, colorKey, outlineKey, sizeKey, sizeMin, sizeMax, outlineWidthKey, opacityKey) => {
      const section = document.createElement("div");
      section.style.cssText = "margin-top: 16px;";

      const sectionTitle = document.createElement("div");
      sectionTitle.className = "section_sectionHeader___QLJB section_sizeMedium__CuXRP section_variantLight__G_gsY";
      sectionTitle.style.cssText = "margin-bottom: 12px;";

      const barsRoot = document.createElement("div");
      barsRoot.className = "bars_root__tryg2 bars_variantLight__r_x6H";
      barsRoot.style.cssText = "display: flex; align-items: center; gap: 12px;";

      const barsContent = document.createElement("span");
      barsContent.className = "bars_content__Nw_TD";
      barsContent.style.cssText = "flex-shrink: 0;";

      const h3 = document.createElement("h3");
      h3.textContent = title;
      h3.style.cssText = `font-size: 14px; color: ${GG.settings[colorKey]}; font-weight: 600;`;
      barsContent.appendChild(h3);

      const barsAfter = document.createElement("div");
      barsAfter.className = "bars_after__50_BW";
      barsAfter.style.cssText = "flex: 1; height: 1px; background: rgba(255, 255, 255, 0.1);";

      barsRoot.appendChild(barsContent);
      barsRoot.appendChild(barsAfter);
      sectionTitle.appendChild(barsRoot);
      section.appendChild(sectionTitle);

      const colorFlexContainer = document.createElement("div");
      colorFlexContainer.className = "flex_flex__Rxtgm flex_direction__Fa3Gs flex_gap__sXfgm flex_justify__2rGZO flex_align__PRoee";
      colorFlexContainer.style.cssText = "display: flex; flex-direction: row; gap: 16px; justify-content: space-between; align-items: center; margin-bottom: 16px;";

      const createColorPicker = (label, settingKey) => {
        const colorContainer = document.createElement("div");
        colorContainer.className = "flex_flex__Rxtgm flex_direction__Fa3Gs flex_gap__sXfgm flex_justify__2rGZO flex_align__PRoee";
        colorContainer.style.cssText = "display: flex; flex-direction: column; gap: 4px; justify-content: flex-start; align-items: stretch; flex: 1;";

        const colorLabel = document.createElement("label");
        colorLabel.className = "label_label__9xkbh shared_white60Variant__EC173 shared_boldWeight__U2puG label_italic__LM62Y";
        colorLabel.style.cssText = "font-size: 14px; line-height: 1.4; color: rgba(255, 255, 255, 0.6); font-weight: 600; font-style: italic;";
        colorLabel.textContent = label;

        const colorInputContainer = document.createElement("div");
        colorInputContainer.className = "flex_flex__Rxtgm flex_direction__Fa3Gs flex_gap__sXfgm flex_justify__2rGZO flex_align__PRoee";
        colorInputContainer.style.cssText = "display: flex; flex-direction: row; gap: 8px; justify-content: flex-start; align-items: center; position: relative;";

        const colorPreview = document.createElement("div");
        colorPreview.style.cssText = `
          width: 32px;
          height: 32px;
          border-radius: 4px;
          background: ${GG.settings[settingKey]};
          border: 2px solid rgba(255, 255, 255, 0.2);
          cursor: pointer;
        `;

        const colorInput = document.createElement("input");
        colorInput.type = "color";
        colorInput.value = GG.settings[settingKey];
        colorInput.style.cssText = `
          width: 32px;
          height: 32px;
          opacity: 0;
          position: absolute;
          cursor: pointer;
        `;

        const colorHex = document.createElement("label");
        colorHex.className = "label_label__9xkbh shared_boldWeight__U2puG label_italic__LM62Y";
        colorHex.style.cssText = "font-size: 14px; line-height: 1.4; font-weight: 600; font-style: italic; min-width: 70px; color: #fff;";
        colorHex.textContent = GG.settings[settingKey];

        colorInput.addEventListener("input", function () {
          GG.settings[settingKey] = this.value;
          colorPreview.style.background = this.value;
          colorHex.textContent = this.value;
          if (settingKey === colorKey) {
            h3.style.color = this.value;
          }
          GG.saveSettings();
          if (typeof GG.updateMarkerStyle === 'function') GG.updateMarkerStyle();
          if (typeof GG.updateStreetviewMarkerStyle === 'function') GG.updateStreetviewMarkerStyle();
        });

        colorInputContainer.appendChild(colorPreview);
        colorInputContainer.appendChild(colorInput);
        colorContainer.appendChild(colorLabel);
        colorContainer.appendChild(colorInputContainer);
        colorContainer.appendChild(colorHex);

        return colorContainer;
      };

      colorFlexContainer.appendChild(createColorPicker("Color", colorKey));
      colorFlexContainer.appendChild(createColorPicker("Outline", outlineKey));
      section.appendChild(colorFlexContainer);

      const createSlider = (labelText, settingKey, min, max, step, unit, iconFn) => {
        const sliderContainer = document.createElement("div");
        sliderContainer.className = "slider-option_wrapper__3gsTQ";
        sliderContainer.style.cssText = "margin-bottom: 16px; display: flex; align-items: center; gap: 12px;";

        const icon = document.createElement("div");
        icon.className = "slider-option_icon__qtnY8";
        icon.style.cssText = "flex-shrink: 0; width: 24px; height: 24px;";
        icon.innerHTML = iconFn(GG.settings[settingKey]);

        const label = document.createElement("div");
        label.className = "slider-option_label__HSXrJ";
        label.style.cssText = "flex: 1; font-size: 14px; color: #fff;";
        label.textContent = labelText;

        const valueContainer = document.createElement("form");
        valueContainer.className = "slider-option_value__OM__C";
        valueContainer.style.cssText = "flex-shrink: 0; min-width: 40px; text-align: right;";

        const valueLabel = document.createElement("div");
        valueLabel.className = "slider-option_valueLabel__XS837";
        valueLabel.style.cssText = "font-size: 14px; color: #fff;";
        const displayVal = unit === "%" ? Math.round(GG.settings[settingKey] * 100) : (step < 1 ? GG.settings[settingKey].toFixed(1) : GG.settings[settingKey]);
        valueLabel.textContent = `${displayVal}${unit}`;

        valueContainer.appendChild(valueLabel);

        const sliderWrapper = document.createElement("div");
        sliderWrapper.className = "slider-option_slider__kJaCT";
        sliderWrapper.style.cssText = "flex: 1; max-width: 150px;";

        const slider = document.createElement("div");
        slider.className = "styles_rangeslider__8vVg3 styles_variantPurple__1s1cU";
        slider.style.cssText = "position: relative; width: 100%; height: 8px; background: rgba(255, 255, 255, 0.2); border-radius: 4px; cursor: pointer;";

        const currentVal = unit === "%" ? GG.settings[settingKey] * 100 : GG.settings[settingKey];
        const effectiveMin = unit === "%" ? min * 100 : min;
        const effectiveMax = unit === "%" ? max * 100 : max;

        const fill = document.createElement("div");
        fill.className = "styles_fill__9MeZ9";
        fill.style.cssText = `position: absolute; left: 0; top: 0; height: 100%; background: #8b5cf6; border-radius: 4px; width: ${((currentVal - effectiveMin) / (effectiveMax - effectiveMin)) * 100}%;`;

        const handle = document.createElement("div");
        handle.className = "styles_handle__h9ytQ";
        handle.tabIndex = 0;
        handle.style.cssText = `position: absolute; top: 50%; transform: translateY(-50%); width: 16px; height: 16px; background: #fff; border-radius: 50%; border: 2px solid #8b5cf6; cursor: grab; left: ${((currentVal - effectiveMin) / (effectiveMax - effectiveMin)) * 100}%;`;
        handle.innerHTML = "<div></div>";

        slider.appendChild(fill);
        slider.appendChild(handle);
        sliderWrapper.appendChild(slider);

        sliderContainer.appendChild(icon);
        sliderContainer.appendChild(label);
        sliderContainer.appendChild(valueContainer);
        sliderContainer.appendChild(sliderWrapper);

        let isDragging = false;
        const updateFromEvent = (e) => {
          const rect = slider.getBoundingClientRect();
          let x = e.clientX - rect.left;
          x = Math.max(0, Math.min(x, rect.width));
          const percent = x / rect.width;
          let newValue = effectiveMin + (effectiveMax - effectiveMin) * percent;
          const effectiveStep = unit === "%" ? step * 100 : step;
          const stepped = effectiveStep ? Math.round(newValue / effectiveStep) * effectiveStep : newValue;
          const clamped = Math.max(effectiveMin, Math.min(stepped, effectiveMax));

          fill.style.width = `${((clamped - effectiveMin) / (effectiveMax - effectiveMin)) * 100}%`;
          handle.style.left = `${((clamped - effectiveMin) / (effectiveMax - effectiveMin)) * 100}%`;
          
          const displayValue = unit === "%" ? Math.round(clamped) : (step < 1 ? clamped.toFixed(1) : Math.round(clamped));
          valueLabel.textContent = `${displayValue}${unit}`;

          const settingsValue = unit === "%" ? clamped / 100 : clamped;
          GG.settings[settingKey] = settingsValue;
          icon.innerHTML = iconFn(settingsValue);
          GG.saveSettings();
          if (typeof GG.updateMarkerStyle === 'function') GG.updateMarkerStyle();
          if (typeof GG.updateStreetviewMarkerStyle === 'function') GG.updateStreetviewMarkerStyle();
        };

        handle.addEventListener("mousedown", (e) => {
          e.preventDefault();
          isDragging = true;
          const onMouseMove = (e) => { if (isDragging) updateFromEvent(e); };
          const onMouseUp = () => {
            isDragging = false;
            document.removeEventListener("mousemove", onMouseMove);
            document.removeEventListener("mouseup", onMouseUp);
          };
          document.addEventListener("mousemove", onMouseMove);
          document.addEventListener("mouseup", onMouseUp);
        });

        slider.addEventListener("click", (e) => { if (!isDragging) updateFromEvent(e); });

        return sliderContainer;
      };

      section.appendChild(createSlider("Size", sizeKey, sizeMin, sizeMax, 1, "", (val) => `
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <circle cx="12" cy="12" r="${val / 2}" fill="${GG.settings[colorKey]}" stroke="${GG.settings[outlineKey]}" stroke-width="2"/>
        </svg>
      `));

      section.appendChild(createSlider("Outline Width", outlineWidthKey, 0.5, 5, 0.1, "px", (val) => `
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <circle cx="12" cy="12" r="8" fill="none" stroke="${GG.settings[outlineKey]}" stroke-width="${val}"/>
        </svg>
      `));

      section.appendChild(createSlider("Transparency", opacityKey, 0, 1, 0.01, "%", (val) => `
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <circle cx="12" cy="12" r="8" fill="${GG.settings[colorKey]}" fill-opacity="${val}" stroke="${GG.settings[outlineKey]}" stroke-width="2"/>
        </svg>
      `));

      return section;
    };

    container.appendChild(createMarkerSection("Ghost Marker", "#FF0000", "markerColor", "outlineColor", "size", 5, 20, "outlineWidth", "opacity"));
    container.appendChild(createMarkerSection("Streetview Marker", "#3B82F6", "streetviewMarkerColor", "streetviewMarkerOutline", "streetviewMarkerSize", 3, 15, "streetviewMarkerOutlineWidth", "streetviewMarkerOpacity"));

    return container;
  };

  const buildStreamerModeToggle = () => {
    if (GG.isElectron || GG.isSteam) return null;
    
    const toggleContainer = document.createElement("div");
    toggleContainer.className = "game-menu_optionsContainer__Eafrd";
    toggleContainer.style.transform = "translateX(-2px)";
    toggleContainer.style.marginLeft = "-2px";

    const option = document.createElement("label");
    option.className =
      "game-options_option__xQZVa game-options_editableOption__0hL4c";
    option.style.cssText = `
        width: 400px;
        max-width: 400px;
        min-width: 400px;
        display: flex;
        align-items: center;
        justify-content: space-between;
    `;

    const labelWrap = document.createElement("div");
    labelWrap.className = "game-menu_imgAndLabelWrapper__tHcGz";

    const icon = document.createElement("img");
    icon.alt = "";
    icon.loading = "lazy";
    icon.width = 25;
    icon.height = 25;
    icon.decoding = "async";
    icon.setAttribute("data-nimg", "1");
    icon.className = "game-menu_fullscreenIcon__agaGg";
    icon.style.color = "transparent";

    icon.src =
      "data:image/svg+xml," +
      encodeURIComponent(
        `<svg width="25" height="25" viewBox="0 0 25 25" fill="none" xmlns="http://www.w3.org/2000/svg">
          <circle cx="12.5" cy="12.5" r="9" fill="#8b5cf6"/>
          <path d="M8 12.5h3m3 0h3m-6-3v6" stroke="#ffffff" stroke-width="2" stroke-linecap="round"/>
        </svg>`,
      );

    const labelText = document.createElement("div");
    labelText.className = "game-options_optionLabel__Vk5xN";
    labelText.textContent = "Streamer Mode (WIP)";

    const inputWrap = document.createElement("div");
    inputWrap.className = "game-options_optionInput__paPBZ";

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.className = "toggle_toggle__qfXpL";
    checkbox.checked = Boolean(GG.settings.streamerMode);

    checkbox.addEventListener("change", function () {
      GG.settings.streamerMode = checkbox.checked;
      GG.saveSettings();
      if (typeof GG.applyStreamerMode === "function") {
        GG.applyStreamerMode();
      }
    });

    labelWrap.appendChild(icon);
    labelWrap.appendChild(labelText);
    inputWrap.appendChild(checkbox);
    option.appendChild(labelWrap);
    option.appendChild(inputWrap);

    toggleContainer.appendChild(option);

    return toggleContainer;
  };

  GG.showUpdateNotification = function(newHash) {
    if (document.getElementById('gg-update-banner')) return;
    
    if (!document.body) {
        setTimeout(() => GG.showUpdateNotification(newHash), 500);
        return;
    }

    const banner = document.createElement('div');
    banner.id = 'gg-update-banner';
    banner.style.cssText = `
      position: fixed;
      top: 20px;
      left: 20px;
      right: auto;
      width: auto;
      max-width: 400px;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      padding: 16px;
      display: flex;
      flex-direction: column;
      align-items: flex-start;
      gap: 12px;
      z-index: 2147483647;
      box-shadow: 0 8px 32px rgba(0,0,0,0.4);
      font-family: 'Neo Sans', sans-serif;
      animation: slideDown 0.3s ease-out;
      border-radius: 12px;
      pointer-events: auto;
      border: 1px solid rgba(255,255,255,0.1);
    `;

    const style = document.createElement('style');
    style.textContent = `
      @keyframes slideDown {
        from { transform: translateY(-100%); }
        to { transform: translateY(0); }
      }
    `;
    document.head.appendChild(style);

    const leftContent = document.createElement('div');
    leftContent.style.cssText = 'display: flex; align-items: center; gap: 12px;';

    const icon = document.createElement('div');
    icon.innerHTML = `
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M12 16L12 8" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        <path d="M9 13L12 16L15 13" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        <path d="M17 21H7C5.89543 21 5 20.1046 5 19V5C5 3.89543 5.89543 3 7 3H12.5" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        <circle cx="18" cy="5" r="3" fill="#3bf7bf" stroke="none"/>
      </svg>
    `;
    icon.style.display = 'flex';

    const text = document.createElement('div');
    text.innerHTML = `
      <div style="font-weight: bold; font-size: 14px;">GhostGuessr Update Available!</div>
      <div style="font-size: 12px; opacity: 0.9;">A new version is ready to download</div>
    `;

    leftContent.appendChild(icon);
    leftContent.appendChild(text);

    const rightContent = document.createElement('div');
    rightContent.style.cssText = 'display: flex; align-items: center; gap: 10px; width: 100%;';

    const viewButton = document.createElement('button');
    viewButton.textContent = 'View on GitHub';
    viewButton.style.cssText = `
      background: rgba(255,255,255,0.2);
      border: 1px solid rgba(255,255,255,0.3);
      color: white;
      padding: 8px 16px;
      border-radius: 6px;
      cursor: pointer;
      font-size: 13px;
      font-weight: 600;
      transition: all 0.2s;
      width: 100%;
      text-align: center;
    `;
    viewButton.onmouseover = () => {
      viewButton.style.background = 'rgba(255,255,255,0.3)';
    };
    viewButton.onmouseout = () => {
      viewButton.style.background = 'rgba(255,255,255,0.2)';
    };
    viewButton.onclick = () => {
      window.open(GG.GITHUB_URL, '_blank');
    };

    rightContent.appendChild(viewButton);

    banner.appendChild(leftContent);
    banner.appendChild(rightContent);

    document.body.appendChild(banner);
  };

  GG.createSvg = function (color) {
    return `
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style="color: transparent;">
                <circle cx="12" cy="12" r="8" fill="currentColor" stroke="white" stroke-width="2"/>
                <circle cx="12" cy="12" r="6" fill="${color}"/>
            </svg>
        `;
  };

  GG.getSettingsContainer = function () {
    return (
      document.querySelector('[class*="duels-settings_columns__"]') ||
      document.querySelector(
        '[class*="settings_root__"] [class*="settings_container__"]',
      ) ||
      document.querySelector('[class*="settings_sectionContainer__"]') ||
      document.querySelector('[class*="game-menu_settingsContainer__"]')
    );
  };

  GG.createToggleButton = function () {
    if (document.querySelector('[data-qa="ghostguessr-toggle"]')) {
      GG.toggleButton = document.querySelector(
        '[data-qa="ghostguessr-toggle"]',
      );
      GG.buttonCreated = true;
      GG.updateButtonState();
      return;
    }

    let buttonContainer =
      document.querySelector('[class*="styles_columnTwo__"]') ||
      document.querySelector(".ghostguessr-columnTwo");
    let createdColumnTwo = false;
    if (!buttonContainer) {
      const controlsRoot =
        document.querySelector('[class*="styles_root__"]') ||
        document.querySelector('[class*="game_controls__"]');
      const columnOne = document.querySelector('[class*="styles_columnOne__"]');
      if (controlsRoot && columnOne && columnOne.parentNode === controlsRoot) {
        const columnTwoClass = getClassByPrefix(
          controlsRoot,
          "styles_columnTwo__",
        );
        buttonContainer = document.createElement("div");
        buttonContainer.className = columnTwoClass || "ghostguessr-columnTwo";
        if (!columnTwoClass) {
          buttonContainer.style.cssText =
            "display: flex; flex-direction: column; gap: 8px; justify-content: center; align-items: center; margin-left: 8px;";
        }
        controlsRoot.insertBefore(buttonContainer, columnOne.nextSibling);
        createdColumnTwo = true;
      }
    }
    if (!buttonContainer) return;

    const sampleButtonInContainer = Array.from(
      buttonContainer.querySelectorAll("button"),
    ).find((button) => !button.disabled);
    const sampleButton =
      sampleButtonInContainer ||
      document.querySelector('[data-qa="in-game-settings-button"]') ||
      document.querySelector('[data-qa="pano-zoom-in"]') ||
      document.querySelector('[data-qa="pano-zoom-out"]');
    const sampleControl =
      (sampleButton && sampleButton.closest('[class*="styles_control__"]')) ||
      document.querySelector('[class*="styles_control__"]');
    const sampleTooltipRef =
      buttonContainer.querySelector('[class*="tooltip_reference__"]') ||
      (sampleButton &&
        sampleButton.closest('[class*="tooltip_reference__"]')) ||
      document.querySelector('[class*="tooltip_reference__"]');
    const sampleTooltip =
      (sampleTooltipRef &&
        sampleTooltipRef.querySelector('[class*="tooltip_tooltip__"]')) ||
      buttonContainer.querySelector('[class*="tooltip_tooltip__"]');
    const sampleTooltipArrow =
      sampleTooltip &&
      sampleTooltip.querySelector('[class*="tooltip_arrow__"]');
    const tooltipFromContainer =
      sampleTooltip && buttonContainer.contains(sampleTooltip);

    if (!GG.toggleActiveClass) {
      GG.toggleActiveClass = getClassByPrefix(sampleButton, "styles_active__");
    }

    let controlDiv = document.createElement("div");
    controlDiv.className = sampleControl
      ? sampleControl.className
      : "styles_control__Pa4Ta";

    let tooltipRef = document.createElement("span");
    tooltipRef.className = sampleTooltipRef
      ? sampleTooltipRef.className
      : "tooltip_reference__CwDbn";

    GG.toggleButton = document.createElement("button");
    GG.toggleButton.className = sampleButton
      ? sampleButton.className
      : "styles_hudButton__kzfFK styles_sizeSmall__O7Bw_ styles_roundBoth__hcuEN";
    GG.toggleButton.setAttribute("data-qa", "ghostguessr-toggle");

    let svgContainer = document.createElement("div");
    svgContainer.style.cssText = "transform: none;";
    svgContainer.innerHTML = GG.createSvg(
      GG.settings.enabled ? "#00FF00" : "#FF0000",
    );
    GG.toggleButton.appendChild(svgContainer);

    let tooltip = document.createElement("div");
    tooltip.className =
      sampleTooltip && !createdColumnTwo && tooltipFromContainer
        ? sampleTooltip.className
        : "tooltip_tooltip__3D6bz tooltip_right__wLi_G tooltip_roundnessXS__BGhWu tooltip_variantDefault__7WTJ0 tooltip_hideOnXs__S3erz";
    tooltip.style.cssText =
      "top: 50%; transform: translateY(-50%) scale(0); opacity: 0; visibility: hidden; --tooltip-width: none;";

    let tooltipText = document.createElement("div");
    tooltipText.textContent = GG.settings.enabled
      ? `Hide ghost marker (${GG.settings.hotkey})`
      : `Show ghost marker (${GG.settings.hotkey})`;

    let tooltipArrow = document.createElement("div");
    tooltipArrow.className = sampleTooltipArrow
      ? sampleTooltipArrow.className
      : "tooltip_arrow__LJ1of";

    tooltip.appendChild(tooltipText);
    tooltip.appendChild(tooltipArrow);

    tooltipRef.appendChild(GG.toggleButton);
    tooltipRef.appendChild(tooltip);
    controlDiv.appendChild(tooltipRef);
    buttonContainer.appendChild(controlDiv);

    GG.buttonCreated = true;

    GG.toggleButton.addEventListener("click", function (e) {
      e.stopPropagation();
      GG.toggleMarker();
      GG.updateButtonState();
    });

    GG.toggleButton.addEventListener("mouseenter", function () {
      tooltip.style.transform = "translateY(-50%) scale(1)";
      tooltip.style.opacity = "1";
      tooltip.style.visibility = "visible";
    });

    GG.toggleButton.addEventListener("mouseleave", function () {
      tooltip.style.transform = "translateY(-50%) scale(0)";
      tooltip.style.opacity = "0";
      tooltip.style.visibility = "hidden";
    });

    GG.updateButtonState();
  };

  GG.updateButtonState = function () {
    if (!GG.toggleButton) return;

    let svgContainer = GG.toggleButton.querySelector("div");
    if (!svgContainer) return;

    svgContainer.innerHTML = GG.createSvg(
      GG.settings.enabled ? "#00FF00" : "#FF0000",
    );

    if (GG.settings.enabled) {
      if (
        GG.toggleActiveClass &&
        !GG.toggleButton.classList.contains(GG.toggleActiveClass)
      ) {
        GG.toggleButton.classList.add(GG.toggleActiveClass);
      }
      GG.toggleButton.style.opacity = "1";
      GG.toggleButton.removeAttribute("title");

      let tooltipDiv = GG.toggleButton
        .closest('[class*="tooltip_reference__"]')
        .querySelector('[class*="tooltip_tooltip__"] div');
      if (tooltipDiv) {
        tooltipDiv.textContent = `Hide ghost marker (${GG.settings.hotkey})`;
      }
    } else {
      if (GG.toggleActiveClass) {
        GG.toggleButton.classList.remove(GG.toggleActiveClass);
      }
      GG.toggleButton.style.opacity = "0.8";
      GG.toggleButton.removeAttribute("title");

      let tooltipDiv = GG.toggleButton
        .closest('[class*="tooltip_reference__"]')
        .querySelector('[class*="tooltip_tooltip__"] div');
      if (tooltipDiv) {
        tooltipDiv.textContent = `Show ghost marker (${GG.settings.hotkey})`;
      }
    }
  };

  GG.createGhostMarkerSettings = function () {
    const settingsContainer = GG.getSettingsContainer();
    if (!settingsContainer) return;
    if (settingsContainer.querySelector(".ghostguessr-settings-container")) {
      return;
    }

    const isSteamSettings = hasClassPrefix(
      settingsContainer,
      "settings_container",
    );
    const isNewSettingsSection = hasClassPrefix(
      settingsContainer,
      "settings_sectionContainer",
    );

    const isDuelsLayout = hasClassPrefix(
      settingsContainer,
      "duels-settings_columns",
    );

    const useSteamSettingsStructure = isSteamSettings || isNewSettingsSection || isDuelsLayout;

    if (useSteamSettingsStructure) {
      let targetContainer = settingsContainer;
      
      if (isDuelsLayout) {
        const columnTwo = settingsContainer.querySelector('[class*="duels-settings_columnTwo__"]');
        if (columnTwo) {
            targetContainer = columnTwo;
        } else {
            const columns = settingsContainer.children;
             if (columns.length > 0) {
                 targetContainer = columns[columns.length - 1];
             }
        }
      }

      if (targetContainer) {
        if (!isDuelsLayout) { 
            settingsContainer.style.maxHeight = "80vh";
            settingsContainer.style.overflowY = "auto";
            settingsContainer.style.paddingRight = "120px";
        }
      }

      const ghostSettingsContainer = document.createElement("div");
      ghostSettingsContainer.className = "ghostguessr-settings-container";
      ghostSettingsContainer.style.cssText =
        "width: 100%; margin: 8px 0; padding: 0;";

      const settingsSection = document.createElement("div");
      settingsSection.className = "settings-section_root__Wt_cF"; 

      const sectionHeader = document.createElement("div");
      sectionHeader.className =
        "section_sectionHeader___QLJB section_sizeMedium__CuXRP section_variantLight__G_gsY";

      const barsRoot = document.createElement("div");
      barsRoot.className = "bars_root__tryg2 bars_variantLight__r_x6H";

      const barsContent = document.createElement("span");
      barsContent.className = "bars_content__Nw_TD";

      const h2 = document.createElement("h2");
      h2.textContent = "Ghost Marker";
      barsContent.appendChild(h2);

      const barsAfter = document.createElement("div");
      barsAfter.className = "bars_after__50_BW";

      barsRoot.appendChild(barsContent);
      barsRoot.appendChild(barsAfter);
      sectionHeader.appendChild(barsRoot);

      const sectionContent = document.createElement("div");
      sectionContent.className = "settings-section_content__LGzLT";

      const hotkeyContainer = document.createElement("div");
      hotkeyContainer.className = "slider-option_wrapper__3gsTQ";
      hotkeyContainer.style.cssText = "margin-bottom: 16px;";

      const hotkeyIcon = document.createElement("div");
      hotkeyIcon.className = "slider-option_icon__qtnY8";
      hotkeyIcon.innerHTML = `
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect x="4" y="6" width="16" height="12" rx="2" stroke="#8b5cf6" stroke-width="2" fill="none"/>
        <text x="12" y="15" text-anchor="middle" font-family="Arial" font-size="10" fill="#8b5cf6">${GG.settings.hotkey}</text>
      </svg>
    `;

      const hotkeyLabel = document.createElement("div");
      hotkeyLabel.className = "slider-option_label__HSXrJ";
      hotkeyLabel.textContent = "Hotkey";

      const hotkeyValueContainer = document.createElement("form");
      hotkeyValueContainer.className = "slider-option_value__OM__C";

      GG.hotkeyInput = document.createElement("input");
      GG.hotkeyInput.type = "text";
      GG.hotkeyInput.value = GG.settings.hotkey;
      GG.hotkeyInput.maxLength = 1;
      GG.hotkeyInput.style.cssText = `
      width: 60px;
      height: 32px;
      background: rgba(255, 255, 255, 0.1);
      border: 1px solid #8b5cf6;
      border-radius: 6px;
      color: #fff;
      padding: 0 8px;
      font-size: 14px;
      text-align: center;
      text-transform: uppercase;
      outline: none;
    `;

      GG.hotkeyInput.addEventListener("focus", function () {
        this.value = "";
      });

      GG.hotkeyInput.addEventListener("blur", function () {
        if (this.value === "") {
          this.value = GG.settings.hotkey;
        }
      });

      GG.hotkeyInput.addEventListener("input", function () {
        const key = this.value.toUpperCase();
        if (key.length > 0 && /^[A-Z0-9]$/.test(key)) {
          this.value = key;
          GG.settings.hotkey = key;
          GG.saveSettings();
          GG.setupHotkeyListener();
          GG.updateButtonState();

          hotkeyIcon.innerHTML = `
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect x="4" y="6" width="16" height="12" rx="2" stroke="#8b5cf6" stroke-width="2" fill="none"/>
            <text x="12" y="15" text-anchor="middle" font-family="Arial" font-size="10" fill="#8b5cf6">${key}</text>
          </svg>
        `;
        }
      });

      hotkeyValueContainer.appendChild(GG.hotkeyInput);
      hotkeyContainer.appendChild(hotkeyIcon);
      hotkeyContainer.appendChild(hotkeyLabel);
      hotkeyContainer.appendChild(hotkeyValueContainer);
      sectionContent.appendChild(hotkeyContainer);

      if (!GG.isElectron && !GG.isSteam) {
        const autoClaimToggle = buildAutoClaimToggle(settingsContainer);
        if (autoClaimToggle) {
          sectionContent.appendChild(autoClaimToggle);
        }
        
        const streamerModeToggle = buildStreamerModeToggle();
        if (streamerModeToggle) {
          sectionContent.appendChild(streamerModeToggle);
        }
      }

      const scorePredictorToggle = createScorePredictorToggle();
        if (scorePredictorToggle) {
          sectionContent.appendChild(scorePredictorToggle);
          const scorePredictorSettings = buildScorePredictorSettings();
          if (scorePredictorSettings) {
            sectionContent.appendChild(scorePredictorSettings);
          }
        }

      settingsSection.appendChild(sectionHeader);
      settingsSection.appendChild(sectionContent);
      ghostSettingsContainer.appendChild(settingsSection);

      const existingSections = settingsContainer.querySelectorAll(
        '[class*="settings-section_root__"]',
      );
      if (existingSections.length > 0) {
        const lastSection = existingSections[existingSections.length - 1];
        lastSection.parentNode.insertBefore(
          ghostSettingsContainer,
          lastSection.nextSibling,
        );
      } else {
        if (typeof targetContainer !== 'undefined' && targetContainer) {
            targetContainer.appendChild(ghostSettingsContainer);
        } else {
            settingsContainer.appendChild(ghostSettingsContainer);
        }
      }

      return;
    }

    document
      .querySelectorAll(".ghostguessr-setting")
      .forEach((el) => el.remove());
    const buttonsContainer = settingsContainer.querySelector(
      '[class*="buttons_buttons__"]',
    );
    const closeButton = settingsContainer.querySelector(
      'button[class*="button_button"]',
    );
    const dividers = settingsContainer.querySelectorAll(
      '[class*="game-menu_divider__"]',
    );
    const lastDivider = dividers[dividers.length - 1] || null;
    const useExistingDivider = Boolean(lastDivider);

    const ghostSettingsContainer = document.createElement("div");
    ghostSettingsContainer.className = "ghostguessr-settings-container";
    ghostSettingsContainer.style.cssText =
      "width: 100%; align-self: stretch; box-sizing: border-box; margin: 0; padding: 0;";

    if (!useExistingDivider) {
      const dividerTop = document.createElement("div");
      dividerTop.className = "game-menu_divider__IhA4t ghostguessr-setting";
      ghostSettingsContainer.appendChild(dividerTop);
    }

    const headerContainer = document.createElement("div");
    headerContainer.className =
      "game-menu_volumeContainer__aWb0Y ghostguessr-setting";

    const headerLabel = document.createElement("p");
    headerLabel.className = "game-menu_subHeader__Ul5Vl";
    headerLabel.textContent = "GhostGuessr";
    headerLabel.style.cssText = "font-size: 16px; color: #fff;";
    headerContainer.appendChild(headerLabel);

    ghostSettingsContainer.appendChild(headerContainer);

    const hotkeyContainer = document.createElement("div");
    hotkeyContainer.className =
      "game-menu_volumeContainer__aWb0Y ghostguessr-setting";

    const hotkeyLabel = document.createElement("p");
    hotkeyLabel.className = "game-menu_subHeader__Ul5Vl";
    hotkeyLabel.textContent = "Hotkey";
    hotkeyContainer.appendChild(hotkeyLabel);

    const hotkeyInputContainer = document.createElement("div");
    hotkeyInputContainer.className = "game-menu_sliderContainer__suHjk";
    hotkeyInputContainer.style.cssText =
      "display: flex; align-items: center; gap: 10px;";

    const hotkeyIcon = document.createElement("div");
    hotkeyIcon.className = "game-menu_icon__qC_vb";
    hotkeyIcon.innerHTML = `
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <rect x="4" y="6" width="16" height="12" rx="2" stroke="#8b5cf6" stroke-width="2" fill="none"/>
                <text x="12" y="15" text-anchor="middle" font-family="Arial" font-size="10" fill="#8b5cf6">${GG.settings.hotkey}</text>
            </svg>
        `;

    GG.hotkeyInput = document.createElement("button");
    GG.hotkeyInput.textContent = GG.settings.hotkey;
    GG.hotkeyInput.style.cssText = `
            flex: 1;
            height: 36px;
            background: rgba(255, 255, 255, 0.1);
            border: 1px solid #8b5cf6;
            border-radius: 6px;
            color: #fff;
            padding: 0 10px;
            font-size: 14px;
            text-align: center;
            cursor: pointer;
            transition: all 0.2s;
        `;

    let isRecording = false;

    const endRecording = (saved) => {
        isRecording = false;
        document.removeEventListener('keydown', recordKey);
        document.removeEventListener('mousedown', checkClickOutside);
        
        GG.hotkeyInput.textContent = GG.settings.hotkey;
        GG.hotkeyInput.style.background = 'rgba(255, 255, 255, 0.1)';
        GG.hotkeyInput.style.borderColor = '#8b5cf6';
        
        if (saved) {
             hotkeyIcon.innerHTML = `
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <rect x="4" y="6" width="16" height="12" rx="2" stroke="#8b5cf6" stroke-width="2" fill="none"/>
                    <text x="12" y="15" text-anchor="middle" font-family="Arial" font-size="10" fill="#8b5cf6">${GG.settings.hotkey}</text>
                </svg>
            `;
        }
    };

    const recordKey = (e) => {
        e.preventDefault();
        e.stopPropagation();

        if (e.key === 'Escape') {
            endRecording(false);
            return;
        }

        const key = e.key.toUpperCase();
        // Allow A-Z, 0-9, Space
        if (key.length === 1 && /[A-Z0-9 ]/.test(key) || key === 'SPACE') {
             const finalKey = key === ' ' ? 'SPACE' : key;
             GG.settings.hotkey = finalKey;
             GG.saveSettings();
             GG.setupHotkeyListener();
             GG.updateButtonState();
             endRecording(true);
        }
    };

    const checkClickOutside = (e) => {
        if (e.target !== GG.hotkeyInput) {
            endRecording(false);
        }
    };

    GG.hotkeyInput.onclick = () => {
        if (isRecording) {
            endRecording(false);
            return;
        }
        
        isRecording = true;
        GG.hotkeyInput.textContent = "Press any key...";
        GG.hotkeyInput.style.background = 'rgba(139, 92, 246, 0.3)';
        GG.hotkeyInput.style.borderColor = '#fff';
        
        document.addEventListener('keydown', recordKey);
        setTimeout(() => {
             document.addEventListener('mousedown', checkClickOutside);
        }, 100);
    };

    const hotkeyHelp = document.createElement("span");
    hotkeyHelp.textContent = "Press any key";
    hotkeyHelp.style.cssText =
      "font-size: 12px; color: #888; font-style: italic; min-width: 100px;";

    hotkeyInputContainer.appendChild(hotkeyIcon);
    hotkeyInputContainer.appendChild(GG.hotkeyInput);
    hotkeyInputContainer.appendChild(hotkeyHelp);
    hotkeyContainer.appendChild(hotkeyInputContainer);
    ghostSettingsContainer.appendChild(hotkeyContainer);

    if (!GG.isElectron && !GG.isSteam) {
      const autoClaimToggle = buildAutoClaimToggle(settingsContainer);
      if (autoClaimToggle) {
        autoClaimToggle.classList.add("ghostguessr-setting");
        ghostSettingsContainer.appendChild(autoClaimToggle);
      }
      
      const streamerModeToggle = buildStreamerModeToggle();
      if (streamerModeToggle) {
        streamerModeToggle.classList.add("ghostguessr-setting");
        ghostSettingsContainer.appendChild(streamerModeToggle);
      }
      
      const scorePredictorToggle = createScorePredictorToggle();
      if (scorePredictorToggle) {
        scorePredictorToggle.classList.add("ghostguessr-setting");
        ghostSettingsContainer.appendChild(scorePredictorToggle);
        const scorePredictorSettings = buildScorePredictorSettings();
        if (scorePredictorSettings) {
          scorePredictorSettings.classList.add("ghostguessr-setting");
          ghostSettingsContainer.appendChild(scorePredictorSettings);
        }
      }
    }

    if (!useExistingDivider) {
      const dividerBottom = document.createElement("div");
      dividerBottom.className = "game-menu_divider__IhA4t ghostguessr-setting";
      ghostSettingsContainer.appendChild(dividerBottom);
    }



    if (useExistingDivider && lastDivider.parentNode) {
      lastDivider.parentNode.insertBefore(
        ghostSettingsContainer,
        lastDivider.nextSibling,
      );
    } else if (closeButton && closeButton.parentNode) {
      closeButton.parentNode.insertBefore(ghostSettingsContainer, closeButton);
    } else if (buttonsContainer && buttonsContainer.parentNode) {
      buttonsContainer.parentNode.insertBefore(
        ghostSettingsContainer,
        buttonsContainer,
      );
    } else {
      settingsContainer.appendChild(ghostSettingsContainer);
    }
  };

  GG.applySkinchangerHoverZ = function (host) {
    const center = host.closest('[class*="pro-user-start-page_center"]');
    const hoverCatch = center
      ? center.querySelector('[class*="pro-user-start-page_hoverCatch"]')
      : document.querySelector('[class*="pro-user-start-page_hoverCatch"]');
    if (!hoverCatch) return;
    if (hoverCatch.dataset.ggZFixed === "1") return;

    hoverCatch.style.zIndex = "5";
    hoverCatch.dataset.ggZFixed = "1";
  };

  GG.injectSkinchangerToggle = function (initialLocalSaveOnly) {
    try {
      const host = document.querySelector(
        '[class*="pro-user-start-page_globeWrapper"]',
      );
      if (!host) return;

      GG.applySkinchangerHoverZ(host);

      if (host.querySelector("[data-gg-local-save-toggle]")) return;

      const savedToggle =
        (GG.avatarStorage &&
          GG.avatarStorage.getLocalSaveOnly &&
          GG.avatarStorage.getLocalSaveOnly()) ||
        initialLocalSaveOnly ||
        false;

      const avatarContainer = host.parentElement
        ? host.parentElement.querySelector(
            '[class*="pro-user-start-page_avatarContainer"]',
          )
        : null;
      if (avatarContainer) {
        avatarContainer.style.position = "relative";
        avatarContainer.style.zIndex = "2";
      }
      host.style.position = "relative";
      host.style.zIndex = "1";

      const toggleContainer = document.createElement("div");
      toggleContainer.setAttribute("data-gg-local-save-toggle", "1");
      toggleContainer.className = "game-menu_optionsContainer__Eafrd";
      toggleContainer.style.position = "absolute";
      toggleContainer.style.left = "50%";
      toggleContainer.style.top = "50%";
      toggleContainer.style.transform = "translate(-50%, -50%)";
      toggleContainer.style.zIndex = "2";
      toggleContainer.style.width = "auto";
      toggleContainer.style.display = "inline-flex";

      const option = document.createElement("label");
      option.className =
        "game-options_option__xQZVa game-options_editableOption__0hL4c";
      option.style.cssText = `
        display: inline-flex;
        align-items: center;
        gap: 10px;
        width: auto;
      `;

      const labelWrap = document.createElement("div");
      labelWrap.className = "game-menu_imgAndLabelWrapper__tHcGz";

      const labelText = document.createElement("div");
      labelText.className = "game-options_optionLabel__Vk5xN";
      labelText.textContent = "Skinchanger (Beta)";
      labelText.style.fontSize = "16px";

      const inputWrap = document.createElement("div");
      inputWrap.className = "game-options_optionInput__paPBZ";
      inputWrap.style.marginLeft = "0";

      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.className = "toggle_toggle__qfXpL";
      checkbox.checked = !!savedToggle;

      const updateToggleVisuals = () => {
        labelText.textContent = "Skinchanger";
      };

      updateToggleVisuals();

      checkbox.addEventListener("change", () => {
        const next = !!checkbox.checked;
        if (GG.avatarStorage && GG.avatarStorage.setLocalSaveOnly) {
          GG.avatarStorage.setLocalSaveOnly(next);
        } else if (typeof GM_setValue === "function") {
          try {
            GM_setValue("gg_local_save_only_v1", next);
          } catch {}
        }
        updateToggleVisuals();
        location.reload();
      });

      labelWrap.appendChild(labelText);
      inputWrap.appendChild(checkbox);
      option.appendChild(labelWrap);
      option.appendChild(inputWrap);
      toggleContainer.appendChild(option);

      const img = host.querySelector("img");
      if (img && img.parentNode === host) {
        if (!host.style.position) host.style.position = "relative";
        img.insertAdjacentElement("afterend", toggleContainer);
      } else {
        host.appendChild(toggleContainer);
      }
    } catch {}
  };

  const _ggSkinMo = new MutationObserver(() => {
    try {
      GG.injectSkinchangerToggle();
    } catch {}
  });
  _ggSkinMo.observe(document.documentElement, {
    childList: true,
    subtree: true,
  });
})();



(function () {
  "use strict";

  const GG = window.GhostGuessr;
  const hasGMStorage = GG.hasGMStorage;

  GG.storageGet = function(key, fallback) {
    if (hasGMStorage) {
      try {
        return GM_getValue(key, fallback);
      } catch (e) {
        console.warn("[GG Storage] GM_getValue failed:", e);
      }
    }
    try {
      const raw = window.localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (e) {
      console.warn("[GG Storage] localStorage.getItem failed:", e);
      return fallback;
    }
  };

  GG.storageSet = function(key, value) {
    if (hasGMStorage) {
      try {
        GM_setValue(key, value);
        return;
      } catch (e) {
        console.warn("[GG Storage] GM_setValue failed:", e);
      }
    }
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
    } catch (e) {
      console.warn("[GG Storage] localStorage.setItem failed:", e);
    }
  };

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
      window.localStorage.setItem(
        "ghostguessr_settings",
        JSON.stringify(value),
      );
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
    if (GG.isElectron || GG.isSteam) return;
    
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
    if (GG.isElectron || GG.isSteam) return;
    
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

  (function () {
    const STORE_KEY = "gg_avatar_equippedIds_v1";
    const STORE_TOGGLE = "gg_local_save_only_v1";

    function readStored(key, fallback) {
      if (hasGMStorage) {
        try {
          return GM_getValue(key, fallback);
        } catch {}
      }
      try {
        const raw = window.localStorage.getItem(key);
        return raw ? JSON.parse(raw) : fallback;
      } catch {}
      return fallback;
    }

    function writeStored(key, value) {
      if (hasGMStorage) {
        try {
          GM_setValue(key, value);
          return;
        } catch {}
      }
      try {
        window.localStorage.setItem(key, JSON.stringify(value));
      } catch {}
    }

    GG.avatarStorage = {
      getSaved() {
        return readStored(STORE_KEY, null);
      },
      setSaved(obj) {
        writeStored(STORE_KEY, obj);
      },
      clearSaved() {
        writeStored(STORE_KEY, null);
      },
      getLocalSaveOnly() {
        return readStored(STORE_TOGGLE, true);
      },
      setLocalSaveOnly(value) {
        writeStored(STORE_TOGGLE, !!value);
        GG.avatarStorage.sendToggleToPage(!!value);
      },
      sendEquippedToPage(ids) {
        try {
          window.postMessage(
            { type: "GG_AVATAR_APPLY_EQUIPPED_IDS", equippedIds: ids },
            "*",
          );
        } catch {}
      },
      sendToggleToPage(value) {
        try {
          window.postMessage(
            { type: "GG_AVATAR_LOCAL_SAVE_ONLY", value: !!value },
            "*",
          );
        } catch {}
      },
    };

    try {
      if (typeof unsafeWindow !== "undefined") {
        unsafeWindow.GG_AvatarLocalSave = GG.avatarStorage;
      } else {
        window.GG_AvatarLocalSave = GG.avatarStorage;
      }
    } catch {}
  })();
})();



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


