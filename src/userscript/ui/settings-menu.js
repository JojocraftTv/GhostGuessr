import { h, onDomChange, isVisible } from "../core/dom.js";
import { watch } from "../core/settings.js";
import { on } from "../core/events.js";
import { pageWindow } from "../core/env.js";
import { createLogger } from "../core/logger.js";
import { makeScrollable } from "./scroll.js";
import { SETTINGS_SCHEMA } from "./settings-schema.js";
import { value, visibleItems, collect, liveKeys } from "./schema.js";
import { ensureMainSettings, rerenderMainSettings } from "./main-settings.js";
import {
  cls,
  resetClassCache,
  divider,
  heading,
  note,
  toggle,
  choice,
  slider,
  color,
  button,
  keyBinding,
  keyBindingGroup,
} from "./native.js";

/**
 * Integrates GhostGuessr into GeoGuessr's settings dialog:
 *   - a "GhostGuessr" tab next to "General" / "Keybindings"
 *   - a "GhostGuessr" group inside the "Keybindings" tab
 * Markup reference: new-style-website.txt.
 */

const log = createLogger("Settings");

const PANEL_SELECTORS = ['[data-settings-panel]', '[class*="game-menu_panel__"]'];
const TAB_ID = "gg-settings-tab";
const PANEL_ID = "gg-settings-panel";

/* ---------- content (rendered from the settings schema) ---------- */

const LIVE_KEYS = liveKeys(SETTINGS_SCHEMA);

/** Schema item -> native in-game dialog component. */
const renderItem = (it) => {
  const n = value(it.note) || null;
  switch (it.type) {
    case "toggle":
      return toggle(it.key, value(it.label), { note: n });
    case "choice":
      return choice(it.key, value(it.label), it.choices, { note: n });
    case "slider":
      return slider(it.key, value(it.label), it);
    case "color":
      return color(it.key, value(it.label));
    case "hotkey":
      return keyBinding(it.key, value(it.label), value(it.description), { forbidden: it.forbidden });
    case "button":
      return button(value(it.label), value(it.buttonLabel), it.onClick, n);
    case "note":
      return note(value(it.text), it.link ? value(it.link) : null);
    default:
      return null;
  }
};

const buildContent = () => {
  const rows = [];
  visibleItems(SETTINGS_SCHEMA).forEach((sec, index) => {
    if (index > 0) rows.push(divider());
    rows.push(heading(sec.title));
    const items = visibleItems(sec.items);
    const hotkeys = items.filter((it) => it.type === "hotkey").map(renderItem);
    if (hotkeys.length) rows.push(h("div", { class: "gg-keys" }, hotkeys));
    rows.push(...items.filter((it) => it.type !== "hotkey").map(renderItem).filter(Boolean));
  });
  return rows;
};

const hotkeyRows = () => collect(SETTINGS_SCHEMA, "hotkey").map(renderItem);

const renderPanel = (panel) => {
  panel.replaceChildren(...buildContent());
};

/* ---------- tab integration ---------- */

const states = new WeakMap(); // settings dialog -> saved native tab state while our tab is active

const nativeTabs = (dialog) => Array.from(dialog.querySelectorAll('[role="tab"]')).filter((t) => t.id !== TAB_ID);
const nativePanels = (dialog) => Array.from(dialog.querySelectorAll('[role="tabpanel"]')).filter((p) => p.id !== PANEL_ID);

const activate = (dialog) => {
  const tab = dialog.querySelector(`#${TAB_ID}`);
  const panel = dialog.querySelector(`#${PANEL_ID}`);
  if (!tab || !panel || states.has(dialog)) return;
  states.set(dialog, {
    tabs: nativeTabs(dialog).map((t) => [t, t.getAttribute("aria-selected"), t.getAttribute("data-state"), t.tabIndex]),
    panels: nativePanels(dialog).map((p) => [p, p.hidden]),
  });
  for (const t of nativeTabs(dialog)) {
    t.setAttribute("aria-selected", "false");
    t.setAttribute("data-state", "inactive");
    t.tabIndex = -1;
  }
  for (const p of nativePanels(dialog)) p.hidden = true;
  tab.setAttribute("aria-selected", "true");
  tab.setAttribute("data-state", "active");
  tab.tabIndex = 0;
  renderPanel(panel);
  panel.hidden = false;
  requestAnimationFrame(() => panel.__ggScrollable && panel.__ggScrollable.refit());
};

const deactivate = (dialog) => {
  const saved = states.get(dialog);
  if (!saved) return;
  states.delete(dialog);
  for (const [t, selected, state, tabIndex] of saved.tabs) {
    if (selected !== null) t.setAttribute("aria-selected", selected);
    if (state !== null) t.setAttribute("data-state", state);
    t.tabIndex = tabIndex;
  }
  for (const [p, hidden] of saved.panels) p.hidden = hidden;
  const tab = dialog.querySelector(`#${TAB_ID}`);
  const panel = dialog.querySelector(`#${PANEL_ID}`);
  if (tab) {
    tab.setAttribute("aria-selected", "false");
    tab.setAttribute("data-state", "inactive");
    tab.tabIndex = -1;
  }
  if (panel) panel.hidden = true;
};

const ensureTab = (dialog) => {
  const tablist = dialog.querySelector('[role="tablist"]');
  const body = dialog.querySelector('[class*="game-menu_panelBody__"]');
  if (!tablist || !body || tablist.querySelector(`#${TAB_ID}`)) return false;

  const sampleTab = nativeTabs(dialog)[0];
  const samplePanel = nativePanels(dialog)[0];
  const tab = h(
    "button",
    {
      id: TAB_ID,
      role: "tab",
      type: "button",
      class: sampleTab ? sampleTab.className : cls("tabs_trigger__"),
      "aria-selected": "false",
      "data-state": "inactive",
      "aria-controls": PANEL_ID,
      tabIndex: -1,
      "data-gg": "",
    },
    h("span", {}, "GhostGuessr"),
  );
  const panel = h("div", {
    id: PANEL_ID,
    role: "tabpanel",
    tabIndex: 0,
    hidden: true,
    "aria-labelledby": TAB_ID,
    class: `${samplePanel ? samplePanel.className : `${cls("tabs_panel__")} ${cls("game-menu_tabPanel__")}`} gg-settings-panel`,
    "data-gg": "",
  });
  // Keep typing in our controls away from GeoGuessr's shortcuts.
  panel.addEventListener("keydown", (event) => event.stopPropagation());
  // Leave room for the dialog footer ("Resume game" / "Close").
  makeScrollable(panel, { fitWindow: true, margin: 110 });

  tab.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    activate(dialog);
  });
  // Any native tab click hands control back to GeoGuessr.
  tablist.addEventListener(
    "click",
    (event) => {
      const target = event.target.closest('[role="tab"]');
      if (target && target.id !== TAB_ID) deactivate(dialog);
    },
    true,
  );

  tablist.appendChild(tab);
  body.appendChild(panel);
  log.info("GhostGuessr tab added to the settings dialog");
  return true;
};

/** Adds our hotkeys as a group to the native Keybindings tab when it is open. */
const ensureKeybindingGroup = (dialog) => {
  const groups = dialog.querySelector('[data-qa="key-bindings"] [class*="key-bindings-settings_groups__"]');
  if (!groups || groups.querySelector(".gg-keybinding-group")) return;
  groups.appendChild(keyBindingGroup("GhostGuessr", hotkeyRows()));
};

/** Older settings layouts without tabs: append the rows at the end. */
const LEGACY_CONTAINERS = [
  '[class*="game-menu_settingsContainer__"]',
  '[class*="settings_sectionContainer__"]',
];

const ensureLegacySection = () => {
  for (const selector of LEGACY_CONTAINERS) {
    for (const container of document.querySelectorAll(selector)) {
      if (!isVisible(container) || container.querySelector(".gg-legacy-section")) continue;
      // The account / main-menu settings page has its own integration (main-settings.js).
      if (container.closest('[class*="settings_root__"]')) continue;
      const section = h("div", { class: "gg-legacy-section", "data-gg": "" }, divider());
      const content = h("div", { class: "gg-legacy-content" });
      section.appendChild(content);
      content.replaceChildren(...buildContent());
      container.appendChild(section);
    }
  }
};

const findDialogs = () => {
  const found = new Set();
  for (const selector of PANEL_SELECTORS) {
    for (const el of document.querySelectorAll(selector)) if (isVisible(el)) found.add(el);
  }
  return Array.from(found);
};

let lastDialog = null;

const ensureAll = () => {
  for (const dialog of findDialogs()) {
    if (dialog !== lastDialog) {
      resetClassCache();
      lastDialog = dialog;
    }
    ensureTab(dialog);
    ensureKeybindingGroup(dialog);
  }
  ensureLegacySection();
  ensureMainSettings();
};

const rerender = () => {
  const panel = document.getElementById(PANEL_ID);
  if (panel && !panel.hidden) renderPanel(panel);
  document.querySelectorAll(".gg-legacy-content").forEach((content) => content.replaceChildren(...buildContent()));
  rerenderMainSettings();
};

/**
 * Debug helper (console): `copy(__ghostguessrApp.inspectSettings())` returns the
 * HTML of the open settings dialog and logs what GhostGuessr detected.
 */
export const inspectSettings = () => {
  const dialogs = findDialogs();
  console.log("[GhostGuessr] settings inspection", {
    dialogs: dialogs.length,
    tabAdded: !!document.getElementById(TAB_ID),
    tablist: dialogs.map((d) => !!d.querySelector('[role="tablist"]')),
    body: dialogs.map((d) => !!d.querySelector('[class*="game-menu_panelBody__"]')),
  });
  return dialogs.length ? dialogs.map((d) => d.outerHTML).join("\n\n") : "no settings dialog open";
};

export const initSettingsMenu = () => {
  pageWindow.__ghostguessrInspectSettings = inspectSettings;
  onDomChange(ensureAll);
  // Re-render on structural changes (toggles, choices, hotkeys); not while dragging sliders/colors.
  watch([], ({ key }) => !LIVE_KEYS.has(key) && rerender());
  on("update:notice", rerender);
};
