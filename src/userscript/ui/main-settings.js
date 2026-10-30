import { h, isVisible } from "../core/dom.js";
import { settings, set } from "../core/settings.js";
import { keyName, setRecording } from "../features/hotkeys.js";
import { SETTINGS_SCHEMA } from "./settings-schema.js";
import { value, visibleItems } from "./schema.js";
import { createLogger } from "../core/logger.js";
import { makeScrollable } from "./scroll.js";

/**
 * GhostGuessr inside the main-menu settings page (Steam home → settings,
 * web account settings):
 *
 *   div.settings_root__ > div.settings_container__
 *     nav.settings_nav__ > ul.settings_navList__ > li.settings_navItem__ > button.settings_navButton__
 *     div.settings_content__ > div.settings_contentInner__ > div.settings_gameSettingsGrid__ > div.settings_card__
 *
 * We add a "GhostGuessr" nav entry. Selecting it hides GeoGuessr's content and
 * shows our cards, built from the components this page uses (toggle-option,
 * slider-option, switch-option). Clicking any native entry hands back control.
 */

const log = createLogger("MainSettings");
const NAV_ID = "gg-main-settings-nav";
const CONTENT_ID = "gg-main-settings-content";
const HIDDEN_ATTR = "data-gg-hidden";

/** Fallback hashes captured from the Steam client (Oct 2026). */
const FALLBACKS = {
  "settings_navItem__": "settings_navItem__SUDtD",
  "settings_navButton__": "settings_navButton__ORZH3",
  "settings_navButtonActive__": "settings_navButtonActive__XP0v4",
  "settings_contentInner__": "settings_contentInner__mgDgR",
  "settings_gameSettingsGrid__": "settings_gameSettingsGrid__nrmaU",
  "settings_card__": "settings_card__QXq47",
  "settings_cardDivider__": "settings_cardDivider__pSC0x",
  "headline_heading__": "headline_heading__Bc8S9",
  "shared_brand30Variant__": "shared_brand30Variant__9eoPA",
  "shared_boldWeight__": "shared_boldWeight__VXL2d",
  "headline_italic__": "headline_italic__im8EF",
  "flex_flex__": "flex_flex__HeR0i",
  "toggle-option_wrapper__": "toggle-option_wrapper__d1Exy",
  "toggle-option_clickable__": "toggle-option_clickable__cemcy",
  "toggle-option_icon__": "toggle-option_icon__F7_9k",
  "toggle-option_label__": "toggle-option_label__4Otl7",
  "toggle_toggle__": "toggle_toggle__r7x0x",
  "slider-option_wrapper__": "slider-option_wrapper__3gsTQ",
  "slider-option_icon__": "slider-option_icon__qtnY8",
  "slider-option_label__": "slider-option_label__HSXrJ",
  "slider-option_value__": "slider-option_value__OM__C",
  "slider-option_valueLabel__": "slider-option_valueLabel__XS837",
  "slider-option_sliderRow__": "slider-option_sliderRow__Q0l3P",
  "slider-option_slider__": "slider-option_slider__kJaCT",
  "range-slider_field__": "range-slider_field__81E5M",
  "range-slider_rangeSlider__": "range-slider_rangeSlider__oiTum",
  "switch-option_wrapper__": "switch-option_wrapper__WBzdD",
  "switch-option_label__": "switch-option_label__RjpR9",
  "switch-option_switch__": "switch-option_switch__cjbxY",
  "switch_switch__": "switch_switch__WU3hj",
  "switch_horizontal__": "switch_horizontal__nbKv1",
  "switch_fillWidth__": "switch_fillWidth__wZLxC",
  "switch_switchItem__": "switch_switchItem__30646",
  "switch_background__": "switch_background__d3zm7",
  "switch_show__": "switch_show___XksV",
  "switch_hide__": "switch_hide__RKrS9",
  "switch_label__": "switch_label__L_w0a",
  "body-text_bodyText__": "body-text_bodyText__VaEM9",
  "shared_white70Variant__": "shared_white70Variant__zsrzB",
  "shared_regularWeight__": "shared_regularWeight__09pb6",
};

let scope = null; // settings root used for class lookups
const cache = new Map();

/** Hashed class for a prefix, resolved inside the settings page (other pages reuse prefixes). */
const cls = (prefix) => {
  if (cache.has(prefix)) return cache.get(prefix);
  const exact = (el) => el && Array.from(el.classList).find((c) => c.startsWith(prefix));
  const el = scope && scope.querySelector(`[class*="${prefix}"]:not([data-gg] *):not([data-gg])`);
  const found = exact(el);
  if (found) cache.set(prefix, found);
  return found || FALLBACKS[prefix] || prefix;
};
const c = (...prefixes) => prefixes.map(cls).join(" ");

/* ---------- icons (white, like GeoGuessr's) ---------- */

const svg = (body) =>
  `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${body}</svg>`)}`;
const ICONS = {
  ghost: svg('<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3.5" fill="#fff"/>'),
  color: svg('<circle cx="12" cy="12" r="9"/><path d="M12 3v18M3 12h18" opacity=".5"/>'),
  size: svg('<circle cx="12" cy="12" r="4"/><circle cx="12" cy="12" r="9" opacity=".5"/>'),
  eye: svg('<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>'),
  score: svg('<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>'),
  line: svg('<path d="M5 19 19 5"/><circle cx="5" cy="19" r="2"/><circle cx="19" cy="5" r="2"/>'),
  key: svg('<rect x="3" y="6" width="18" height="12" rx="2"/><path d="M7 10h.01M11 10h.01M15 10h.01M8 14h8"/>'),
  timer: svg('<circle cx="12" cy="13" r="8"/><path d="M12 9v4l2 2M9 2h6"/>'),
  gift: svg('<rect x="3" y="8" width="18" height="13" rx="1"/><path d="M12 8v13M3 12h18M12 8S10 3 7.5 4 9 8 12 8Zm0 0s2-5 4.5-4S15 8 12 8Z"/>'),
  shield: svg('<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z"/>'),
};

const icon = (src, wrapperPrefix) =>
  h("div", { class: cls(wrapperPrefix) }, h("img", { alt: "", width: 24, height: 24, src, style: { color: "transparent" } }));

/* ---------- components (same markup as the page) ---------- */

const card = (title, children) =>
  h(
    "div",
    { class: cls("settings_card__"), "data-gg": "" },
    h(
      "h3",
      {
        class: c("headline_heading__", "shared_brand30Variant__", "shared_boldWeight__", "headline_italic__"),
        style: { "--fs": "var(--font-size-20)", "--lh": "var(--line-height-20)" },
      },
      title,
    ),
    h("div", { class: cls("settings_cardDivider__") }),
    h("div", { class: `${cls("flex_flex__")} gg-main-stack` }, children),
  );

const toggleOption = (key, label, iconSrc = ICONS.ghost) => {
  const input = h("input", { class: cls("toggle_toggle__"), type: "checkbox", "aria-label": label });
  input.checked = !!settings[key];
  input.addEventListener("change", () => set(key, input.checked));
  return h(
    "label",
    { class: c("toggle-option_wrapper__", "toggle-option_clickable__") },
    icon(iconSrc, "toggle-option_icon__"),
    h("div", { class: cls("toggle-option_label__") }, label),
    input,
  );
};

/** toggle-option layout with a custom control on the right. */
const controlOption = (label, control, iconSrc) =>
  h(
    "div",
    { class: `${cls("toggle-option_wrapper__")} gg-main-control` },
    icon(iconSrc, "toggle-option_icon__"),
    h("div", { class: cls("toggle-option_label__") }, label),
    control,
  );

const sliderOption = (key, label, { min, max, step = 1, unit = "", percent = false, iconSrc = ICONS.size }) => {
  const scale = percent ? 100 : 1;
  const format = (v) => (percent ? `${Math.round(v * 100)}%` : `${Number.isInteger(step) ? Math.round(v) : v.toFixed(1)}${unit}`);
  const valueLabel = h("div", { class: cls("slider-option_valueLabel__") });
  const input = h("input", {
    class: cls("range-slider_rangeSlider__"),
    type: "range",
    min: min * scale,
    max: max * scale,
    step: step * scale,
    "aria-label": label,
  });
  const paint = (v) => {
    valueLabel.textContent = format(v);
    input.style.setProperty("--range-progress", `${((v - min) / (max - min || 1)) * 100}%`);
  };
  input.value = String(Number(settings[key]) * scale);
  paint(Number(settings[key]));
  input.addEventListener("input", () => {
    const v = Number(input.value) / scale;
    paint(v);
    set(key, v);
  });
  return h(
    "div",
    { class: cls("slider-option_wrapper__") },
    icon(iconSrc, "slider-option_icon__"),
    h("div", { class: cls("slider-option_label__") }, label),
    h("form", { class: cls("slider-option_value__"), onSubmit: (e) => e.preventDefault() }, valueLabel),
    h(
      "div",
      { class: cls("slider-option_sliderRow__") },
      h("div", { class: cls("slider-option_slider__") }, h("div", { class: cls("range-slider_field__") }, input)),
    ),
  );
};

const switchOption = (key, label, choices) =>
  h(
    "div",
    { class: cls("switch-option_wrapper__") },
    h("div", { class: cls("switch-option_label__") }, label),
    h(
      "div",
      { class: cls("switch-option_switch__") },
      h(
        "div",
        { class: c("switch_switch__", "switch_horizontal__", "switch_fillWidth__"), role: "group", "aria-label": label },
        choices.map((choice) => {
          const selected = settings[key] === choice.value;
          return h(
            "div",
            {
              class: c("switch_switchItem__", "switch_fillWidth__"),
              onClick: () => set(key, choice.value),
            },
            h("div", { class: `${cls("switch_background__")} ${selected ? cls("switch_show__") : cls("switch_hide__")}` }),
            h("label", { class: cls("switch_label__"), "aria-selected": String(selected) }, choice.label),
          );
        }),
      ),
    ),
  );

const colorOption = (key, label) => {
  const input = h("input", { type: "color", class: "gg-color", "aria-label": label });
  input.value = /^#[0-9a-f]{6}$/i.test(settings[key]) ? settings[key].toLowerCase() : "#000000";
  const hex = h("span", { class: "gg-main-hex" }, String(settings[key]).toUpperCase());
  input.addEventListener("input", () => {
    hex.textContent = input.value.toUpperCase();
    set(key, input.value.toUpperCase());
  });
  return controlOption(label, h("div", { class: "gg-main-color" }, hex, input), ICONS.color);
};

const keyLabel = (v) => (v === "SPACE" ? "Space" : String(v));

const hotkeyOption = (key, label, forbidden) => {
  const button = h("button", { type: "button", class: "gg-main-key", "aria-label": `${label}: change key` }, keyLabel(settings[key]));
  let recording = false;
  const stop = () => {
    recording = false;
    setRecording(false);
    window.removeEventListener("keydown", onKey, true);
    button.textContent = keyLabel(settings[key]);
    button.removeAttribute("data-gg-recording");
  };
  const onKey = (event) => {
    event.preventDefault();
    event.stopPropagation();
    if (event.key === "Escape") return stop();
    const name = keyName(event);
    const valid = /^[A-Z0-9]$/.test(name) || name === "SPACE" || /^F([1-9]|1[0-2])$/.test(name);
    if (!valid || [].concat(forbidden).some((k) => String(settings[k]).toUpperCase() === name)) return;
    stop();
    set(key, name);
    button.textContent = keyLabel(name);
  };
  button.addEventListener("click", (event) => {
    event.preventDefault();
    if (recording) return stop();
    recording = true;
    setRecording(true);
    button.textContent = "…";
    button.setAttribute("data-gg-recording", "");
    window.addEventListener("keydown", onKey, true);
  });
  button.addEventListener("blur", () => recording && stop());
  return controlOption(label, button, ICONS.key);
};

const actionOption = (label, buttonLabel, onClick, iconSrc) =>
  controlOption(label, h("button", { type: "button", class: "gg-main-key", onClick }, buttonLabel), iconSrc);

/* ---------- content (rendered from the settings schema) ---------- */

const help = (text, flush = false) => text && h("div", { class: `gg-main-help${flush ? " gg-main-help--flush" : ""}` }, text);

/** Schema item -> component of this page. */
const renderItem = (it) => {
  const iconSrc = (it.icon && ICONS[it.icon]) || undefined;
  const label = value(it.label);
  switch (it.type) {
    case "toggle":
      return [toggleOption(it.key, label, iconSrc), help(value(it.note))];
    case "choice":
      return [switchOption(it.key, label, it.choices), help(value(it.note), true)];
    case "slider":
      return sliderOption(it.key, label, { ...it, iconSrc: iconSrc || ICONS.size });
    case "color":
      return colorOption(it.key, label);
    case "hotkey":
      return hotkeyOption(it.key, label, it.forbidden);
    case "button":
      return [actionOption(label, value(it.buttonLabel), it.onClick, iconSrc || ICONS.ghost), help(value(it.note))];
    case "note": {
      const link = it.link ? value(it.link) : null;
      return h(
        "div",
        { class: it.when ? "gg-main-note" : "gg-main-version" },
        value(it.text),
        link && " ",
        link && h("a", { href: link.url, target: "_blank", rel: "noopener" }, link.label),
      );
    }
    default:
      return null;
  }
};

const buildCards = () => {
  const cards = visibleItems(SETTINGS_SCHEMA).map((sec) =>
    card(sec.title, visibleItems(sec.items).flatMap((it) => [].concat(renderItem(it))).filter(Boolean)),
  );
  return [h("div", { class: cls("settings_gameSettingsGrid__") }, cards)];
};

const render = (content) => {
  const scroll = content.scrollTop;
  content.replaceChildren(...buildCards());
  content.scrollTop = scroll;
};

/* ---------- nav integration ---------- */

const pages = new WeakMap(); // container -> { activeButton } while our page is shown

const parts = (container) => ({
  list: container.querySelector('[class*="settings_navList__"]'),
  content: container.querySelector('[class*="settings_content__"]'),
});

const nativeButtons = (container) =>
  Array.from(container.querySelectorAll('[class*="settings_navButton__"]')).filter((b) => b.id !== NAV_ID);

const activate = (container) => {
  const { content } = parts(container);
  const ours = container.querySelector(`#${CONTENT_ID}`);
  const nav = container.querySelector(`#${NAV_ID}`);
  if (!content || !ours || !nav) return;
  const activeClass = cls("settings_navButtonActive__");
  if (!pages.has(container)) {
    const active = nativeButtons(container).find((b) => b.classList.contains(activeClass) || b.getAttribute("aria-current") === "page");
    pages.set(container, { active });
    if (active) {
      active.classList.remove(activeClass);
      active.removeAttribute("aria-current");
    }
  }
  for (const child of content.children) if (child !== ours) child.setAttribute(HIDDEN_ATTR, "");
  nav.classList.add(activeClass);
  nav.setAttribute("aria-current", "page");
  render(ours);
  ours.hidden = false;
  refit(ours);
};

/** Our page sizes itself to the window (the Steam layout doesn't scroll). */
const refit = (ours) => requestAnimationFrame(() => ours.__ggScrollable && ours.__ggScrollable.refit());

const deactivate = (container) => {
  const saved = pages.get(container);
  if (!saved) return;
  pages.delete(container);
  const activeClass = cls("settings_navButtonActive__");
  if (saved.active && saved.active.isConnected) {
    saved.active.classList.add(activeClass);
    saved.active.setAttribute("aria-current", "page");
  }
  const { content } = parts(container);
  if (content) for (const child of content.querySelectorAll(`[${HIDDEN_ATTR}]`)) child.removeAttribute(HIDDEN_ATTR);
  const nav = container.querySelector(`#${NAV_ID}`);
  if (nav) {
    nav.classList.remove(activeClass);
    nav.removeAttribute("aria-current");
  }
  const ours = container.querySelector(`#${CONTENT_ID}`);
  if (ours) ours.hidden = true;
};

const findContainers = () =>
  Array.from(document.querySelectorAll('[class*="settings_root__"] [class*="settings_container__"]')).filter(
    (el) => isVisible(el) && el.querySelector('[class*="settings_navList__"]') && el.querySelector('[class*="settings_content__"]'),
  );

export const ensureMainSettings = () => {
  for (const container of findContainers()) {
    const { list, content } = parts(container);
    if (list.querySelector(`#${NAV_ID}`)) {
      // React re-rendered the content area: keep our page on top while active.
      let ours = content.querySelector(`#${CONTENT_ID}`);
      if (!ours) {
        ours = createContent();
        content.appendChild(ours);
        if (pages.has(container)) {
          render(ours);
          ours.hidden = false;
          refit(ours);
        }
      }
      if (pages.has(container)) {
        for (const child of content.children) if (child.id !== CONTENT_ID && !child.hasAttribute(HIDDEN_ATTR)) child.setAttribute(HIDDEN_ATTR, "");
      }
      continue;
    }
    if (scope !== container) {
      scope = container.closest('[class*="settings_root__"]') || container;
      cache.clear();
    }

    const sampleItem = list.querySelector('[class*="settings_navItem__"]');
    const nav = h(
      "button",
      { id: NAV_ID, type: "button", class: cls("settings_navButton__"), "data-gg": "" },
      "GhostGuessr",
    );
    const item = h("li", { class: sampleItem ? sampleItem.className : cls("settings_navItem__"), "data-gg": "" }, nav);
    item.style.animationDelay = `${list.children.length * 70}ms`;
    nav.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      activate(container);
    });
    // Native entries take control back (capture: before React handles the click).
    list.addEventListener(
      "click",
      (event) => {
        const target = event.target.closest('[class*="settings_navButton__"]');
        if (target && target.id !== NAV_ID) deactivate(container);
      },
      true,
    );
    list.appendChild(item);
    content.appendChild(createContent());
    log.info("GhostGuessr entry added to the settings page");
  }
};

const createContent = () => {
  const ours = h("div", { id: CONTENT_ID, class: `${cls("settings_contentInner__")} gg-main-content`, hidden: true, "data-gg": "" });
  ours.addEventListener("keydown", (event) => event.stopPropagation());
  makeScrollable(ours, { fitWindow: true, margin: 24 });
  return ours;
};

export const rerenderMainSettings = () => {
  const ours = document.getElementById(CONTENT_ID);
  if (ours && !ours.hidden) render(ours);
};
