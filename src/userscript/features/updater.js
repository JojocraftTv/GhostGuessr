import { VERSION, CHANNEL, RELEASE_API_URL, INSTALL_URL, RELEASES_URL, isSteam, loader } from "../core/env.js";
import { nativeFetch } from "../net/interceptor.js";
import { emit } from "../core/events.js";
import { createLogger } from "../core/logger.js";

/**
 * Update checks. Results are shown inside the GhostGuessr section of the
 * game's settings menu (no popups).
 *  - Steam + current patcher: the loader updates automatically; nothing to do.
 *  - Steam + legacy patch: ask the user to run the new patcher once.
 *  - Web: compare the newest GitHub release of our channel with our version
 *    (stable: latest v* release, beta: the rolling "beta" pre-release).
 */

const log = createLogger("Updater");
const CHECK_DELAY_MS = 8000;

/** { text, linkLabel?, url? } or null */
let notice = null;
export const getUpdateNotice = () => notice;

const setNotice = (next) => {
  notice = next;
  emit("update:notice", notice);
};

/** -1 / 0 / 1 like a comparator; non-numeric parts compare as 0. */
export const compareVersions = (a, b) => {
  const pa = String(a).replace(/^v/, "").split(/[.-]/).map((n) => parseInt(n, 10) || 0);
  const pb = String(b).replace(/^v/, "").split(/[.-]/).map((n) => parseInt(n, 10) || 0);
  for (let i = 0; i < Math.max(pa.length, pb.length); i += 1) {
    const diff = (pa[i] || 0) - (pb[i] || 0);
    if (diff) return diff > 0 ? 1 : -1;
  }
  return 0;
};

const VERSION_PATTERN = /\d+\.\d+\.\d+(?:-[0-9A-Za-z.]+)?/;

/** Version of the newest release of our channel (from the release tag or title). */
const fetchRemoteVersion = async () => {
  const doFetch = nativeFetch || window.fetch.bind(window);
  const response = await doFetch(RELEASE_API_URL, { cache: "no-cache", headers: { Accept: "application/vnd.github+json" } });
  if (!response.ok) return null;
  const release = await response.json();
  const match = `${release.tag_name || ""} ${release.name || ""}`.match(VERSION_PATTERN);
  return match ? match[0] : null;
};

const checkRemote = async () => {
  if (CHANNEL === "dev" || /dev/i.test(VERSION)) return;
  try {
    const remote = await fetchRemoteVersion();
    if (!remote || compareVersions(remote, VERSION) <= 0) return;
    setNotice(
      isSteam
        ? { text: `Update v${remote} available — restart the game to install it.` }
        : { text: `Update v${remote} available.`, linkLabel: "Install", url: INSTALL_URL },
    );
  } catch (error) {
    log.debug("update check failed", error);
  }
};

export const initUpdater = () => {
  if (isSteam && !loader) {
    setNotice({ text: "Old Steam patch — run the latest GhostGuessr Patcher once.", linkLabel: "Download", url: RELEASES_URL });
    return;
  }
  if (isSteam && loader && loader.autoUpdate) return;
  setTimeout(checkRemote, CHECK_DELAY_MS);
};
