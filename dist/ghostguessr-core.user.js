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

  const STORE_KEY = "gg_avatar_equippedIds_v1";
  const STORE_TOGGLE = "gg_local_save_only_v1";
  const MSG_SAVE = "GG_AVATAR_SAVE_EQUIPPED_IDS";
  const MSG_APPLY = "GG_AVATAR_APPLY_EQUIPPED_IDS";
  const MSG_TOGGLE = "GG_AVATAR_LOCAL_SAVE_ONLY";
  const MSG_HOOK_READY = "GG_AVATAR_HOOK_READY";

  const saved = GM_getValue(STORE_KEY, null);
  const initialEquipped =
    saved && Array.isArray(saved.equippedIds) ? saved.equippedIds : [];
  const initialLocalSaveOnly = GM_getValue(STORE_TOGGLE, true);

  let hookReady = false;
  window.addEventListener("message", (ev) => {
    try {
      if (!ev || !ev.data) return;
      if (ev.data.type === MSG_HOOK_READY) {
        hookReady = true;
        sendToggleToPage(initialLocalSaveOnly);
        if (initialEquipped.length) sendEquippedToPage(initialEquipped);
        return;
      }
      if (ev.data.type === MSG_SAVE) {
        const ids = Array.isArray(ev.data.equippedIds)
          ? ev.data.equippedIds.filter((x) => typeof x === "string")
          : [];
        if (!ids.length) return;

        GM_setValue(STORE_KEY, { equippedIds: ids, savedAt: Date.now() });
        sendEquippedToPage(ids);
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
            const log = () => {};
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
              savedEquippedIds = ids;
              assetsById.clear();
              assetsReadyPromise = null;
              assetsReadyResolve = null;
              fetchOwnProfile().then(() => {
                refreshShopData();
                refreshAvatarUser();
              });
              return;
            }
            if (ev.data.type === MSG_TOGGLE) {
              localSaveOnly = !!ev.data.value;
              fetchOwnProfile().then(() => {
                refreshShopData();
                refreshAvatarUser();
              });
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
          savedEquippedIds = valid;
          window.postMessage({ type: MSG_SAVE, equippedIds: valid }, "*");
        }

        if (savedEquippedIds.length) {
          refreshShopData();
          refreshAvatarUser();
        }

        function collectAssetsFromCustomization(data, filterSet) {
          try {
            const seen = new Set();

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
              if (looksLikeAsset) assetsById.set(id, obj);
            }

            function walk(obj) {
              if (!obj || typeof obj !== "object") return;
              if (seen.has(obj)) return;
              seen.add(obj);

              if (Array.isArray(obj)) {
                for (const item of obj) walk(item);
                return;
              }

              if (obj.asset) maybeStoreAsset(obj.asset);
              else maybeStoreAsset(obj);

              for (const key of Object.keys(obj)) {
                const value = obj[key];
                if (value && typeof value === "object") walk(value);
              }
            }

            walk(data);
            markAssetsReady();
            filterSavedEquippedIds();
          } catch {}
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

          assetsById.clear();
          assetsReadyPromise = null;
          assetsReadyResolve = null;

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
              .catch(() => {});
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
          const isAvatarUser =
            isPath(url, AVATAR_USER) || (profileUserId && toPath(url) === AVATAR_USER_PREFIX + profileUserId);
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

        installFetchHook();
        setInterval(installFetchHook, 1000);

        window.__ggShopSkinHookInstalled = true;
        window.postMessage({ type: MSG_HOOK_READY }, "*");
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
            GG.coords.lat = Number.parseFloat(split[0]);
            GG.coords.lng = Number.parseFloat(split[1]);
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
    if (!GG.coords.lat || !GG.coords.lng) return;
    GG.gmap = GG.getGoogleMap();
    if (!GG.gmap) return;
    if (GG.marker) {
      GG.marker.setMap(null);
      GG.marker = null;
    }
    try {
      if (typeof google !== "undefined" && google.maps) {
        let position = new google.maps.LatLng(GG.coords.lat, GG.coords.lng);
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
    if (!GG.coords.lat || !GG.coords.lng) return;
    if (!GG.marker) {
      GG.createMarker();
    } else {
      try {
        if (
          typeof google !== "undefined" &&
          google.maps &&
          GG.marker.setPosition
        ) {
          let position = new google.maps.LatLng(GG.coords.lat, GG.coords.lng);
          GG.marker.setPosition(position);
        }
      } catch (e) {}
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
      let divMarker = document.getElementById("geo-div-marker");
      if (divMarker) divMarker.style.display = "none";
      GG.marker = null;
    }
  };
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
    if (document.querySelector('[data-qa="ghost-marker-toggle"]')) {
      GG.toggleButton = document.querySelector(
        '[data-qa="ghost-marker-toggle"]',
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
    GG.toggleButton.setAttribute("data-qa", "ghost-marker-toggle");

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
    if (settingsContainer.querySelector(".ghost-marker-settings-container")) {
      return;
    }

    const isModernSettings = hasClassPrefix(
      settingsContainer,
      "settings_container__",
    );
    const isNewSettingsSection = hasClassPrefix(
      settingsContainer,
      "settings_sectionContainer__",
    );

    const useModernStructure = isModernSettings || isNewSettingsSection;

    if (useModernStructure) {
      const ghostSettingsContainer = document.createElement("div");
      ghostSettingsContainer.className = "ghost-marker-settings-container";
      ghostSettingsContainer.style.cssText =
        "width: 100%; margin: 0; padding: 0;";

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

      const autoClaimToggle = buildAutoClaimToggle(settingsContainer);
      sectionContent.appendChild(autoClaimToggle);

      const colorFlexContainer = document.createElement("div");
      colorFlexContainer.className =
        "flex_flex__Rxtgm flex_direction__Fa3Gs flex_gap__sXfgm flex_justify__2rGZO flex_align__PRoee";
      colorFlexContainer.style.cssText =
        "--direction: row; --gap: 16px; --justify: space-between; --align: center; margin-bottom: 16px;";

      const markerColorContainer = document.createElement("div");
      markerColorContainer.className =
        "flex_flex__Rxtgm flex_direction__Fa3Gs flex_gap__sXfgm flex_justify__2rGZO flex_align__PRoee";
      markerColorContainer.style.cssText =
        "--direction: column; --gap: 4px; --justify: flex-start; --align: stretch; flex: 1;";

      const markerColorLabel = document.createElement("label");
      markerColorLabel.className =
        "label_label__9xkbh shared_white60Variant__EC173 shared_boldWeight__U2puG label_italic__LM62Y";
      markerColorLabel.style.cssText =
        "--fs: var(--font-size-14); --lh: var(--line-height-14);";
      markerColorLabel.textContent = "Marker Color";

      const markerColorInputContainer = document.createElement("div");
      markerColorInputContainer.className =
        "flex_flex__Rxtgm flex_direction__Fa3Gs flex_gap__sXfgm flex_justify__2rGZO flex_align__PRoee";
      markerColorInputContainer.style.cssText =
        "--direction: row; --gap: 8px; --justify: flex-start; --align: center;";

      const markerColorPreview = document.createElement("div");
      markerColorPreview.style.cssText = `
      width: 32px;
      height: 32px;
      border-radius: 4px;
      background: ${GG.settings.markerColor};
      border: 2px solid rgba(255, 255, 255, 0.2);
      cursor: pointer;
    `;

      const markerColorInput = document.createElement("input");
      markerColorInput.type = "color";
      markerColorInput.value = GG.settings.markerColor;
      markerColorInput.style.cssText = `
      width: 32px;
      height: 32px;
      opacity: 0;
      position: absolute;
      cursor: pointer;
    `;

      const markerColorHex = document.createElement("label");
      markerColorHex.className =
        "label_label__9xkbh shared_boldWeight__U2puG label_italic__LM62Y";
      markerColorHex.style.cssText =
        "--fs: var(--font-size-14); --lh: var(--line-height-14); min-width: 70px;";
      markerColorHex.textContent = GG.settings.markerColor;

      markerColorInput.addEventListener("input", function () {
        GG.settings.markerColor = this.value;
        markerColorPreview.style.background = this.value;
        markerColorHex.textContent = this.value;
        GG.saveSettings();
      });

      markerColorInputContainer.appendChild(markerColorPreview);
      markerColorInputContainer.appendChild(markerColorInput);
      markerColorContainer.appendChild(markerColorLabel);
      markerColorContainer.appendChild(markerColorInputContainer);
      markerColorContainer.appendChild(markerColorHex);

      const outlineColorContainer = document.createElement("div");
      outlineColorContainer.className =
        "flex_flex__Rxtgm flex_direction__Fa3Gs flex_gap__sXfgm flex_justify__2rGZO flex_align__PRoee";
      outlineColorContainer.style.cssText =
        "--direction: column; --gap: 4px; --justify: flex-start; --align: stretch; flex: 1;";

      const outlineColorLabel = document.createElement("label");
      outlineColorLabel.className =
        "label_label__9xkbh shared_white60Variant__EC173 shared_boldWeight__U2puG label_italic__LM62Y";
      outlineColorLabel.style.cssText =
        "--fs: var(--font-size-14); --lh: var(--line-height-14);";
      outlineColorLabel.textContent = "Outline Color";

      const outlineColorInputContainer = document.createElement("div");
      outlineColorInputContainer.className =
        "flex_flex__Rxtgm flex_direction__Fa3Gs flex_gap__sXfgm flex_justify__2rGZO flex_align__PRoee";
      outlineColorInputContainer.style.cssText =
        "--direction: row; --gap: 8px; --justify: flex-start; --align: center;";

      const outlineColorPreview = document.createElement("div");
      outlineColorPreview.style.cssText = `
      width: 32px;
      height: 32px;
      border-radius: 4px;
      background: ${GG.settings.outlineColor};
      border: 2px solid rgba(255, 255, 255, 0.2);
      cursor: pointer;
    `;

      const outlineColorInput = document.createElement("input");
      outlineColorInput.type = "color";
      outlineColorInput.value = GG.settings.outlineColor;
      outlineColorInput.style.cssText = `
      width: 32px;
      height: 32px;
      opacity: 0;
      position: absolute;
      cursor: pointer;
    `;

      const outlineColorHex = document.createElement("label");
      outlineColorHex.className =
        "label_label__9xkbh shared_boldWeight__U2puG label_italic__LM62Y";
      outlineColorHex.style.cssText =
        "--fs: var(--font-size-14); --lh: var(--line-height-14); min-width: 70px;";
      outlineColorHex.textContent = GG.settings.outlineColor;

      outlineColorInput.addEventListener("input", function () {
        GG.settings.outlineColor = this.value;
        outlineColorPreview.style.background = this.value;
        outlineColorHex.textContent = this.value;
        GG.saveSettings();
      });

      outlineColorInputContainer.appendChild(outlineColorPreview);
      outlineColorInputContainer.appendChild(outlineColorInput);
      outlineColorContainer.appendChild(outlineColorLabel);
      outlineColorContainer.appendChild(outlineColorInputContainer);
      outlineColorContainer.appendChild(outlineColorHex);

      colorFlexContainer.appendChild(markerColorContainer);
      colorFlexContainer.appendChild(outlineColorContainer);
      sectionContent.appendChild(colorFlexContainer);

      const createSliderOption = (
        labelText,
        iconSvg,
        value,
        min,
        max,
        step,
        unit,
        onChange,
        onUpdateIcon = null,
      ) => {
        const sliderContainer = document.createElement("div");
        sliderContainer.className = "slider-option_wrapper__3gsTQ";
        sliderContainer.style.cssText = "margin-bottom: 16px;";

        const icon = document.createElement("div");
        icon.className = "slider-option_icon__qtnY8";
        icon.innerHTML = iconSvg;
        if (onUpdateIcon) {
          onUpdateIcon(icon, value);
        }

        const label = document.createElement("div");
        label.className = "slider-option_label__HSXrJ";
        label.textContent = labelText;

        const valueContainer = document.createElement("form");
        valueContainer.className = "slider-option_value__OM__C";

        const valueLabel = document.createElement("div");
        valueLabel.className = "slider-option_valueLabel__XS837";
        valueLabel.textContent =
          unit === "%" ? `${Math.round(value)}${unit}` : `${value}${unit}`;

        valueContainer.appendChild(valueLabel);

        const sliderWrapper = document.createElement("div");
        sliderWrapper.className = "slider-option_slider__kJaCT";

        const slider = document.createElement("div");
        slider.className =
          "styles_rangeslider__8vVg3 styles_variantPurple__1s1cU";
        slider.setAttribute("aria-valuemin", min);
        slider.setAttribute("aria-valuemax", max);
        slider.setAttribute("aria-valuenow", value);
        slider.setAttribute("aria-orientation", "horizontal");
        slider.setAttribute("aria-disabled", "false");

        const fill = document.createElement("div");
        fill.className = "styles_fill__9MeZ9";
        fill.style.width = `${((value - min) / (max - min)) * 100}%`;

        const handle = document.createElement("div");
        handle.className = "styles_handle__h9ytQ";
        handle.tabIndex = 0;
        handle.style.left = `${((value - min) / (max - min)) * 100}%`;
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
          const newValue = min + (max - min) * percent;
          const stepped = step ? Math.round(newValue / step) * step : newValue;
          const clamped = Math.max(min, Math.min(stepped, max));

          fill.style.width = `${((clamped - min) / (max - min)) * 100}%`;
          handle.style.left = `${((clamped - min) / (max - min)) * 100}%`;
          valueLabel.textContent =
            unit === "%"
              ? `${Math.round(clamped)}${unit}`
              : `${clamped.toFixed(1)}${unit}`;

          slider.setAttribute("aria-valuenow", clamped);
          if (onUpdateIcon) {
            onUpdateIcon(icon, clamped);
          }
          onChange(clamped);
        };

        handle.addEventListener("mousedown", (e) => {
          e.preventDefault();
          isDragging = true;
          document.addEventListener("mousemove", onMouseMove);
          document.addEventListener("mouseup", onMouseUp);
        });

        slider.addEventListener("click", (e) => {
          if (!isDragging) {
            updateFromEvent(e);
          }
        });

        const onMouseMove = (e) => {
          if (isDragging) {
            updateFromEvent(e);
          }
        };

        const onMouseUp = () => {
          isDragging = false;
          document.removeEventListener("mousemove", onMouseMove);
          document.removeEventListener("mouseup", onMouseUp);
        };

        return sliderContainer;
      };

      const transparencySlider = createSliderOption(
        "Transparency",
        `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="12" cy="12" r="10" fill="${GG.settings.markerColor}" fill-opacity="${GG.settings.opacity}" stroke="${GG.settings.outlineColor}" stroke-width="${GG.settings.outlineWidth}"/>
      </svg>`,
        Math.round(GG.settings.opacity * 100),
        0,
        100,
        1,
        "%",
        (value) => {
          GG.settings.opacity = value / 100;
          GG.saveSettings();
        },
        (icon, value) => {
          icon.innerHTML = `
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <circle cx="12" cy="12" r="10" fill="${GG.settings.markerColor}" fill-opacity="${
            value / 100
          }" stroke="${GG.settings.outlineColor}" stroke-width="${GG.settings.outlineWidth}"/>
        </svg>`;
        },
      );

      sectionContent.appendChild(transparencySlider);

      const outlineWidthSlider = createSliderOption(
        "Outline Width",
        `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="12" cy="12" r="10" fill="none" stroke="${GG.settings.outlineColor}" stroke-width="${GG.settings.outlineWidth}"/>
      </svg>`,
        GG.settings.outlineWidth,
        0.5,
        5,
        0.1,
        "px",
        (value) => {
          GG.settings.outlineWidth = value;
          GG.saveSettings();
        },
        (icon, value) => {
          icon.innerHTML = `
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <circle cx="12" cy="12" r="10" fill="none" stroke="${GG.settings.outlineColor}" stroke-width="${value}"/>
        </svg>`;
        },
      );

      sectionContent.appendChild(outlineWidthSlider);

      const sizeSlider = createSliderOption(
        "Marker Size",
        `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="12" cy="12" r="${GG.settings.size / 2}" fill="${GG.settings.markerColor}" fill-opacity="${GG.settings.opacity}" stroke="${GG.settings.outlineColor}" stroke-width="${GG.settings.outlineWidth}"/>
      </svg>`,
        GG.settings.size,
        5,
        20,
        0.5,
        "",
        (value) => {
          GG.settings.size = value;
          GG.saveSettings();
        },
        (icon, value) => {
          icon.innerHTML = `
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <circle cx="12" cy="12" r="${value / 2}" fill="${GG.settings.markerColor}" fill-opacity="${GG.settings.opacity}" stroke="${GG.settings.outlineColor}" stroke-width="${GG.settings.outlineWidth}"/>
        </svg>`;
        },
      );

      sectionContent.appendChild(sizeSlider);

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
        settingsContainer.appendChild(ghostSettingsContainer);
      }

      return;
    }

    document
      .querySelectorAll(".ghost-marker-setting")
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
    ghostSettingsContainer.className = "ghost-marker-settings-container";
    ghostSettingsContainer.style.cssText =
      "width: 100%; align-self: stretch; box-sizing: border-box; margin: 0; padding: 0;";

    if (!useExistingDivider) {
      const dividerTop = document.createElement("div");
      dividerTop.className = "game-menu_divider__IhA4t ghost-marker-setting";
      ghostSettingsContainer.appendChild(dividerTop);
    }

    const headerContainer = document.createElement("div");
    headerContainer.className =
      "game-menu_volumeContainer__aWb0Y ghost-marker-setting";

    const headerLabel = document.createElement("p");
    headerLabel.className = "game-menu_subHeader__Ul5Vl";
    headerLabel.textContent = "Ghost Marker";
    headerLabel.style.cssText = "font-size: 16px; color: #fff;";
    headerContainer.appendChild(headerLabel);

    ghostSettingsContainer.appendChild(headerContainer);

    const hotkeyContainer = document.createElement("div");
    hotkeyContainer.className =
      "game-menu_volumeContainer__aWb0Y ghost-marker-setting";

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

    GG.hotkeyInput = document.createElement("input");
    GG.hotkeyInput.type = "text";
    GG.hotkeyInput.value = GG.settings.hotkey;
    GG.hotkeyInput.maxLength = 1;
    GG.hotkeyInput.style.cssText = `
            flex: 1;
            height: 36px;
            background: rgba(255, 255, 255, 0.1);
            border: 1px solid #8b5cf6;
            border-radius: 6px;
            color: #fff;
            padding: 0 10px;
            font-size: 16px;
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

    const hotkeyHelp = document.createElement("span");
    hotkeyHelp.textContent = "Press any key";
    hotkeyHelp.style.cssText =
      "font-size: 12px; color: #888; font-style: italic; min-width: 100px;";

    hotkeyInputContainer.appendChild(hotkeyIcon);
    hotkeyInputContainer.appendChild(GG.hotkeyInput);
    hotkeyInputContainer.appendChild(hotkeyHelp);
    hotkeyContainer.appendChild(hotkeyInputContainer);
    ghostSettingsContainer.appendChild(hotkeyContainer);

    const autoClaimToggle = buildAutoClaimToggle(settingsContainer);
    autoClaimToggle.classList.add("ghost-marker-setting");
    ghostSettingsContainer.appendChild(autoClaimToggle);

    const colorContainer = document.createElement("div");
    colorContainer.className =
      "game-menu_volumeContainer__aWb0Y ghost-marker-setting";

    const colorLabel = document.createElement("p");
    colorLabel.className = "game-menu_subHeader__Ul5Vl";
    colorLabel.textContent = "Marker Color";
    colorContainer.appendChild(colorLabel);

    const colorSliderContainer = document.createElement("div");
    colorSliderContainer.className = "game-menu_sliderContainer__suHjk";
    colorSliderContainer.style.cssText =
      "display: flex; align-items: center; gap: 10px;";

    const colorIcon = document.createElement("div");
    colorIcon.className = "game-menu_icon__qC_vb";
    colorIcon.innerHTML = `
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <circle cx="12" cy="12" r="10" fill="${GG.settings.markerColor}" stroke="#333" stroke-width="2"/>
            </svg>
        `;

    const colorInput = document.createElement("input");
    colorInput.type = "color";
    colorInput.value = GG.settings.markerColor;
    colorInput.style.cssText =
      "flex: 1; height: 36px; border: none; background: transparent; cursor: pointer;";

    const colorHex = document.createElement("span");
    colorHex.textContent = GG.settings.markerColor;
    colorHex.style.cssText =
      "font-family: monospace; font-size: 14px; color: #ccc; min-width: 60px;";

    colorInput.addEventListener("input", function () {
      GG.settings.markerColor = this.value;
      colorIcon.innerHTML = `
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <circle cx="12" cy="12" r="10" fill="${this.value}" stroke="#333" stroke-width="2"/>
                </svg>
            `;
      colorHex.textContent = this.value;
      GG.saveSettings();
    });

    colorSliderContainer.appendChild(colorIcon);
    colorSliderContainer.appendChild(colorInput);
    colorSliderContainer.appendChild(colorHex);
    colorContainer.appendChild(colorSliderContainer);
    ghostSettingsContainer.appendChild(colorContainer);

    const outlineContainer = document.createElement("div");
    outlineContainer.className =
      "game-menu_volumeContainer__aWb0Y ghost-marker-setting";

    const outlineLabel = document.createElement("p");
    outlineLabel.className = "game-menu_subHeader__Ul5Vl";
    outlineLabel.textContent = "Outline Color";
    outlineContainer.appendChild(outlineLabel);

    const outlineSliderContainer = document.createElement("div");
    outlineSliderContainer.className = "game-menu_sliderContainer__suHjk";
    outlineSliderContainer.style.cssText =
      "display: flex; align-items: center; gap: 10px;";

    const outlineIcon = document.createElement("div");
    outlineIcon.className = "game-menu_icon__qC_vb";
    outlineIcon.innerHTML = `
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <circle cx="12" cy="12" r="10" fill="none" stroke="${GG.settings.outlineColor}" stroke-width="4"/>
            </svg>
        `;

    const outlineInput = document.createElement("input");
    outlineInput.type = "color";
    outlineInput.value = GG.settings.outlineColor;
    outlineInput.style.cssText =
      "flex: 1; height: 36px; border: none; background: transparent; cursor: pointer;";

    const outlineHex = document.createElement("span");
    outlineHex.textContent = GG.settings.outlineColor;
    outlineHex.style.cssText =
      "font-family: monospace; font-size: 14px; color: #ccc; min-width: 60px;";

    outlineInput.addEventListener("input", function () {
      GG.settings.outlineColor = this.value;
      outlineIcon.innerHTML = `
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <circle cx="12" cy="12" r="10" fill="none" stroke="${this.value}" stroke-width="4"/>
                </svg>
            `;
      outlineHex.textContent = this.value;
      GG.saveSettings();
    });

    outlineSliderContainer.appendChild(outlineIcon);
    outlineSliderContainer.appendChild(outlineInput);
    outlineSliderContainer.appendChild(outlineHex);
    outlineContainer.appendChild(outlineSliderContainer);
    ghostSettingsContainer.appendChild(outlineContainer);

    const opacityContainer = document.createElement("div");
    opacityContainer.className =
      "game-menu_volumeContainer__aWb0Y ghost-marker-setting";

    const opacityLabel = document.createElement("p");
    opacityLabel.className = "game-menu_subHeader__Ul5Vl";
    opacityLabel.textContent = "Transparency";
    opacityContainer.appendChild(opacityLabel);

    const opacitySliderContainer = document.createElement("div");
    opacitySliderContainer.className = "game-menu_sliderContainer__suHjk";
    opacitySliderContainer.style.cssText =
      "display: flex; align-items: center; gap: 10px;";

    const opacityIcon = document.createElement("div");
    opacityIcon.className = "game-menu_icon__qC_vb";
    opacityIcon.innerHTML = `
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <circle cx="12" cy="12" r="10" fill="${GG.settings.markerColor}" fill-opacity="${GG.settings.opacity}" stroke="${GG.settings.outlineColor}" stroke-width="2"/>
            </svg>
        `;

    const opacitySlider = document.createElement("div");
    opacitySlider.className =
      "styles_rangeslider__8vVg3 styles_variantPurple__1s1cU";
    opacitySlider.style.cssText = "flex: 1;";

    const opacityFill = document.createElement("div");
    opacityFill.className = "styles_fill__9MeZ9";
    opacityFill.style.width = `${GG.settings.opacity * 100}%`;

    const opacityHandle = document.createElement("div");
    opacityHandle.className = "styles_handle__h9ytQ";
    opacityHandle.tabIndex = 0;
    opacityHandle.style.left = `${GG.settings.opacity * 100}%`;
    opacityHandle.innerHTML = "<div></div>";

    opacitySlider.appendChild(opacityFill);
    opacitySlider.appendChild(opacityHandle);

    const opacityValue = document.createElement("span");
    opacityValue.textContent = `${Math.round(GG.settings.opacity * 100)}%`;
    opacityValue.style.cssText =
      "font-size: 14px; color: #ccc; min-width: 40px;";

    const makeSliderDraggable = (
      slider,
      fill,
      handle,
      min,
      max,
      step,
      onChange,
    ) => {
      let isDragging = false;

      const updateFromEvent = (e) => {
        const rect = slider.getBoundingClientRect();
        let x = e.clientX - rect.left;
        x = Math.max(0, Math.min(x, rect.width));
        const percent = x / rect.width;
        const value = min + (max - min) * percent;
        const stepped = step ? Math.round(value / step) * step : value;
        const clamped = Math.max(min, Math.min(stepped, max));

        fill.style.width = `${(clamped / max) * 100}%`;
        handle.style.left = `${(clamped / max) * 100}%`;
        onChange(clamped);
      };

      handle.addEventListener("mousedown", (e) => {
        e.preventDefault();
        isDragging = true;
        document.addEventListener("mousemove", onMouseMove);
        document.addEventListener("mouseup", onMouseUp);
      });

      slider.addEventListener("click", (e) => {
        if (!isDragging) {
          updateFromEvent(e);
        }
      });

      const onMouseMove = (e) => {
        if (isDragging) {
          updateFromEvent(e);
        }
      };

      const onMouseUp = () => {
        isDragging = false;
        document.removeEventListener("mousemove", onMouseMove);
        document.removeEventListener("mouseup", onMouseUp);
      };
    };

    makeSliderDraggable(
      opacitySlider,
      opacityFill,
      opacityHandle,
      0,
      1,
      0.01,
      (value) => {
        GG.settings.opacity = value;
        opacityValue.textContent = `${Math.round(value * 100)}%`;
        opacityIcon.innerHTML = `
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <circle cx="12" cy="12" r="10" fill="${GG.settings.markerColor}" fill-opacity="${value}" stroke="${GG.settings.outlineColor}" stroke-width="2"/>
                </svg>
            `;
        GG.saveSettings();
      },
    );

    opacitySliderContainer.appendChild(opacityIcon);
    opacitySliderContainer.appendChild(opacitySlider);
    opacitySliderContainer.appendChild(opacityValue);
    opacityContainer.appendChild(opacitySliderContainer);
    ghostSettingsContainer.appendChild(opacityContainer);

    const widthContainer = document.createElement("div");
    widthContainer.className =
      "game-menu_volumeContainer__aWb0Y ghost-marker-setting";

    const widthLabel = document.createElement("p");
    widthLabel.className = "game-menu_subHeader__Ul5Vl";
    widthLabel.textContent = "Outline Width";
    widthContainer.appendChild(widthLabel);

    const widthSliderContainer = document.createElement("div");
    widthSliderContainer.className = "game-menu_sliderContainer__suHjk";
    widthSliderContainer.style.cssText =
      "display: flex; align-items: center; gap: 10px;";

    const widthIcon = document.createElement("div");
    widthIcon.className = "game-menu_icon__qC_vb";
    widthIcon.innerHTML = `
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <circle cx="12" cy="12" r="10" fill="none" stroke="${GG.settings.outlineColor}" stroke-width="${GG.settings.outlineWidth}"/>
            </svg>
        `;

    const widthSlider = document.createElement("div");
    widthSlider.className =
      "styles_rangeslider__8vVg3 styles_variantPurple__1s1cU";
    widthSlider.style.cssText = "flex: 1;";

    const widthFill = document.createElement("div");
    widthFill.className = "styles_fill__9MeZ9";
    widthFill.style.width = `${(GG.settings.outlineWidth / 5) * 100}%`;

    const widthHandle = document.createElement("div");
    widthHandle.className = "styles_handle__h9ytQ";
    widthHandle.tabIndex = 0;
    widthHandle.style.left = `${(GG.settings.outlineWidth / 5) * 100}%`;
    widthHandle.innerHTML = "<div></div>";

    widthSlider.appendChild(widthFill);
    widthSlider.appendChild(widthHandle);

    const widthValue = document.createElement("span");
    widthValue.textContent = `${GG.settings.outlineWidth}px`;
    widthValue.style.cssText = "font-size: 14px; color: #ccc; min-width: 40px;";

    makeSliderDraggable(
      widthSlider,
      widthFill,
      widthHandle,
      0,
      5,
      0.1,
      (value) => {
        const displayValue = Number.isInteger(value) ? value : value.toFixed(1);
        GG.settings.outlineWidth = value;
        widthValue.textContent = `${displayValue}px`;
        widthFill.style.width = `${(value / 5) * 100}%`;
        widthHandle.style.left = `${(value / 5) * 100}%`;
        widthIcon.innerHTML = `
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <circle cx="12" cy="12" r="10" fill="none" stroke="${GG.settings.outlineColor}" stroke-width="${value}"/>
                </svg>
            `;
        GG.saveSettings();
      },
    );

    widthSliderContainer.appendChild(widthIcon);
    widthSliderContainer.appendChild(widthSlider);
    widthSliderContainer.appendChild(widthValue);
    widthContainer.appendChild(widthSliderContainer);
    ghostSettingsContainer.appendChild(widthContainer);

    const sizeContainer = document.createElement("div");
    sizeContainer.className =
      "game-menu_volumeContainer__aWb0Y ghost-marker-setting";

    const sizeLabel = document.createElement("p");
    sizeLabel.className = "game-menu_subHeader__Ul5Vl";
    sizeLabel.textContent = "Marker Size";
    sizeContainer.appendChild(sizeLabel);

    const sizeSliderContainer = document.createElement("div");
    sizeSliderContainer.className = "game-menu_sliderContainer__suHjk";
    sizeSliderContainer.style.cssText =
      "display: flex; align-items: center; gap: 10px;";

    const sizeIcon = document.createElement("div");
    sizeIcon.className = "game-menu_icon__qC_vb";
    sizeIcon.innerHTML = `
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <circle cx="12" cy="12" r="${GG.settings.size / 2}" fill="${
                  GG.settings.markerColor
                }" fill-opacity="${GG.settings.opacity}" stroke="${
                  GG.settings.outlineColor
                }" stroke-width="${GG.settings.outlineWidth}"/>
            </svg>
        `;

    const sizeSlider = document.createElement("div");
    sizeSlider.className =
      "styles_rangeslider__8vVg3 styles_variantPurple__1s1cU";
    sizeSlider.style.cssText = "flex: 1;";

    const sizeFill = document.createElement("div");
    sizeFill.className = "styles_fill__9MeZ9";
    sizeFill.style.width = `${((GG.settings.size - 5) / 15) * 100}%`;

    const sizeHandle = document.createElement("div");
    sizeHandle.className = "styles_handle__h9ytQ";
    sizeHandle.tabIndex = 0;
    sizeHandle.style.left = `${((GG.settings.size - 5) / 15) * 100}%`;
    sizeHandle.innerHTML = "<div></div>";

    sizeSlider.appendChild(sizeFill);
    sizeSlider.appendChild(sizeHandle);

    const sizeValue = document.createElement("span");
    sizeValue.textContent = GG.settings.size;
    sizeValue.style.cssText = "font-size: 14px; color: #ccc; min-width: 40px;";

    makeSliderDraggable(
      sizeSlider,
      sizeFill,
      sizeHandle,
      5,
      20,
      0.1,
      (value) => {
        const displayValue = Number.isInteger(value) ? value : value.toFixed(1);
        GG.settings.size = value;
        sizeValue.textContent = displayValue;
        sizeFill.style.width = `${((value - 5) / 15) * 100}%`;
        sizeHandle.style.left = `${((value - 5) / 15) * 100}%`;
        sizeIcon.innerHTML = `
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <circle cx="12" cy="12" r="${value / 2}" fill="${
                      GG.settings.markerColor
                    }" fill-opacity="${GG.settings.opacity}" stroke="${
                      GG.settings.outlineColor
                    }" stroke-width="${GG.settings.outlineWidth}"/>
                </svg>
            `;
        GG.saveSettings();
      },
    );

    sizeSliderContainer.appendChild(sizeIcon);
    sizeSliderContainer.appendChild(sizeSlider);
    sizeSliderContainer.appendChild(sizeValue);
    sizeContainer.appendChild(sizeSliderContainer);
    ghostSettingsContainer.appendChild(sizeContainer);

    if (!useExistingDivider) {
      const dividerBottom = document.createElement("div");
      dividerBottom.className = "game-menu_divider__IhA4t ghost-marker-setting";
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
      labelText.textContent = "Skinchanger";
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

  GG.initialize = function () {
    GG.loadSettings();
    GG.setupHotkeyListener();
    if (typeof GG.tryRewardClaims === "function") {
      GG.tryRewardClaims();
    }

    const checkAndCreate = () => {
      if (typeof GG.createToggleButton === "function") {
        if (!document.querySelector('[data-qa="ghost-marker-toggle"]')) {
          GG.buttonCreated = false;
        }
        if (!GG.buttonCreated) {
          GG.createToggleButton();
        }
      }
      if (GG.settings.enabled) {
        GG.ensureMarkerVisible();
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


