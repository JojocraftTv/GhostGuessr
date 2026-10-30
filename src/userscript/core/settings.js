import { storage } from "./storage.js";
import { emit, on } from "./events.js";

const STORAGE_KEY = "ghostguessr_settings";

export const DEFAULT_SETTINGS = Object.freeze({
  enabled: false,
  hotkey: "1",
  gameMode: "normal", // "normal" | "safety" | "rage"

  // Ghost marker (round start location)
  markerColor: "#FF0000",
  outlineColor: "#FFFFFF",
  opacity: 0.7,
  outlineWidth: 2,
  size: 10,

  // Street View marker (current panorama)
  showStreetviewMarker: false,
  streetviewMarkerColor: "#3B82F6",
  streetviewMarkerOutline: "#FFFFFF",
  streetviewMarkerSize: 6,
  streetviewMarkerOutlineWidth: 2,
  streetviewMarkerOpacity: 0.7,

  // Score predictor
  showScorePredictor: true,
  scorePredictorDisplay: "both", // "both" | "score" | "distance"
  showConnectionLine: false,

  // Safety mode
  safetyModeRegion: "country", // "country" | "state"
  safetyDetailed: true,
  safetyOutlineColor: "#10B981",
  safetyOutlineOpacity: 0.8,
  safetyOutlineWidth: 2,

  // Rage mode (gameMode "rage"): places your guess on the exact location
  rageTrigger: "hotkey", // "hotkey" | "auto"
  rageHotkey: "2",
  rageDelay: 2, // seconds before an automatic pin

  // Skinchanger: unlock avatar items locally (web + Steam)
  skinchanger: false,

  // Web-only extras
  autoClaimRewards: true,
  streamerMode: false,
  dailyShopNextClaimAt: null,
  lastClaimedLevel: null,
});

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

const normalizeOpacity = (value, fallback) => {
  if (typeof value !== "number" || Number.isNaN(value)) return fallback;
  if (value > 1) return clamp(value / 100, 0, 1);
  return clamp(value, 0, 1);
};

/** Upgrades settings saved by older GhostGuessr versions. */
const migrate = (saved) => {
  const next = { ...DEFAULT_SETTINGS, ...saved };
  if (typeof saved.autoClaimRewards !== "boolean" && typeof saved.autoClaimDailyShop === "boolean") {
    next.autoClaimRewards = saved.autoClaimDailyShop;
  }
  if (saved.rageMode === true && next.gameMode !== "safety") next.gameMode = "rage"; // v3.0 toggle -> mode
  if (!["normal", "safety", "rage"].includes(next.gameMode)) next.gameMode = "normal";
  delete next.rageMode;
  if (!["both", "score", "distance"].includes(next.scorePredictorDisplay)) next.scorePredictorDisplay = "both";
  if (typeof next.hotkey !== "string" || !next.hotkey) next.hotkey = DEFAULT_SETTINGS.hotkey;
  if (typeof next.rageHotkey !== "string" || !next.rageHotkey) next.rageHotkey = DEFAULT_SETTINGS.rageHotkey;
  if (!["hotkey", "auto"].includes(next.rageTrigger)) next.rageTrigger = "hotkey";
  delete next.showLauncher;
  for (const key of ["opacity", "streetviewMarkerOpacity", "safetyOutlineOpacity"]) {
    next[key] = normalizeOpacity(next[key], DEFAULT_SETTINGS[key]);
  }
  delete next.autoClaimDailyShop;
  // v3.0 kept the Skinchanger flag in its own storage key.
  if (typeof saved.skinchanger !== "boolean") next.skinchanger = storage.get("gg_local_save_only_v1", false) === true;
  return next;
};

const load = () => {
  const saved = storage.get(STORAGE_KEY, null);
  return saved && typeof saved === "object" ? migrate(saved) : { ...DEFAULT_SETTINGS };
};

/** Live settings object. Read freely; write through `set`/`update`. */
export const settings = load();

const persist = () => storage.set(STORAGE_KEY, { ...settings });

export const get = (key) => settings[key];

export const set = (key, value) => update({ [key]: value });

export const update = (patch) => {
  const changes = [];
  for (const [key, value] of Object.entries(patch)) {
    if (settings[key] === value) continue;
    changes.push({ key, value, previous: settings[key] });
    settings[key] = value;
  }
  if (!changes.length) return;
  persist();
  for (const change of changes) emit("settings:change", change);
};

export const toggle = (key) => set(key, !settings[key]);

export const reset = () => {
  const { dailyShopNextClaimAt, lastClaimedLevel } = settings;
  update({ ...DEFAULT_SETTINGS, dailyShopNextClaimAt, lastClaimedLevel });
};

/**
 * Subscribe to changes of specific keys (or all keys when `keys` is empty).
 * Returns an unsubscribe function.
 */
export const watch = (keys, handler) => {
  const wanted = new Set(Array.isArray(keys) ? keys : [keys]);
  return on("settings:change", (change) => {
    if (!wanted.size || wanted.has(change.key)) handler(change);
  });
};
