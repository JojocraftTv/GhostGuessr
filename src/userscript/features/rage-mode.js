import { settings, watch } from "../core/settings.js";
import { state, hasOrigin } from "../core/state.js";
import { on } from "../core/events.js";
import { createLogger } from "../core/logger.js";
import { getGoogleMap, getMaps } from "./google-map.js";

/**
 * Rage mode (third mode next to Normal and Safety): places your guess pin on
 * the exact round location.
 *  - trigger "hotkey": press the rage hotkey to pin
 *  - trigger "auto":   pins automatically shortly after each round starts
 */

const log = createLogger("Rage");
const RETRY_MS = 500;
const MAX_RETRIES = 40;

let pinnedRoundKey = null;
let autoTimer = null;

const roundKey = () => `${state.roundId}|${state.roundNumber}|${state.origin.lat},${state.origin.lng}`;

const isRage = () => settings.gameMode === "rage";

const targetPoint = () => (hasOrigin() ? { ...state.origin } : null);

/** Fires the guess map's click listeners as if the user clicked `point`. */
const clickMap = (point) => {
  const maps = getMaps();
  const map = getGoogleMap();
  if (!maps || !map) return false;
  const latLng = new maps.LatLng(point.lat, point.lng);
  const event = { latLng, stop() {} };

  if (maps.event && typeof maps.event.trigger === "function") {
    try {
      maps.event.trigger(map, "click", event);
      return true;
    } catch (error) {
      log.debug("trigger failed, falling back", error);
    }
  }

  // Fallback: call the registered click handlers directly.
  const handlers = map.__e3_ && map.__e3_.click;
  if (!handlers) return false;
  let fired = false;
  for (const entry of Object.values(handlers)) {
    const fn = typeof entry === "function" ? entry : entry && (entry.handler || entry.Ag || entry.callback);
    if (typeof fn === "function") {
      fn.call(map, event);
      fired = true;
    }
  }
  return fired;
};

/** Places the pin now. Returns true on success. */
export const pinGuess = async () => {
  const point = targetPoint();
  if (!point) return false;
  const ok = clickMap(point);
  if (ok) {
    pinnedRoundKey = roundKey();
    log.debug("pinned", point);
  }
  return ok;
};

const scheduleAutoPin = () => {
  clearTimeout(autoTimer);
  if (!isRage() || settings.rageTrigger !== "auto" || !hasOrigin()) return;
  if (pinnedRoundKey === roundKey()) return;

  let attempts = 0;
  const attempt = async () => {
    if (!isRage() || settings.rageTrigger !== "auto" || pinnedRoundKey === roundKey()) return;
    if (await pinGuess()) return;
    if (++attempts < MAX_RETRIES) autoTimer = setTimeout(attempt, RETRY_MS);
  };
  autoTimer = setTimeout(attempt, Math.max(0, Number(settings.rageDelay) || 0) * 1000);
};

export const initRageMode = () => {
  on("rage:pin", () => {
    if (isRage()) pinGuess();
  });
  on("round:start", scheduleAutoPin);
  watch(["rageTrigger", "gameMode"], scheduleAutoPin);
};
