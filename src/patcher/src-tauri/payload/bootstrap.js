/*
 * GhostGuessr Steam loader.
 *
 * Installed by the GhostGuessr Patcher into app.asar as `ghostguessr/bootstrap.js`
 * and set as the app's `main`. It:
 *   1. registers hooks that inject the GhostGuessr userscript into every
 *      geoguessr.com frame (the Steam client renders the game in an iframe),
 *   2. keeps the userscript up to date:
 *        stable/dev: downloads the latest build on every launch, falls back to
 *                    the cached / bundled copy when offline
 *        local:      fetches from the local dev server on every page load
 *   3. optionally enables the Chromium DevTools (F12 / Ctrl+Shift+I),
 *   4. hands over to the game's original main script.
 *
 * It never touches the original game files, so a failure here can't stop the
 * game from starting: every step is wrapped and logged.
 */
"use strict";

const fs = require("fs");
const path = require("path");
const http = require("http");
const https = require("https");
const Module = require("module");

const LOADER_VERSION = 3;
const CONFIG = (() => {
  try {
    return JSON.parse(fs.readFileSync(path.join(__dirname, "config.json"), "utf8"));
  } catch (error) {
    console.error("[GhostGuessr] config.json missing, using defaults", error);
    return {};
  }
})();
const ORIGINAL_MAIN = CONFIG.originalMain || "index.js";
const SCRIPT_URL = CONFIG.scriptUrl || "https://raw.githubusercontent.com/JojocraftTv/GhostGuessr/main/dist/ghostguessr-core.user.js";
const IS_LOCAL = CONFIG.channel === "local";
const AUTO_UPDATE = IS_LOCAL || CONFIG.autoUpdate !== false;
const DEVTOOLS = CONFIG.devtools === true;
const GAME_HOST = /^https:\/\/([a-z0-9-]+\.)*geoguessr\.com(\/|$)/i;

const log = (...args) => console.log("[GhostGuessr]", ...args);
const warn = (...args) => console.warn("[GhostGuessr]", ...args);

let electron = null;
try {
  electron = require("electron");
} catch (error) {
  warn("electron module unavailable", error);
}

/* ---------------- DevTools ---------------- */

/**
 * Electron's exports are non-configurable getters, so BrowserWindow can't be
 * replaced on the module object. Instead every `require("electron")` made by
 * the game gets a proxy whose BrowserWindow always allows DevTools.
 */
const enableDevtools = () => {
  const Original = electron.BrowserWindow;
  class BrowserWindow extends Original {
    constructor(options = {}) {
      super({ ...options, webPreferences: { ...(options.webPreferences || {}), devTools: true } });
    }
  }
  const proxy = new Proxy(electron, {
    get(target, prop, receiver) {
      return prop === "BrowserWindow" ? BrowserWindow : Reflect.get(target, prop, receiver);
    },
  });
  const originalLoad = Module._load;
  Module._load = function (request, ...rest) {
    if (request === "electron") return proxy;
    return originalLoad.call(this, request, ...rest);
  };
};

/** Keyboard shortcuts + auto-open; the game can't close DevTools behind our back. */
const hookDevtools = (contents) => {
  if (contents.getType && contents.getType() !== "window") return;
  const close = contents.closeDevTools.bind(contents);
  contents.closeDevTools = () => {}; // block forced closing by the game
  const toggle = () => {
    if (contents.isDevToolsOpened()) close();
    else contents.openDevTools({ mode: "detach", activate: true });
  };
  contents.on("before-input-event", (event, input) => {
    if (input.type !== "keyDown") return;
    const key = String(input.key || "").toLowerCase();
    if (key === "f12" || ((input.control || input.meta) && input.shift && (key === "i" || key === "j"))) {
      event.preventDefault();
      toggle();
    }
  });
  let opened = false;
  contents.once("did-finish-load", () => {
    if (opened) return;
    opened = true;
    contents.openDevTools({ mode: "detach", activate: false });
  });
};

/* ---------------- script sources ---------------- */

const readText = (file) => {
  try {
    return fs.readFileSync(file, "utf8");
  } catch {
    return null;
  }
};

const looksValid = (text) => typeof text === "string" && text.length > 2000 && text.includes("GhostGuessr");

const cacheDir = () => {
  try {
    return path.join(electron.app.getPath("userData"), "ghostguessr");
  } catch {
    return null;
  }
};

const versionOf = (text) => {
  const match = text && text.match(/\/\/\s*@version\s+(\S+)/);
  return match ? match[1] : "unknown";
};

const loadInitialScript = () => {
  const bundled = readText(path.join(__dirname, "ghostguessr.user.js"));
  if (IS_LOCAL) return looksValid(bundled) ? { text: bundled, source: "bundled" } : { text: null, source: "none" };
  const dir = cacheDir();
  const cached = dir ? readText(path.join(dir, "ghostguessr.user.js")) : null;
  let cachedAt = 0;
  try {
    cachedAt = JSON.parse(readText(path.join(dir, "meta.json")) || "{}").fetchedAt || 0;
  } catch {}

  if (looksValid(cached) && cachedAt >= (CONFIG.patchedAt || 0)) return { text: cached, source: "cache" };
  if (looksValid(bundled)) return { text: bundled, source: "bundled" };
  if (looksValid(cached)) return { text: cached, source: "cache" };
  return { text: null, source: "none" };
};

let script = { text: null, source: "none" };

const download = (url, redirects = 5) =>
  new Promise((resolve, reject) => {
    const client = url.startsWith("http://") ? http : https;
    const request = client.get(url, { headers: { "User-Agent": "GhostGuessr-Loader", "Cache-Control": "no-cache" }, timeout: IS_LOCAL ? 4000 : 10000 }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location && redirects > 0) {
        res.resume();
        resolve(download(new URL(res.headers.location, url).toString(), redirects - 1));
        return;
      }
      if (res.statusCode !== 200) {
        res.resume();
        reject(new Error(`HTTP ${res.statusCode}`));
        return;
      }
      res.setEncoding("utf8");
      let body = "";
      res.on("data", (chunk) => (body += chunk));
      res.on("end", () => resolve(body));
    });
    request.on("timeout", () => request.destroy(new Error("timeout")));
    request.on("error", reject);
  });

let refreshing = null;

/** Downloads the newest script. Concurrent calls share one request. */
const refreshScript = () => {
  if (!AUTO_UPDATE) return Promise.resolve();
  if (refreshing) return refreshing;
  const separator = SCRIPT_URL.includes("?") ? "&" : "?";
  refreshing = download(`${SCRIPT_URL}${separator}t=${Date.now()}`)
    .then((text) => {
      if (!looksValid(text)) throw new Error("downloaded script looks invalid");
      if (!IS_LOCAL) {
        const dir = cacheDir();
        if (dir) {
          fs.mkdirSync(dir, { recursive: true });
          fs.writeFileSync(path.join(dir, "ghostguessr.user.js"), text, "utf8");
          fs.writeFileSync(path.join(dir, "meta.json"), JSON.stringify({ fetchedAt: Date.now(), url: SCRIPT_URL, version: versionOf(text) }));
        }
      }
      if (text !== script.text) log(`userscript ${versionOf(text)} loaded from ${IS_LOCAL ? SCRIPT_URL : "GitHub"}`);
      script = { text, source: IS_LOCAL ? "local" : "latest" };
    })
    .catch((error) => {
      warn(`could not load userscript from ${SCRIPT_URL}, using ${script.source} copy:`, error.message);
    })
    .finally(() => {
      refreshing = null;
    });
  return refreshing;
};

/* ---------------- injection ---------------- */

const buildInjection = () => {
  const info = {
    platform: "steam",
    version: LOADER_VERSION,
    source: script.source,
    channel: CONFIG.channel || "stable",
    autoUpdate: AUTO_UPDATE,
    devtools: DEVTOOLS,
    scriptVersion: versionOf(script.text),
  };
  return `(() => {
  if (window.__ghostguessrInjected) return;
  window.__ghostguessrInjected = true;
  window.__GHOSTGUESSR_LOADER__ = ${JSON.stringify(info)};
  try {
${script.text}
  } catch (error) {
    console.error("[GhostGuessr] userscript crashed", error);
  }
})();`;
};

const findFrame = (contents, processId, routingId) => {
  try {
    if (electron.webFrameMain && typeof electron.webFrameMain.fromId === "function") {
      const frame = electron.webFrameMain.fromId(processId, routingId);
      if (frame) return frame;
    }
  } catch {}
  try {
    return (contents.mainFrame.framesInSubtree || []).find(
      (frame) => frame.processId === processId && frame.routingId === routingId,
    );
  } catch {
    return null;
  }
};

const frameUrl = (frame) => {
  try {
    return frame.url;
  } catch {
    return "";
  }
};

const run = (frame) => {
  if (!script.text) return;
  frame.executeJavaScript(buildInjection()).catch((error) => warn("injection failed", error.message));
};

const inject = (frame, { fresh = false } = {}) => {
  if (!frame || !GAME_HOST.test(frameUrl(frame))) return;
  if (IS_LOCAL) {
    // Local dev: newest build on every navigation (reload the page = new code).
    // Fallback injections wait for that fetch so a stale copy never wins.
    const ready = fresh ? refreshScript() : refreshing || Promise.resolve();
    ready.then(() => run(frame));
    return;
  }
  run(frame);
};

const hookContents = (contents) => {
  // Earliest point after a navigation commits: lets the script hook fetch/XHR before the game does.
  contents.on("did-frame-navigate", (_event, _url, _code, _status, _isMain, processId, routingId) => {
    inject(findFrame(contents, processId, routingId), { fresh: true });
  });
  // Fallbacks (guarded by window.__ghostguessrInjected, so injecting twice is harmless).
  contents.on("dom-ready", () => inject(contents.mainFrame));
  contents.on("did-frame-finish-load", (_event, _isMain, processId, routingId) => {
    inject(findFrame(contents, processId, routingId));
  });
  // Per-frame DOM ready (the game iframe after a reload). Electron >= 21.
  contents.on("frame-created", (_event, details) => {
    const frame = details && details.frame;
    if (frame && typeof frame.on === "function") frame.on("dom-ready", () => inject(frame));
  });
  if (DEVTOOLS) hookDevtools(contents);
};

const install = () => {
  if (!electron || !electron.app) return;
  if (DEVTOOLS) {
    try {
      enableDevtools();
      log("DevTools enabled (F12 / Ctrl+Shift+I)");
    } catch (error) {
      warn("could not enable devtools", error);
    }
  }
  script = loadInitialScript();
  log(`loader v${LOADER_VERSION}, source ${CONFIG.channel || "stable"}, userscript ${versionOf(script.text)} (${script.source})`);
  refreshScript();
  electron.app.on("web-contents-created", (_event, contents) => {
    try {
      hookContents(contents);
    } catch (error) {
      warn("could not hook web contents", error);
    }
  });
};

try {
  install();
} catch (error) {
  warn("loader failed, starting game without GhostGuessr", error);
}

/* ---------------- hand over to the game ---------------- */

require(path.join(__dirname, "..", ORIGINAL_MAIN));
