import { storage } from "../core/storage.js";
import { settings, watch } from "../core/settings.js";
import { invalidateCachedData, softRefreshRoute } from "../core/react.js";
import { onFetch, onXhr, jsonResponse, nativeFetch } from "../net/interceptor.js";
import { createLogger } from "../core/logger.js";

/**
 * Skinchanger (web + Steam): unlocks every avatar item in the
 * customization screen and keeps the chosen outfit locally. Saves are stored in
 * the userscript storage instead of being sent to GeoGuessr, so only you see it.
 *
 * Paths are matched without query strings, so platform variants like
 * `/api/v4/webshop/featured-deals?platform=steam` are handled too.
 */

const log = createLogger("Skinchanger");

const KEY_OUTFIT = "gg_avatar_equippedIds_v1";

const PATHS = {
  save: "/api/v4/avatar/save",
  avatarUser: "/api/v4/avatar/user",
  customization: "/api/v4/customization",
  eliteDays: "/api/v4/customization/elite-days",
  profiles: "/api/v3/profiles/",
  rankedTeams: "/api/v4/ranked-team-duels/me/teams/",
  playerIdentities: "/api/v4/player-identities/",
};
const SHOP_PATHS = [
  "/api/v4/webshop/featured-deals/world-championship",
  "/api/v4/webshop/featured-deals",
  "/api/v4/webshop/common-products",
  "/api/v4/webshop/creator-shop/products",
  "/api/v4/webshop/conveyor-belt",
  "/api/v4/creators", // Steam: ?listCurrentPrograms=false
];
const ASSET_SOURCES = new Set([PATHS.customization, ...SHOP_PATHS]);
const BORDER_SLOT = 22;
const MAX_ASSETS = 4000;

const outfit = (() => {
  const saved = storage.get(KEY_OUTFIT, null) || {};
  return {
    userId: saved.userId || null,
    nick: null,
    equippedIds: Array.isArray(saved.equippedIds) ? saved.equippedIds.filter((id) => typeof id === "string") : [],
  };
})();
const assets = new Map(
  ((storage.get(KEY_OUTFIT, null) || {}).savedAssets || [])
    .filter((asset) => asset && typeof asset.id === "string")
    .map((asset) => [asset.id, asset]),
);

/** Live: hooks check this on every request, so toggling needs no reload. */
export const isSkinchangerEnabled = () => settings.skinchanger === true;

const persistOutfit = () => {
  const savedAssets = outfit.equippedIds.map((id) => assets.get(id)).filter(Boolean);
  storage.set(KEY_OUTFIT, { userId: outfit.userId, equippedIds: outfit.equippedIds, savedAssets, savedAt: Date.now() });
};

const looksLikeAsset = (obj) =>
  typeof obj.id === "string" &&
  (typeof obj.slot === "number" || typeof obj.meshGlb === "string" || typeof obj.texture === "string" || typeof obj.icon === "string");

const borderUrl = () => {
  for (const id of outfit.equippedIds) {
    const asset = assets.get(id);
    if (asset && (asset.type === "DEFAULT_BORDER" || asset.slot === BORDER_SLOT) && asset.icon) return asset.icon;
  }
  return null;
};

/** Walks an API payload, unlocking items and collecting asset definitions. */
const transform = (data, path) => {
  const collect = ASSET_SOURCES.has(path);
  const isProfiles = path.startsWith(PATHS.profiles);
  const isRanked = path.startsWith(PATHS.rankedTeams);
  const seen = new Set();

  const walk = (obj, depth) => {
    if (!obj || typeof obj !== "object" || seen.has(obj) || depth > 50) return;
    seen.add(obj);
    if (Array.isArray(obj)) {
      for (const item of obj) walk(item, depth + 1);
      return;
    }

    if ("unlocked" in obj || typeof obj.slot === "number") obj.unlocked = true;
    if ("isOwned" in obj || typeof obj.slot === "number") obj.isOwned = true;
    if ("isInUserInventory" in obj) obj.isInUserInventory = true;
    if ("isEliteExclusive" in obj) obj.isEliteExclusive = false;
    if (Array.isArray(obj.requirements)) obj.requirements = [];
    if (path === PATHS.customization && "product" in obj) obj.product = null;

    if (collect && assets.size < MAX_ASSETS) {
      const candidate = obj.asset && typeof obj.asset === "object" ? obj.asset : obj;
      if (looksLikeAsset(candidate) && !assets.has(candidate.id)) assets.set(candidate.id, candidate);
    }

    if (isProfiles && obj.user && typeof obj.user === "object" && depth <= 1) {
      const user = obj.user;
      if (typeof user.id === "string") outfit.userId = user.id;
      outfit.nick = user.nick || user.userName || user.username || outfit.nick;
      user.type = "Elite";
      const border = borderUrl();
      if (border) user.borderUrl = border;
    }
    if (isRanked && obj.userId && (obj.userId === outfit.userId || (outfit.nick && obj.nick === outfit.nick))) {
      const border = borderUrl();
      if (border) obj.borderUrl = border;
    }

    for (const key of Object.keys(obj)) walk(obj[key], depth + 1);
  };

  walk(data, 0);
  return data;
};

/** Own user id: learned from /api/v3/profiles, else from the header pin (data-user-id). */
const ownUserId = () => {
  if (outfit.userId) return outfit.userId;
  const pin = document.querySelector('[data-qa="header-current-user-pin"][data-user-id], [data-user-id]');
  const id = pin && pin.getAttribute("data-user-id");
  if (id) outfit.userId = id;
  return id || null;
};

const isOwnAvatar = (path) => {
  if (path === PATHS.avatarUser) return true;
  const id = path.startsWith(`${PATHS.avatarUser}/`) && path.slice(PATHS.avatarUser.length + 1);
  return !!id && id === ownUserId();
};

/** /api/v4/player-identities/{id} of the logged-in player. */
const isOwnIdentity = (path) => {
  if (!path.startsWith(PATHS.playerIdentities)) return false;
  const id = path.slice(PATHS.playerIdentities.length).split("/")[0];
  return !!id && id === ownUserId();
};

/** Swaps the avatar inside a player-identity payload for the local outfit. */
const transformIdentity = (data) => {
  const payload = avatarPayload();
  const seen = new Set();
  const walk = (obj, depth) => {
    if (!obj || typeof obj !== "object" || seen.has(obj) || depth > 12) return;
    seen.add(obj);
    if (Array.isArray(obj)) return obj.forEach((item) => walk(item, depth + 1));
    if (Array.isArray(obj.equipped) && payload.equipped.length) obj.equipped = payload.equipped;
    if ("equippedBadge" in obj) obj.equippedBadge = payload.equippedBadge;
    if ("borderUrl" in obj && payload.borderUrl) obj.borderUrl = payload.borderUrl;
    for (const key of Object.keys(obj)) walk(obj[key], depth + 1);
  };
  walk(data, 0);
  return data;
};

const isTransformed = (path) =>
  ASSET_SOURCES.has(path) || path === PATHS.profiles || path.startsWith(PATHS.rankedTeams);

let assetsLoading = null;
const ensureAssets = () => {
  if (outfit.equippedIds.every((id) => assets.has(id))) return Promise.resolve();
  if (!assetsLoading) {
    const doFetch = nativeFetch || window.fetch.bind(window);
    assetsLoading = doFetch(PATHS.customization, { credentials: "include", headers: { ...apiHeaders } })
      .then((response) => response.json())
      .then((data) => transform(data, PATHS.customization))
      .catch((error) => log.warn("could not load assets", error))
      .finally(() => {
        assetsLoading = null;
      });
  }
  return assetsLoading;
};

/**
 * Auth/client headers the game sends with its own API calls (the Steam client
 * authenticates with headers instead of cookies). Reused for our requests.
 */
const apiHeaders = {};
const SKIP_HEADERS = new Set(["content-type", "content-length", "accept", "cache-control", "pragma"]);

const rememberHeaders = (headers) => {
  if (!headers) return;
  const entries = headers instanceof Headers ? Array.from(headers.entries()) : Array.isArray(headers) ? headers : Object.entries(headers);
  for (const [name, value] of entries) {
    if (!SKIP_HEADERS.has(String(name).toLowerCase()) && typeof value === "string") apiHeaders[name] = value;
  }
};

const isGeoGuessrApi = (url) => /^\/api\//.test(url) || /^https:\/\/(www\.)?geoguessr\.com\/api\//.test(url);

const avatarPayload = () => ({
  equipped: outfit.equippedIds.map((id) => assets.get(id)).filter(Boolean),
  equippedBadge: null,
  borderUrl: borderUrl(),
});

const rememberSave = (bodyText) => {
  try {
    const ids = JSON.parse(bodyText).equippedIds;
    if (Array.isArray(ids) && ids.length) {
      outfit.equippedIds = ids.filter((id) => typeof id === "string");
      persistOutfit();
      log.info("outfit saved locally", outfit.equippedIds.length, "items");
      // Update avatars that are already on screen (header, home page, lobby).
      setTimeout(refreshSkins, 0);
    }
  } catch {}
};

const transformText = (text, path) => {
  try {
    return JSON.stringify(transform(JSON.parse(text), path));
  } catch {
    return text;
  }
};

const CACHED_DATA = /avatar|identit|profile|customization|webshop|creator|player/i;

/**
 * Makes already loaded avatars pick up the change without a page reload:
 * GeoGuessr keeps player identities / avatars in an in-memory data cache, so
 * we mark those entries stale (React Query / SWR) and let the app re-fetch.
 */
export const refreshSkins = () => {
  const touched = invalidateCachedData(CACHED_DATA);
  if (!touched) softRefreshRoute();
  log.info(`refreshed avatar data (${touched ? `${touched} cache(s)` : "route refresh"})`);
};

const noStore = (ctx) => {
  const init = { ...(ctx.init || {}), cache: "no-store" };
  ctx.init = init;
};

const fakeJson = (data) => jsonResponse(data);

export const initSkinchanger = () => {
  const enabled = () => isSkinchangerEnabled();
  const handled = (path) =>
    path === PATHS.eliteDays ||
    path.startsWith(PATHS.save) ||
    isOwnAvatar(path) ||
    isOwnIdentity(path) ||
    isTransformed(path);

  // Learn the headers the client uses (Steam: auth headers instead of cookies).
  onFetch({
    match: ({ url }) => isGeoGuessrApi(url),
    before: (ctx) => {
      rememberHeaders(ctx.init && ctx.init.headers);
      if (ctx.input && ctx.input.headers) rememberHeaders(ctx.input.headers);
    },
  });

  onFetch({
    match: ({ path }) => enabled() && handled(path),
    before: async (ctx) => {
      if (ctx.path === PATHS.eliteDays && ctx.method === "GET") return fakeJson("999");
      if (ctx.path.startsWith(PATHS.save) && ctx.method !== "GET") {
        let body = ctx.init && typeof ctx.init.body === "string" ? ctx.init.body : null;
        if (!body && ctx.input && typeof ctx.input.clone === "function") body = await ctx.input.clone().text();
        if (body) rememberSave(body);
        return fakeJson({ ok: true });
      }
      if (isOwnAvatar(ctx.path) && ctx.method === "GET" && outfit.equippedIds.length) {
        await ensureAssets();
        return fakeJson(avatarPayload());
      }
      if (isOwnIdentity(ctx.path)) {
        // Never serve the player's identity from the HTTP cache while skins are local.
        noStore(ctx);
        if (outfit.equippedIds.length) await ensureAssets();
      }
      if (ctx.path === PATHS.profiles) await ensureAssets();
    },
    after: async (ctx, response) => {
      if (!response.ok) return;
      const identity = isOwnIdentity(ctx.path);
      if (!identity && !isTransformed(ctx.path)) return;
      const text = await response.clone().text();
      let out = text;
      try {
        out = JSON.stringify(identity ? transformIdentity(JSON.parse(text)) : transform(JSON.parse(text), ctx.path));
      } catch {}
      const headers = new Headers(response.headers);
      headers.delete("content-length");
      return new Response(out, { status: response.status, statusText: response.statusText, headers });
    },
  });

  onXhr({
    match: ({ path }) => enabled() && handled(path),
    before: async (ctx, _xhr, body) => {
      if (ctx.path === PATHS.eliteDays && ctx.method === "GET") return "999";
      if (ctx.path.startsWith(PATHS.save) && ctx.method !== "GET") {
        if (typeof body === "string") rememberSave(body);
        return JSON.stringify({ ok: true });
      }
      if (isOwnAvatar(ctx.path) && ctx.method === "GET" && outfit.equippedIds.length) {
        await ensureAssets();
        return JSON.stringify(avatarPayload());
      }
    },
    after: (ctx, _xhr, text) => {
      if (isOwnIdentity(ctx.path)) {
        try {
          return JSON.stringify(transformIdentity(JSON.parse(text)));
        } catch {
          return undefined;
        }
      }
      return isTransformed(ctx.path) ? transformText(text, ctx.path) : undefined;
    },
  });

  // Toggle live: no page reload, just let the app re-fetch avatar data.
  watch("skinchanger", ({ value }) => {
    log.info(value ? "enabled" : "disabled");
    refreshSkins();
  });
  if (enabled()) log.info("enabled");
};
