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
  const MSG_STORE_ORIGINAL = "GG_AVATAR_STORE_ORIGINAL";
  const MSG_RESTORE_ORIGINAL = "GG_AVATAR_RESTORE_ORIGINAL";
  const MSG_REFRESH_AVATAR = "GG_AVATAR_REFRESH";
  const MSG_USER_ID = "GG_AVATAR_USER_ID";

  const SAVE_PATH = "/api/v4/avatar/save";
  const AVATAR_USER = "/api/v4/avatar/user";
  const AVATAR_USER_PREFIX = "/api/v4/avatar/user/";
  const CUSTOMIZATION = "/api/v4/customization";
  const SHOP_FEATURED = "/api/v4/webshop/featured-deals/world-championship";
  const SHOP_FEATURED_GENERIC = "/api/v4/webshop/featured-deals";
  const SHOP_COMMON = "/api/v4/webshop/common-products";
  const SHOP_CREATOR = "/api/v4/webshop/creator-shop/products";
  const SHOP_CONVEYOR = "/api/v4/webshop/conveyor-belt";
  const PROFILES = "/api/v3/profiles/";
  const RANKED_TEAMS_PREFIX = "/api/v4/ranked-team-duels/me/teams/";
  const ELITE_DAYS = "/api/v4/customization/elite-days";

  const hasGMStorage = typeof GM_getValue === "function" && typeof GM_setValue === "function";

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

  function arraysEqual(a, b) {
    if (a === b) return true;
    if (!Array.isArray(a) || !Array.isArray(b)) return false;
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
        if (a[i] !== b[i]) return false;
    }
    return true;
  }

  function toPath(urlLike) {
    const s = String(urlLike || "");
    if (s.startsWith("http")) {
        try { return new URL(s).pathname; } catch { return s.split("?")[0]; }
    }
    return s.split("?")[0];
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

  function tryParseEquippedIds(bodyText) {
    try {
        const data = JSON.parse(bodyText);
        const ids = data && Array.isArray(data.equippedIds) ? data.equippedIds : null;
        return Array.isArray(ids) ? ids.filter((x) => typeof x === "string") : null;
    } catch {
        return null;
    }
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

  function sendEquippedToPage(ids) {
    try { window.postMessage({ type: MSG_APPLY, equippedIds: ids }, "*"); } catch {}
  }
  function sendToggleToPage(value) {
    try { window.postMessage({ type: MSG_TOGGLE, value: !!value }, "*"); } catch {}
  }

  const saved = storageGet(STORE_KEY, null);
  const initialEquipped = saved && Array.isArray(saved.equippedIds) ? saved.equippedIds : [];
  const initialUserId = saved && saved.userId ? saved.userId : null;
  const initialSavedAssets = saved && Array.isArray(saved.savedAssets) ? saved.savedAssets : [];
  const initialLocalSaveOnly = storageGet(STORE_TOGGLE, true);

  let savedEquippedIds = Array.isArray(initialEquipped) ? initialEquipped.filter((x) => typeof x === "string") : [];
  let localSaveOnly = !!initialLocalSaveOnly;
  let profileNick = null;
  let profileUserId = initialUserId || null;
  const assetsById = new Map();

  if (initialSavedAssets.length) {
      console.log('[GG Skinchanger] Restoring cached assets:', initialSavedAssets.length);
      for (const asset of initialSavedAssets) {
          if (asset && typeof asset.id === "string") {
              assetsById.set(asset.id, asset);
          }
      }
  }
  
  let assetsReadyResolve = null;
  let assetsReadyPromise = null;
  let originalAvatarData = null;
  let isRefreshing = false;
  let refreshDebounceTimer = null;

  function triggerAvatarRefresh() {
      console.log('[GG Skinchanger] Triggering avatar refresh');
      const currentPath = window.location.pathname + window.location.search;
      if (window.unsafeWindow && window.unsafeWindow.next && window.unsafeWindow.next.router) {
         try {
             window.unsafeWindow.next.router.replace(currentPath, undefined, { shallow: false });
             return;
         } catch (e) { console.warn(e); }
      }
      try {
        const currentUrl = window.location.href;
        window.history.pushState({}, '', currentPath + (currentPath.includes('?') ? '&' : '?') + '_gg_refresh=' + Date.now());
        window.history.replaceState({}, '', currentUrl);
        window.dispatchEvent(new PopStateEvent('popstate', { state: {} }));
      } catch (e) {}
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

  function haveAllSavedAssets() {
      if (!Array.isArray(savedEquippedIds) || !savedEquippedIds.length) return false;
      for (const id of savedEquippedIds) {
          if (!assetsById.has(id)) return false;
      }
      return true;
  }
  
  function getSavedIdSet() {
      return new Set(Array.isArray(savedEquippedIds) ? savedEquippedIds.filter(x => typeof x === "string") : []);
  }

  function buildAvatarPayload() {
    const equipped = [];
    for (const id of savedEquippedIds) {
        const asset = assetsById.get(id);
        if (asset) equipped.push(asset);
    }
    return { equipped, equippedBadge: null, borderUrl: getEquippedBorderUrl() };
  }

  function processData(data, opts = {}) {
        if (!data || typeof data !== "object") return;
        
        const seen = new Set();
        const MAX_ASSETS = 2000;
        let assetCount = 0;

        function maybeStoreAsset(obj) {
            if (!obj || typeof obj !== "object") return;
            const id = obj.id;
            if (typeof id !== "string") return;
            if (opts.filterSet && !opts.filterSet.has(id)) return;
            
            const looksLikeAsset =
                typeof obj.slot === "number" ||
                typeof obj.meshGlb === "string" ||
                typeof obj.texture === "string" ||
                typeof obj.icon === "string";

            if (looksLikeAsset) {
                 if (assetCount >= MAX_ASSETS) return;
                 if (!assetsById.has(id)) {
                    assetsById.set(id, obj);
                    assetCount++;
                 }
            }
        }

        function walk(obj, depth) {
            if (!obj || typeof obj !== "object") return;
            if (seen.has(obj)) return;
            if (depth > 50 || seen.size > 20000) return;
            seen.add(obj);

            if (Array.isArray(obj)) {
                for (let i = 0; i < obj.length; i++) {
                    walk(obj[i], depth + 1);
                }
                return;
            }
            const looksLikeAsset = 
                (typeof obj.slot === "number") ||
                (typeof obj.rarity === "string") ||
                (typeof obj.id === "string" && (typeof obj.icon === "string" || typeof obj.image === "string"));

            if (looksLikeAsset) {
                if (opts.unlock) obj.unlocked = true;
                if (opts.ownership) {
                    obj.isEliteExclusive = false;
                    obj.isOwned = true;
                    obj.isInUserInventory = true;
                }
                if (opts.emptyReqs) obj.requirements = [];
            } else {
                if (opts.unlock && obj.hasOwnProperty("unlocked")) obj.unlocked = true;
                if (opts.ownership) {
                     if (obj.hasOwnProperty("isEliteExclusive")) obj.isEliteExclusive = false;
                     if (obj.hasOwnProperty("isOwned")) obj.isOwned = true;
                     if (obj.hasOwnProperty("isInUserInventory")) obj.isInUserInventory = true;
                }
                if (opts.emptyReqs && Array.isArray(obj.requirements)) obj.requirements = [];
            }

            if (opts.nullProduct) {
                if (obj.hasOwnProperty("product")) obj.product = null;
            }

            if (opts.collectAssets) {
                if (obj.asset) maybeStoreAsset(obj.asset);
                else maybeStoreAsset(obj);
            }
            
            if (opts.eliteProfile) {
                 if (opts.isProfilesPath && obj.user && typeof obj.user === 'object') {
                    const u = obj.user;
                    if (typeof u.id === 'string' && u.id) profileUserId = u.id;
                    if (typeof u.nick === 'string' && u.nick) profileNick = u.nick;
                    else if (typeof u.userName === 'string') profileNick = u.userName;
                    else if (typeof u.username === 'string') profileNick = u.username;
                    
                    if (profileUserId && u.id === profileUserId) {
                         u.type = "Elite";
                         const b = getEquippedBorderUrl();
                         if (b) u.borderUrl = b;
                    }
                 }
                 if (opts.isRankedTeamPath && obj.userId && (obj.userId === profileUserId || (profileNick && obj.nick === profileNick))) {
                     const b = getEquippedBorderUrl();
                     if (b) obj.borderUrl = b;
                 }
            }

            for (const key in obj) {
                if (Object.prototype.hasOwnProperty.call(obj, key)) {
                    walk(obj[key], depth + 1);
                }
            }
        }
        
        try {
            walk(data, 0);

            if (opts.collectAssets && assetCount > 0) {
                 markAssetsReady();
                 filterSavedEquippedIds();
            }
        } catch (e) {
            console.error('[GG Skinchanger] processData error:', e);
        }
  }

  function markAssetsReady() {
    if (assetsReadyResolve && haveAllSavedAssets()) {
        assetsReadyResolve(true);
        assetsReadyResolve = null;
    }
  }
  
  function filterSavedEquippedIds() {
      if (!Array.isArray(savedEquippedIds) || !savedEquippedIds.length) return;
      if (!assetsById.size) return;
      if (!haveAllSavedAssets()) return;
      
      const valid = savedEquippedIds.filter((id) => assetsById.has(id));
      if (arraysEqual(savedEquippedIds, valid)) return;
      
      console.log('[GG Skinchanger] Filtering and saving equipped IDs:', valid);
      savedEquippedIds = valid;
      
      const savedAssets = [];
      for (const id of valid) {
          if (assetsById.has(id)) savedAssets.push(assetsById.get(id));
      }

      storageSet(STORE_KEY, { userId: profileUserId, equippedIds: valid, savedAssets, savedAt: Date.now() });
      window.postMessage({ type: MSG_SAVE, equippedIds: valid }, "*");
  }
  function gmFetch(url, options = {}) {
     if (typeof GM === "undefined" || !GM.xmlHttpRequest) return Promise.reject("GM missing");
     return new Promise((resolve, reject) => {
         const headers = options.headers || {};
         GM.xmlHttpRequest({
             method: options.method || "GET",
             url: url,
             headers: headers,
             data: options.body,
             onload: (res) => {
                 resolve(new Response(res.responseText, {
                     status: res.status,
                     statusText: res.statusText,
                 }));
             },
             onerror: (err) => reject(err)
         });
     });
  }

  function internalFetch(url, options) {
      return gmFetch(url, options);
  }

  function fetchOriginalAvatarFromServer() {
      return internalFetch(AVATAR_USER, {
        method: "GET",
        headers: {
            "accept": "*/*",
            "content-type": "application/json",
            "x-client": "web",
            "cache-control": "no-cache"
        }
      })
      .then(res => res.json())
      .then(data => {
          console.log('[GG Skinchanger] Fetched original avatar:', data);
          return data;
      })
      .catch(e => {
          console.warn('[GG Skinchanger] Fetch original failed:', e);
          return null;
      });
  }
  
  function fetchOwnProfile() {
      return internalFetch(PROFILES, {
          method: "GET",
          headers: { "accept": "*/*", "x-client": "web" }
      })
      .then(res => res.json())
      .then(data => {
          const user = data && data.user;
          if (user && user.id) {
              profileUserId = user.id;
              window.postMessage({ type: MSG_USER_ID, userId: profileUserId }, "*");
          }
          if (user) {
              if (user.nick) profileNick = user.nick;
              else if (user.userName) profileNick = user.userName;
              else if (user.username) profileNick = user.username;
          }
      })
      .catch(() => {});
  }

  function ensureAssetsReady() {
      if (haveAllSavedAssets()) return Promise.resolve(true);
      if (!assetsReadyPromise) {
          assetsReadyPromise = new Promise(resolve => {
              assetsReadyResolve = resolve;
          });
          internalFetch(CUSTOMIZATION, { credentials: "include" })
          .then(async res => {
            try {
                const data = await res.clone().json();
                const filterSet = localSaveOnly ? getSavedIdSet() : null;
                processData(data, { unlock: true, collectAssets: true, filterSet });
                
                if (assetsReadyResolve) {
                    assetsReadyResolve(true);
                    assetsReadyResolve = null;
                }
            } catch (e) { console.warn(e); }
          })
          .catch(() => {})
          .finally(() => {
              setTimeout(() => {
                  if (assetsReadyResolve) {
                      assetsReadyResolve(true);
                      assetsReadyResolve = null;
                  }
              }, 1500);
          });
      }
      return assetsReadyPromise;
  }
  
  function refreshShopData() {
      if (isRefreshing) return;
      if (refreshDebounceTimer) clearTimeout(refreshDebounceTimer);
      refreshDebounceTimer = setTimeout(() => {
          refreshDebounceTimer = null;
          doRefreshShopData();
      }, 100);
  }
  
  function doRefreshShopData() {
      if (isRefreshing) return;
      isRefreshing = true;
      const bust = "_gg=" + Date.now();
      const urls = [CUSTOMIZATION, SHOP_FEATURED, SHOP_FEATURED_GENERIC, SHOP_COMMON, SHOP_CREATOR, SHOP_CONVEYOR]
                   .map(u => (u.includes("?") ? u + "&" + bust : u + "?" + bust));
      
      console.log('[GG Skinchanger] Refreshing shop data...');
      assetsById.clear();
      assetsReadyPromise = null;
      assetsReadyResolve = null;
      
      let completed = 0;
      urls.forEach(u => {
          internalFetch(u, { method: "GET", headers: { "x-client": "web" } })
            .then(async res => {
                const data = await res.clone().json();
                const path = toPath(u);
                const filterSet = localSaveOnly ? getSavedIdSet() : null;
                processData(data, {
                    unlock: localSaveOnly,
                    collectAssets: true,
                    filterSet
                });
            })
            .catch(() => {})
            .finally(() => {
                completed++;
                if (completed >= urls.length) {
                    isRefreshing = false;
                    console.log('[GG Skinchanger] Shop refresh completed');
                }
            });
      });
  }

  function applyHooks() {
      const pageWindow = window.unsafeWindow || window;
      
      if (!pageWindow._ggOriginalFetch) {
          pageWindow._ggOriginalFetch = pageWindow.fetch;
      }
      const origFetch = pageWindow._ggOriginalFetch;
      pageWindow.fetch = async function (input, init) {
        const url = typeof input === "string" ? input : (input && input.url ? input.url : "");
        const method = String((init && init.method) || (input && input.method) || "GET").toUpperCase();
        const path = toPath(url);
        const isAvatarUser = path === AVATAR_USER || (profileUserId && path === AVATAR_USER_PREFIX + profileUserId);

        if (isAvatarUser) {
             if (!init) init = {};
             init.cache = "no-store";
             init.headers = init.headers || {};
             if (init.headers instanceof Headers) {
                 init.headers.set("Cache-Control", "no-cache");
                 init.headers.set("Pragma", "no-cache");
             } else {
                 init.headers["Cache-Control"] = "no-cache";
                 init.headers["Pragma"] = "no-cache";
             }
        }

        if (method === "GET" && path === ELITE_DAYS) return new Response("999", { status: 200 });

        if (localSaveOnly && method !== "GET" && isSavePath(url)) {
            let bodyText = null;
            if (init && typeof init.body === "string") bodyText = init.body;
            else if (input && typeof input.clone === "function") {
                try { bodyText = await input.clone().text(); } catch {}
            }
            if (bodyText) {
                const ids = tryParseEquippedIds(bodyText);
                if (ids && ids.length) {
                     window.postMessage({ type: MSG_SAVE, equippedIds: ids }, "*");
                }
            }
            return new Response(JSON.stringify({ ok: true, blocked: true, localSaved: true }), { status: 200 });
        }
        
        if (localSaveOnly && method === "GET" && isAvatarUser && savedEquippedIds.length) {
             const ready = await ensureAssetsReady();
             if (!ready) return origFetch.apply(this, arguments);
             return createJsonResponse(buildAvatarPayload());
        }
        
        if (!localSaveOnly && isAvatarUser && method === "GET") {
            if (originalAvatarData) return createJsonResponse(originalAvatarData);
        }
        const res = await origFetch.call(this, input, init);
        
        try {
            if (path === CUSTOMIZATION || path === SHOP_FEATURED || 
                path === SHOP_FEATURED_GENERIC || path === SHOP_COMMON ||
                path === SHOP_CREATOR || path === SHOP_CONVEYOR || 
                path === PROFILES || path === ELITE_DAYS || path.startsWith(RANKED_TEAMS_PREFIX)) {
                    
                if (localSaveOnly && path === PROFILES) await ensureAssetsReady();
                
                const clone = res.clone();
                const text = await clone.text();
                let data = JSON.parse(text);
                
                if (path === ELITE_DAYS) return new Response("999", { status: 200 });
                
                const opts = {
                    unlock: localSaveOnly,
                    ownership: localSaveOnly,
                    emptyReqs: localSaveOnly,
                    nullProduct: (path === CUSTOMIZATION),
                    eliteProfile: localSaveOnly && (path.startsWith(PROFILES) || path.startsWith(RANKED_TEAMS_PREFIX)),
                    isProfilesPath: path.startsWith(PROFILES),
                    isRankedTeamPath: path.startsWith(RANKED_TEAMS_PREFIX),
                    collectAssets: (
                        path === CUSTOMIZATION || path === SHOP_FEATURED || 
                        path === SHOP_FEATURED_GENERIC || path === SHOP_COMMON || 
                        path === SHOP_CREATOR || path === SHOP_CONVEYOR
                    ),
                    filterSet: null
                };
                
                processData(data, opts);
                
                const headers = new Headers(res.headers);
                headers.delete("content-length");
                return new Response(JSON.stringify(data), {
                    status: res.status,
                    statusText: res.statusText,
                    headers
                });
            }
        } catch {}
        
        return res;
      };

      if (!pageWindow.XMLHttpRequest.prototype._ggOriginalOpen) {
          pageWindow.XMLHttpRequest.prototype._ggOriginalOpen = pageWindow.XMLHttpRequest.prototype.open;
          pageWindow.XMLHttpRequest.prototype._ggOriginalSend = pageWindow.XMLHttpRequest.prototype.send;
      }
      
      const origOpen = pageWindow.XMLHttpRequest.prototype._ggOriginalOpen;
      const origSend = pageWindow.XMLHttpRequest.prototype._ggOriginalSend;

      pageWindow.XMLHttpRequest.prototype.open = function(method, url) {
          this.__gg_method = String(method || "GET").toUpperCase();
          this.__gg_url = String(url || "");
          const path = toPath(this.__gg_url);
          if (path === AVATAR_USER || path.startsWith(AVATAR_USER_PREFIX)) {
              this.__gg_url = bustUrl(this.__gg_url);
          }
          
          const res = origOpen.call(this, method, this.__gg_url, arguments[2], arguments[3], arguments[4]);
          
          if (path === AVATAR_USER || path.startsWith(AVATAR_USER_PREFIX)) {
              try {
                  this.setRequestHeader("Cache-Control", "no-cache");
                  this.setRequestHeader("Pragma", "no-cache");
              } catch(e) {}
          }
          return res;
      };
      
      pageWindow.XMLHttpRequest.prototype.send = function(body) {
          const method = this.__gg_method;
          const url = this.__gg_url;
          const path = toPath(url);

          if (method === "GET" && path === ELITE_DAYS) {
               Object.defineProperty(this, "responseText", { value: "999" });
               Object.defineProperty(this, "response", { value: "999" });
               Object.defineProperty(this, "readyState", { value: 4 });
               Object.defineProperty(this, "status", { value: 200 });
               this.dispatchEvent(new Event("readystatechange"));
               this.dispatchEvent(new Event("load"));
               this.dispatchEvent(new Event("loadend"));
               return;
          }
          
          if (localSaveOnly && method !== "GET" && isSavePath(url) && typeof body === "string") {
              const ids = tryParseEquippedIds(body);
              if (ids && ids.length) {
                   window.postMessage({ type: MSG_SAVE, equippedIds: ids }, "*");
              }
               Object.defineProperty(this, "responseText", { value: JSON.stringify({ ok: true, blocked: true }) });
               Object.defineProperty(this, "readyState", { value: 4 });
               Object.defineProperty(this, "status", { value: 200 });
               this.dispatchEvent(new Event("readystatechange"));
               this.dispatchEvent(new Event("load"));
               this.dispatchEvent(new Event("loadend"));
               return;
          }
          
          if (localSaveOnly && method === "GET" && (path === AVATAR_USER || (profileUserId && path === AVATAR_USER_PREFIX + profileUserId)) && savedEquippedIds.length) {
               ensureAssetsReady().then(ready => {
                   if (!ready) return origSend.apply(this, arguments);
                   const text = JSON.stringify(buildAvatarPayload());
                   Object.defineProperty(this, "responseText", { value: text });
                   Object.defineProperty(this, "response", { value: text });
                   Object.defineProperty(this, "readyState", { value: 4 });
                   Object.defineProperty(this, "status", { value: 200 });
                   this.dispatchEvent(new Event("readystatechange"));
                   this.dispatchEvent(new Event("load"));
                   this.dispatchEvent(new Event("loadend"));
               });
               return;
          }
          
          if (!localSaveOnly && method === "GET" && (path === AVATAR_USER || (profileUserId && path === AVATAR_USER_PREFIX + profileUserId)) && originalAvatarData) {
               const text = JSON.stringify(originalAvatarData);
               Object.defineProperty(this, "responseText", { value: text });
               Object.defineProperty(this, "response", { value: text });
               Object.defineProperty(this, "readyState", { value: 4 });
               Object.defineProperty(this, "status", { value: 200 });
               this.dispatchEvent(new Event("readystatechange"));
               this.dispatchEvent(new Event("load"));
               this.dispatchEvent(new Event("loadend"));
               return;
          }
          
          this.addEventListener("readystatechange", function() {
              if (this.readyState !== 4) return;
              const rPath = toPath(this.__gg_url || "");
              if (rPath === CUSTOMIZATION || rPath === SHOP_FEATURED || 
                rPath === SHOP_FEATURED_GENERIC || rPath === SHOP_COMMON || 
                rPath === SHOP_CREATOR || rPath === SHOP_CONVEYOR || 
                rPath === PROFILES || rPath === ELITE_DAYS || rPath.startsWith(RANKED_TEAMS_PREFIX)) {
                
                try {
                    let data = JSON.parse(this.responseText);
                    
                    if (rPath === ELITE_DAYS) data = 999;
                    else {
                        const opts = {
                            unlock: localSaveOnly,
                            ownership: localSaveOnly,
                            emptyReqs: localSaveOnly,
                            nullProduct: (rPath === CUSTOMIZATION),
                            eliteProfile: localSaveOnly && (rPath.startsWith(PROFILES) || rPath.startsWith(RANKED_TEAMS_PREFIX)),
                            isProfilesPath: rPath.startsWith(PROFILES),
                            isRankedTeamPath: rPath.startsWith(RANKED_TEAMS_PREFIX),
                            collectAssets: (rPath === CUSTOMIZATION || rPath === SHOP_FEATURED || rPath === SHOP_FEATURED_GENERIC || rPath === SHOP_COMMON || rPath === SHOP_CREATOR || rPath === SHOP_CONVEYOR),
                            filterSet: null
                        };
                        processData(data, opts);
                    }
                    
                    const patched = JSON.stringify(data);
                    if (patched !== this.responseText) {
                        Object.defineProperty(this, "responseText", { configurable: true, value: patched });
                        Object.defineProperty(this, "response", { configurable: true, value: patched });
                    }
                } catch {}
              }
          });
          
          return origSend.apply(this, arguments);
      };
      
      console.log('[GG Skinchanger] Hooks applied via unsafeWindow');
      window.postMessage({ type: MSG_HOOK_READY }, "*");
  }

  window.addEventListener("message", (ev) => {
    try {
        if (!ev || !ev.data) return;
        const type = ev.data.type;
        
        if (type === MSG_SAVE) {
            const ids = Array.isArray(ev.data.equippedIds) ? ev.data.equippedIds.filter(x => typeof x === "string") : [];
            if (!ids.length) return;
            console.log("[GG Skinchanger] Save requested:", ids);
            
            const savedAssets = [];
            for (const id of ids) {
                if (assetsById.has(id)) {
                    savedAssets.push(assetsById.get(id));
                }
            }
            
            storageSet(STORE_KEY, { userId: profileUserId, equippedIds: ids, savedAssets, savedAt: Date.now() });
            savedEquippedIds = ids;
            sendEquippedToPage(ids);
            setTimeout(() => sendEquippedToPage(ids), 100);
        }
        else if (type === MSG_USER_ID) {
            if (ev.data.userId) profileUserId = ev.data.userId;
        }
        else if (type === MSG_APPLY) {
             const ids = ev.data.equippedIds;
             if (ids && !arraysEqual(savedEquippedIds, ids)) {
                 savedEquippedIds = ids;
             }
        }
        else if (type === MSG_TOGGLE) {
             const val = !!ev.data.value;
             storageSet(STORE_TOGGLE, val);
             localSaveOnly = val;
             console.log('[GG Skinchanger] Toggle updated:', val);
             triggerAvatarRefresh();
        }
        else if (type === MSG_STORE_ORIGINAL) {
             fetchOriginalAvatarFromServer().then(d => {
                 if(d) {
                     originalAvatarData = d;
                     window.postMessage({ type: 'GG_AVATAR_ORIGINAL_STORED', success: true }, '*');
                 }
             });
        }
        else if (type === MSG_RESTORE_ORIGINAL) {
             triggerAvatarRefresh();
        }
        else if (type === MSG_REFRESH_AVATAR) {
             triggerAvatarRefresh();
        }
    } catch {}
  });

  applyHooks();
  fetchOwnProfile();
  
  if (savedEquippedIds.length) {
      setTimeout(() => sendEquippedToPage(savedEquippedIds), 1000);
  }

  setInterval(() => {
     if (window.unsafeWindow && window.unsafeWindow.fetch !== window.unsafeWindow._ggOriginalFetch && !window.unsafeWindow.fetch.toString().includes('localSaveOnly')) {
         applyHooks();
     }
  }, 5000);

})();