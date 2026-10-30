import { settings, watch } from "../core/settings.js";
import { isSteam } from "../core/env.js";
import { whenBody } from "../core/dom.js";

/**
 * Streamer mode hides identifying information (names, avatars, flags, club
 * tags) with a stylesheet. Pure CSS: nothing in GeoGuessr's DOM is rewritten,
 * so turning it off restores everything instantly.
 */

const STYLE_ID = "gg-streamer-mode";

const BLUR = [
  '[class*="user-nick_nick__"]',
  '[class*="user-nick_root__"]',
  '[class*="header-profile_title__"]',
  '[class*="chat-friend_name__"]',
  '[class*="player-name"]',
  '[class*="playerName"]',
  '[class*="player-card_name"]',
  '[class*="nick_nick"]',
  '[class*="avatar_titleAvatarImage__"]',
  '[class*="avatar_avatar__"] img',
  '[class*="play-along-standings_avatar__"]',
  '[data-qa="guess-marker"] img',
  '[class*="map-pin_mapPin__"] img',
];

const HIDE = [
  '[class*="club-tag_clubTag__"]',
  '[class*="user-nick_flag__"]',
  '[class*="country-flag_flag__"]',
];

const CSS = `
${BLUR.join(",\n")} { filter: blur(7px) !important; transition: filter .15s ease; }
${HIDE.join(",\n")} { visibility: hidden !important; }
`;

const apply = async () => {
  await whenBody();
  const existing = document.getElementById(STYLE_ID);
  if (!settings.streamerMode) {
    if (existing) existing.remove();
    return;
  }
  if (existing) return;
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = CSS;
  (document.head || document.documentElement).appendChild(style);
};

export const initStreamerMode = () => {
  if (isSteam) return;
  watch("streamerMode", apply);
  apply();
};
