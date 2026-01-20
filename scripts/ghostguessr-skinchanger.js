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