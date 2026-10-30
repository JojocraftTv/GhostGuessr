import { getUpdateNotice } from "../features/updater.js";
import { VERSION } from "../core/env.js";
import { section, toggle, choice, slider, color, hotkey, note } from "./schema.js";

/**
 * Every GhostGuessr setting, in display order. Both settings pages and the
 * Keybindings group are generated from this list.
 *
 * To add a setting: add its default to DEFAULT_SETTINGS (core/settings.js)
 * and one line here, e.g.
 *   toggle("myFeature", "My feature", { note: "What it does", icon: "eye" }),
 * then read it anywhere with `settings.myFeature` / react with `watch("myFeature", fn)`.
 */

const notSafety = (s) => s.gameMode !== "safety";

const markerStyle = (keys, sizeRange, options = {}) => [
  color(keys.color, "Color", options),
  color(keys.outline, "Outline color", options),
  slider(keys.size, "Size", { min: sizeRange[0], max: sizeRange[1] }, options),
  slider(keys.outlineWidth, "Outline width", { min: 0, max: 5, step: 0.5 }, options),
  slider(keys.opacity, "Opacity", { min: 0.1, max: 1, step: 0.05, percent: true }, options),
];

const MODE_NOTES = {
  normal: "Ghost marker on the exact location.",
  safety: "Only the country or state is highlighted.",
  rage: "Places your guess on the exact location for you.",
};

export const SETTINGS_SCHEMA = [
  section("GhostGuessr", [
    note(() => getUpdateNotice().text, {
      when: () => !!getUpdateNotice(),
      link: () => {
        const notice = getUpdateNotice();
        return notice && notice.url ? { url: notice.url, label: notice.linkLabel } : null;
      },
    }),
    toggle("enabled", "Ghost marker", { icon: "ghost" }),
    choice(
      "gameMode",
      "Mode",
      [
        { value: "normal", label: "Normal" },
        { value: "safety", label: "Safety" },
        { value: "rage", label: "Rage" },
      ],
      { note: (s) => MODE_NOTES[s.gameMode] },
    ),
    choice(
      "rageTrigger",
      "Pin",
      [
        { value: "hotkey", label: "By hotkey" },
        { value: "auto", label: "Auto pin" },
      ],
      { when: (s) => s.gameMode === "rage" },
    ),
    slider("rageDelay", "Auto pin delay", { min: 0, max: 15, unit: "s" }, {
      icon: "timer",
      when: (s) => s.gameMode === "rage" && s.rageTrigger === "auto",
    }),
  ]),

  section(
    "Safety outline",
    [
      choice("safetyModeRegion", "Region", [
        { value: "country", label: "Country" },
        { value: "state", label: "State" },
      ]),
      toggle("safetyDetailed", "Detailed borders", { icon: "shield" }),
      color("safetyOutlineColor", "Outline color"),
      slider("safetyOutlineWidth", "Outline width", { min: 0.5, max: 5, step: 0.5 }),
      slider("safetyOutlineOpacity", "Opacity", { min: 0.1, max: 1, step: 0.05, percent: true }),
    ],
    { when: (s) => s.gameMode === "safety" },
  ),

  section(
    "Ghost marker",
    markerStyle({ color: "markerColor", outline: "outlineColor", size: "size", outlineWidth: "outlineWidth", opacity: "opacity" }, [4, 20]),
    { when: notSafety },
  ),

  section(
    "Street View marker",
    [
      toggle("showStreetviewMarker", "Show current position", { icon: "eye" }),
      ...markerStyle(
        {
          color: "streetviewMarkerColor",
          outline: "streetviewMarkerOutline",
          size: "streetviewMarkerSize",
          outlineWidth: "streetviewMarkerOutlineWidth",
          opacity: "streetviewMarkerOpacity",
        },
        [3, 15],
        { when: (s) => s.showStreetviewMarker },
      ),
    ],
    { when: notSafety },
  ),

  section(
    "Score predictor",
    [
      toggle("showScorePredictor", "Score predictor", { icon: "score" }),
      choice(
        "scorePredictorDisplay",
        "Display",
        [
          { value: "both", label: "Both" },
          { value: "score", label: "Score" },
          { value: "distance", label: "Distance" },
        ],
        { when: (s) => s.showScorePredictor },
      ),
      toggle("showConnectionLine", "Connection line", { icon: "line" }),
    ],
    { when: notSafety },
  ),

  section("Hotkeys", [
    hotkey("hotkey", "Toggle ghost marker", "Show or hide the ghost marker on the guess map", { forbidden: ["rageHotkey"] }),
    hotkey("rageHotkey", "Rage pin", "Place your guess (Rage mode, pin by hotkey)", { forbidden: ["hotkey"] }),
  ]),

  section("Account", [
    toggle("skinchanger", "Skinchanger", { icon: "ghost", note: "Unlocks all avatar items locally — only you see them." }),
    toggle("autoClaimRewards", "Auto claim rewards", { icon: "gift", platform: "web" }),
    toggle("streamerMode", "Streamer mode", { icon: "eye", platform: "web", note: "Blurs names, avatars, flags and club tags." }),
    note(`GhostGuessr v${VERSION}`),
  ]),
];
