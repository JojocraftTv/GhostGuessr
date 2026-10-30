/* global __GG_VERSION__, __GG_CHANNEL__, unsafeWindow, GM_getValue, GM_setValue */

/**
 * Runtime environment: which window we run in, which platform (web / Steam)
 * and which userscript APIs are available.
 */

export const VERSION = typeof __GG_VERSION__ !== "undefined" ? __GG_VERSION__ : "dev";

/** "stable" (v* tag releases), "beta" (pre-release per commit) or "dev" (local build). */
export const CHANNEL = typeof __GG_CHANNEL__ !== "undefined" ? __GG_CHANNEL__ : "dev";

export const REPO_URL = "https://github.com/JojocraftTv/GhostGuessr";
export const RAW_BASE = "https://raw.githubusercontent.com/JojocraftTv/GhostGuessr/main";
export const ICON_URL = `${RAW_BASE}/icons/GhostGuessr.png`;
export const RELEASES_URL = `${REPO_URL}/releases/latest`;

const API = "https://api.github.com/repos/JojocraftTv/GhostGuessr/releases";
/** GitHub API endpoint of the release this build updates from (CORS-enabled). */
export const RELEASE_API_URL = CHANNEL === "beta" ? `${API}/tags/beta` : `${API}/latest`;
/** Installable userscript of this channel (opens the Tampermonkey update dialog). */
export const INSTALL_URL =
  CHANNEL === "beta"
    ? `${REPO_URL}/releases/download/beta/GhostGuessr.beta.user.js`
    : `${REPO_URL}/releases/latest/download/GhostGuessr.user.js`;

/** The real page window (Tampermonkey sandboxes `window` unless inject-into page works). */
export const pageWindow = typeof unsafeWindow !== "undefined" ? unsafeWindow : window;

export const hasGMStorage =
  typeof GM_getValue === "function" && typeof GM_setValue === "function";

/**
 * Information the Steam loader (patcher bootstrap) publishes before the script runs.
 * `null` when running as a browser userscript or with a legacy patch.
 */
export const loader = (() => {
  try {
    const info = pageWindow.__GHOSTGUESSR_LOADER__;
    return info && typeof info === "object" ? info : null;
  } catch {
    return null;
  }
})();

const detectSteam = () => {
  if (loader && loader.platform === "steam") return true;
  try {
    if (window.location.pathname.includes("/steam")) return true;
    if (window.self !== window.top) {
      try {
        const frame = window.parent.document.getElementById("game-iframe");
        if (frame && String(frame.src).includes("/steam")) return true;
      } catch {
        // Cross-origin parent (Electron file:// shell) -> we are the game iframe.
        if (document.referrer.includes("/steam") || document.referrer.startsWith("file:")) return true;
      }
    }
    return /electron/i.test(navigator.userAgent);
  } catch {
    return false;
  }
};

export const isSteam = detectSteam();
export const platform = isSteam ? "steam" : "web";
