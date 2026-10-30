import { settings } from "../core/settings.js";
import { platform } from "../core/env.js";

/**
 * Tiny declarative API for GhostGuessr settings.
 *
 * Describe a setting once; every settings page (in-game dialog tab, main-menu
 * settings page, Keybindings tab) renders it with GeoGuessr's own components.
 *
 *   toggle("streamerMode", "Streamer mode", { note: "Blurs names", platform: "web" })
 *   slider("size", "Size", { min: 4, max: 20 }, { when: (s) => s.gameMode !== "safety" })
 *
 * Common options (every builder):
 *   when:     (settings) => boolean   show only when true (re-evaluated live)
 *   platform: "web" | "steam"         show only on that platform
 *   icon:     name from ICONS          icon on pages that use icons
 *   note:     string | (settings) => string   small help text
 *
 * The setting key must exist in DEFAULT_SETTINGS (core/settings.js).
 * Pages re-render automatically when a toggle/choice/hotkey value changes.
 */

const item = (type, props, options = {}) => ({ type, ...props, ...options });

/** On/off switch for a boolean setting. */
export const toggle = (key, label, options) => item("toggle", { key, label }, options);

/** One of several values: `choices` = [{ value, label }]. */
export const choice = (key, label, choices, options) => item("choice", { key, label, choices }, options);

/** Numeric slider. `percent: true` stores 0..1 and shows 0..100%. */
export const slider = (key, label, { min, max, step = 1, unit = "", percent = false }, options) =>
  item("slider", { key, label, min, max, step, unit, percent }, options);

/** Color picker for a "#RRGGBB" setting. */
export const color = (key, label, options) => item("color", { key, label }, options);

/** Key binding. `forbidden` = setting keys whose keys can't be reused. */
export const hotkey = (key, label, description, { forbidden = [], ...options } = {}) =>
  item("hotkey", { key, label, description, forbidden }, options);

/** Button that runs `onClick`. `buttonLabel` may be a function of settings. */
export const button = (label, buttonLabel, onClick, options) => item("button", { label, buttonLabel, onClick }, options);

/** Informational text, optionally with a link { url, label }. */
export const note = (text, options) => item("note", { text }, options);

/** Group of items (a card on the main-menu page, a headed block in the dialog). */
export const section = (title, items, options) => item("section", { title, items }, options);

/* ---------- helpers for renderers ---------- */

export const value = (v) => (typeof v === "function" ? v(settings) : v);

export const isVisible = (it) =>
  (!it.platform || it.platform === platform) && (!it.when || !!it.when(settings));

/** Visible items of a section (or a list of sections). */
export const visibleItems = (items) => items.filter(isVisible);

/** All items of a given type across a schema (e.g. every hotkey for the Keybindings tab). */
export const collect = (schema, type) =>
  schema.flatMap((it) => (it.type === "section" ? collect(it.items, type) : it.type === type && isVisible(it) ? [it] : []));

/**
 * Keys edited by sliders/colors change continuously while dragging; pages must
 * not re-render for those (it would recreate the input under the cursor).
 */
export const liveKeys = (schema) =>
  new Set(schema.flatMap((it) => (it.type === "section" ? [...liveKeys(it.items)] : it.type === "slider" || it.type === "color" ? [it.key] : [])));
