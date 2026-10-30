import { h, fromHTML, onDomChange, getClassByPrefix } from "../core/dom.js";
import { settings, watch } from "../core/settings.js";
import { toggleMarker } from "../features/ghost-marker.js";
import * as icons from "./icons.js";

/**
 * Round ghost-marker toggle in the in-game HUD.
 *
 * Built exactly like GeoGuessr's round settings button (see
 * new-style-website.txt) and placed right above it in the first HUD column:
 *   div.styles_control__[data-game-hud] > span.tooltip_reference__ > button.styles_hudButton__.styles_sizeSmall__.styles_roundBoth__
 */

const BUTTON_ID = "gg-hud-toggle";
const FALLBACK = {
  control: "styles_control__Pa4Ta",
  reference: "tooltip_reference___tWvM",
  button: "styles_hudButton__kzfFK styles_sizeSmall__O7Bw_ styles_roundBoth__hcuEN",
  round: "styles_roundBoth__hcuEN",
  tooltip: "tooltip_root__4_lo5",
  tooltipArrow: "tooltip_arrow__gG9fc",
  tooltipContent: "tooltip_content__VKFBN",
};

const classOf = (prefix, fallback) =>
  getClassByPrefix(document.querySelector(`[class*="${prefix}"]:not([data-gg] *)`), prefix) || fallback;

/** Classes of the round settings button, forcing the fully round variant. */
const roundButtonClass = (sample) => {
  if (!sample) return FALLBACK.button;
  const round = getClassByPrefix(sample, "styles_roundBoth__") || classOf("styles_roundBoth__", FALLBACK.round);
  const base = Array.from(sample.classList).filter((c) => !/^styles_(round|active|disabled)/.test(c));
  return [...base, round].join(" ");
};

const paint = (button) => {
  const label = `${settings.enabled ? "Hide" : "Show"} ghost marker (${settings.hotkey === "SPACE" ? "Space" : settings.hotkey})`;
  button.dataset.on = String(!!settings.enabled);
  button.setAttribute("aria-label", label);
  button.setAttribute("aria-pressed", String(!!settings.enabled));
  const content = button.parentElement && button.parentElement.querySelector(".gg-hud-tooltip-text");
  if (content) content.textContent = label;
};

const ensureButton = () => {
  if (document.getElementById(BUTTON_ID)) return;
  const settingsButton = document.querySelector('[data-qa="in-game-settings-button"]');
  const anchor = settingsButton && settingsButton.closest('[class*="styles_control__"]');
  const column = (anchor && anchor.parentElement) || document.querySelector('[class*="styles_columnOne__"]');
  if (!column) return;

  const sampleRef = settingsButton && settingsButton.closest('[class*="tooltip_reference_"]');
  const button = h("button", {
    id: BUTTON_ID,
    type: "button",
    class: `${roundButtonClass(settingsButton)} gg-hud-btn`,
    "data-qa": "ghostguessr-toggle",
    onClick: (event) => {
      event.stopPropagation();
      toggleMarker();
    },
  });
  button.appendChild(fromHTML(icons.hudMarker));

  const tooltip = h(
    "div",
    {
      role: "tooltip",
      class: `${classOf("tooltip_root__", FALLBACK.tooltip)} gg-hud-tooltip`,
      "data-variant": "white",
      "data-placement": "right",
    },
    h("span", { "aria-hidden": "true", class: classOf("tooltip_arrow__", FALLBACK.tooltipArrow) }),
    h("div", { class: `${classOf("tooltip_content__", FALLBACK.tooltipContent)} gg-hud-tooltip-text` }),
  );
  const reference = h(
    "span",
    { class: `${sampleRef ? sampleRef.className : FALLBACK.reference} gg-hud-reference` },
    button,
    tooltip,
  );
  const control = h(
    "div",
    { class: anchor ? anchor.className : FALLBACK.control, "data-game-hud": "true", "data-gg": "" },
    reference,
  );

  if (anchor) column.insertBefore(control, anchor);
  else column.appendChild(control);
  paint(button);
};

export const initHudButton = () => {
  onDomChange(ensureButton);
  watch(["enabled", "hotkey"], () => {
    const button = document.getElementById(BUTTON_ID);
    if (button) paint(button);
  });
};
