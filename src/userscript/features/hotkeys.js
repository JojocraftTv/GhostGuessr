import { settings } from "../core/settings.js";
import { emit } from "../core/events.js";
import { toggleMarker } from "./ghost-marker.js";

/**
 * Keyboard shortcuts:
 *   <hotkey>       toggle ghost marker
 *   <rageHotkey>   place the guess pin (Rage mode, trigger "hotkey")
 */

const isTyping = (event) => {
  const target = event.composedPath ? event.composedPath()[0] : event.target;
  if (!target || !(target instanceof Element)) return false;
  return target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName);
};

/** Normalised name of a key event, matching the format stored in settings. */
export const keyName = (event) => {
  // Prefer the physical key so Shift+1 is still "1" (event.key would be "!").
  const code = event.code || "";
  const physical = code.match(/^(?:Key([A-Z])|Digit(\d)|Numpad(\d))$/);
  if (physical) return physical[1] || physical[2] || physical[3];
  if (code === "Space" || event.key === " ") return "SPACE";
  return event.key.length === 1 ? event.key.toUpperCase() : event.key;
};

let recording = false;
/** While true, global shortcuts are suspended (hotkey recorder is active). */
export const setRecording = (value) => {
  recording = !!value;
};

const onKeyDown = (event) => {
  if (recording || event.repeat || event.ctrlKey || event.altKey || event.metaKey || isTyping(event)) return;
  const key = keyName(event);
  if (key === String(settings.hotkey).toUpperCase()) {
    event.preventDefault();
    event.stopPropagation();
    toggleMarker();
  } else if (settings.gameMode === "rage" && settings.rageTrigger === "hotkey" && key === String(settings.rageHotkey).toUpperCase()) {
    event.preventDefault();
    event.stopPropagation();
    emit("rage:pin");
  }
};

export const initHotkeys = () => {
  document.addEventListener("keydown", onKeyDown, true);
};
