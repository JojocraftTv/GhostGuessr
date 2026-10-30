import { h } from "../core/dom.js";
import { settings, set } from "../core/settings.js";
import { keyName, setRecording } from "../features/hotkeys.js";

/**
 * Controls built from GeoGuessr's own settings components (see
 * new-style-website.txt), so GhostGuessr settings are indistinguishable from
 * the game's settings.
 *
 * GeoGuessr uses CSS modules with hashed class names (`toggle_input__J1j0L`).
 * `cls()` reads the current hash from the live DOM by prefix and falls back
 * to the names captured in new-style-website.txt.
 */

const FALLBACKS = {
  "game-menu_row__": "game-menu_row__LXIEB",
  "game-menu_rowLabel__": "game-menu_rowLabel__kRJdj",
  "game-menu_rowControl__": "game-menu_rowControl__xIH5i",
  "game-menu_rowNote__": "game-menu_rowNote__KPeM1",
  "game-menu_rowState__": "game-menu_rowState__1dqtU",
  "game-menu_rowSlider__": "game-menu_rowSlider__ZgPKC",
  "game-menu_divider__": "game-menu_divider__IhA4t",
  "game-menu_cardGroup__": "game-menu_cardGroup__TW9px",
  "game-menu_card__": "game-menu_card__56_tF",
  "game-menu_tabPanel__": "game-menu_tabPanel__y04Ng",
  "toggle_toggle__": "toggle_toggle__pfzbJ",
  "toggle_input__": "toggle_input__J1j0L",
  "range-slider_field__": "range-slider_field__81E5M",
  "range-slider_thumbvalue__": "range-slider_thumbvalue__4_btp",
  "range-slider_rangeSlider__": "range-slider_rangeSlider__oiTum",
  "range-slider_bubble__": "range-slider_bubble__osc99",
  "field_wrapper__": "field_wrapper__YlO2q",
  "field_label__": "field_label__ggtU_",
  "toggle-card_card__": "toggle-card_card__p49en",
  "radio_radio__": "radio_radio__MGPcr",
  "radio_indicator__": "radio_indicator__p9I4x",
  "tabs_trigger__": "tabs_trigger__KOf2y",
  "tabs_panel__": "tabs_panel__kxgNF",
  "button_button__": "button_button__HOmVR",
  "button_variantSecondary__": "button_variantSecondary__H_JVo",
  "button_wrapper__": "button_wrapper__C_4h8",
  "button_label__": "button_label__mIsIc",
  "key-bindings-settings_group__": "key-bindings-settings_group__38scd",
  "key-bindings-settings_groupTitle__": "key-bindings-settings_groupTitle__vcWpO",
  "key-bindings-settings_groupGrid__": "key-bindings-settings_groupGrid__RzyMk",
  "key-binding-row_root__": "key-binding-row_root__pZxiL",
  "surfaces_surfaceSunken__": "surfaces_surfaceSunken__aZbKC",
  "key-binding-row_text__": "key-binding-row_text__I2wOd",
  "key-binding-row_label__": "key-binding-row_label__9Aoww",
  "key-binding-row_description__": "key-binding-row_description__6hmnU",
  "key-binding-row_controls__": "key-binding-row_controls__HG086",
  "key-binding-row_keys__": "key-binding-row_keys__KsA_l",
  "key-binding-row_slot__": "key-binding-row_slot__KX7zs",
  "key-binding-row_slotButton__": "key-binding-row_slotButton__LFTtM",
  "interactive_interactive__": "interactive_interactive__iQukZ",
  "kbd_kbd__": "kbd_kbd__IrxDJ",
};

const cache = new Map();

/** Current hashed class for a GeoGuessr CSS-module prefix, e.g. cls("toggle_input__"). */
export const cls = (prefix) => {
  if (cache.has(prefix)) return cache.get(prefix);
  const el = document.querySelector(`[class*="${prefix}"]:not([data-gg] *):not([data-gg])`);
  const found = el && Array.from(el.classList).find((c) => c.startsWith(prefix));
  if (found) cache.set(prefix, found);
  return found || FALLBACKS[prefix] || prefix;
};

/** Forget resolved classes (GeoGuessr may have shipped a new build). */
export const resetClassCache = () => cache.clear();

const c = (...prefixes) => prefixes.map(cls).join(" ");

let uid = 0;
const nextId = (name) => `gg-${name}-${++uid}`;

/* ---------- layout ---------- */

/** Native settings row: label on the left, control on the right, optional note below. */
export const row = (label, control, note = null) =>
  h(
    "div",
    { class: cls("game-menu_row__"), "data-gg": "" },
    h("p", { class: cls("game-menu_rowLabel__") }, label),
    h("div", { class: cls("game-menu_rowControl__") }, control),
    note && h("p", { class: cls("game-menu_rowNote__") }, note),
  );

export const divider = () => h("div", { class: cls("game-menu_divider__"), "data-gg": "" });

/** Group heading (same component as the Keybindings tab headings). */
export const heading = (text) => h("h3", { class: `${cls("key-bindings-settings_groupTitle__")} gg-heading`, "data-gg": "" }, text);

export const note = (text, link = null) =>
  h(
    "p",
    { class: `${cls("game-menu_rowNote__")} gg-note`, "data-gg": "" },
    text,
    link && " ",
    link && h("a", { href: link.url, target: "_blank", rel: "noopener" }, link.label),
  );

/* ---------- controls ---------- */

/** Native switch bound to a boolean setting. */
export const toggle = (key, label, { note: rowNote = null, onChange = null } = {}) => {
  const state = h("span", { class: cls("game-menu_rowState__") }, settings[key] ? "On" : "Off");
  const input = h("input", { role: "switch", class: cls("toggle_input__"), type: "checkbox", "aria-label": label });
  input.checked = !!settings[key];
  input.addEventListener("change", () => {
    state.textContent = input.checked ? "On" : "Off";
    set(key, input.checked);
    if (onChange) onChange(input.checked);
  });
  return row(label, [h("span", { class: cls("toggle_toggle__") }, input), state], rowNote);
};

/** Native radio card group bound to a setting. choices: [{ value, label }] */
export const choice = (key, label, choices, { note: rowNote = null } = {}) => {
  const name = nextId(key);
  const cards = choices.map((opt) => {
    const id = nextId(`${key}-${opt.value}`);
    const input = h("input", { id, class: cls("radio_radio__"), type: "radio", value: String(opt.value), name });
    input.checked = settings[key] === opt.value;
    input.addEventListener("change", () => input.checked && set(key, opt.value));
    return h(
      "div",
      { class: c("field_wrapper__", "toggle-card_card__", "game-menu_card__"), "data-layout": "row" },
      input,
      h("span", { "aria-hidden": "true", class: cls("radio_indicator__") }),
      h("label", { class: cls("field_label__"), for: id }, opt.label),
    );
  });
  return row(label, h("div", { role: "group", class: cls("game-menu_cardGroup__") }, cards), rowNote);
};

/** Native range slider. `percent` stores 0..1 and shows 0..100. */
export const slider = (key, label, { min, max, step = 1, unit = "", percent = false } = {}) => {
  const scale = percent ? 100 : 1;
  const format = (v) => (percent ? `${Math.round(v * 100)}%` : `${Number.isInteger(step) ? Math.round(v) : v.toFixed(1)}${unit}`);
  const bubble = h("span", { class: cls("range-slider_bubble__") });
  const input = h("input", {
    class: cls("range-slider_rangeSlider__"),
    type: "range",
    min: min * scale,
    max: max * scale,
    step: step * scale,
    "aria-label": label,
  });
  const thumb = h("span", { class: cls("range-slider_thumbvalue__") }, input, bubble);

  const paint = (value) => {
    const progress = (value - min) / (max - min || 1);
    thumb.style.setProperty("--range-progress-num", String(progress));
    input.style.setProperty("--range-progress", `${progress * 100}%`);
    bubble.textContent = format(value);
  };
  input.value = String(Number(settings[key]) * scale);
  paint(Number(settings[key]));
  input.addEventListener("input", () => {
    const value = Number(input.value) / scale;
    paint(value);
    set(key, value);
  });
  return row(label, h("div", { class: c("range-slider_field__", "game-menu_rowSlider__") }, thumb));
};

const HEX = /^#[0-9a-f]{6}$/i;

/** Color picker (GeoGuessr has none; styled to sit in a native row). */
export const color = (key, label) => {
  const input = h("input", { type: "color", class: "gg-color", "aria-label": label });
  input.value = HEX.test(settings[key]) ? settings[key].toLowerCase() : "#000000";
  const value = h("span", { class: cls("game-menu_rowState__") }, String(settings[key]).toUpperCase());
  input.addEventListener("input", () => {
    value.textContent = input.value.toUpperCase();
    set(key, input.value.toUpperCase());
  });
  return row(label, [input, value]);
};

/** Native secondary button inside a row. */
export const button = (label, buttonLabel, onClick, rowNote = null) =>
  row(
    label,
    h(
      "button",
      { type: "button", class: c("button_button__", "button_variantSecondary__"), onClick },
      h("div", { class: cls("button_wrapper__") }, h("span", { class: cls("button_label__") }, buttonLabel)),
    ),
    rowNote,
  );

/* ---------- key bindings ---------- */

const keyLabel = (value) => (value === "SPACE" ? "Space" : String(value));

/**
 * Native key-binding row (same component as the Keybindings tab).
 * Click the key, press a new one; Esc cancels. `forbidden` = setting keys whose
 * values can't be reused.
 */
export const keyBinding = (key, label, description, { forbidden = [] } = {}) => {
  const text = h("span", {}, keyLabel(settings[key]));
  const slot = h(
    "button",
    {
      type: "button",
      class: c("key-binding-row_slot__", "key-binding-row_slotButton__", "interactive_interactive__"),
      title: "Change this key",
      "aria-label": `${label}: Change this key`,
    },
    h("kbd", { class: cls("kbd_kbd__") }, text),
  );

  let recording = false;
  const stop = () => {
    recording = false;
    setRecording(false);
    window.removeEventListener("keydown", onKey, true);
    text.textContent = keyLabel(settings[key]);
    slot.removeAttribute("data-gg-recording");
  };
  const onKey = (event) => {
    event.preventDefault();
    event.stopPropagation();
    if (event.key === "Escape") return stop();
    const name = keyName(event);
    const valid = /^[A-Z0-9]$/.test(name) || name === "SPACE" || /^F([1-9]|1[0-2])$/.test(name);
    if (!valid || forbidden.some((k) => String(settings[k]).toUpperCase() === name)) return;
    stop();
    set(key, name);
    text.textContent = keyLabel(name);
  };
  slot.addEventListener("click", (event) => {
    event.preventDefault();
    if (recording) return stop();
    recording = true;
    setRecording(true);
    text.textContent = "…";
    slot.setAttribute("data-gg-recording", "");
    window.addEventListener("keydown", onKey, true);
  });
  slot.addEventListener("blur", () => recording && stop());

  return h(
    "div",
    { class: c("key-binding-row_root__", "surfaces_surfaceSunken__"), "data-gg": "" },
    h(
      "div",
      { class: cls("key-binding-row_text__") },
      h("span", { class: cls("key-binding-row_label__") }, label),
      h("span", { class: cls("key-binding-row_description__") }, description),
    ),
    h("div", { class: cls("key-binding-row_controls__") }, h("div", { class: cls("key-binding-row_keys__") }, slot)),
  );
};

/** Native key-binding group: heading + grid of keyBinding rows. */
export const keyBindingGroup = (title, rows) =>
  h(
    "section",
    { class: `${cls("key-bindings-settings_group__")} gg-keybinding-group`, "data-gg": "" },
    h("h3", { class: cls("key-bindings-settings_groupTitle__") }, title),
    h("div", { class: cls("key-bindings-settings_groupGrid__") }, rows),
  );
