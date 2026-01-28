
import { getClassByPrefix } from './utils.js';
import { createSvg } from './components.js';

const GG = window.GhostGuessr;

export const createToggleButton = () => {
    if (document.querySelector('[data-qa="ghostguessr-toggle"]')) {
      GG.toggleButton = document.querySelector(
        '[data-qa="ghostguessr-toggle"]',
      );
      GG.buttonCreated = true;
      GG.updateButtonState();
      return;
    }

    let buttonContainer =
      document.querySelector('[class*="styles_columnTwo__"]') ||
      document.querySelector(".ghostguessr-columnTwo");
    let createdColumnTwo = false;
    if (!buttonContainer) {
      const controlsRoot =
        document.querySelector('[class*="styles_root__"]') ||
        document.querySelector('[class*="game_controls__"]');
      const columnOne = document.querySelector('[class*="styles_columnOne__"]');
      if (controlsRoot && columnOne && columnOne.parentNode === controlsRoot) {
        const columnTwoClass = getClassByPrefix(
          controlsRoot,
          "styles_columnTwo__",
        );
        buttonContainer = document.createElement("div");
        buttonContainer.className = columnTwoClass || "ghostguessr-columnTwo";
        if (!columnTwoClass) {
          buttonContainer.style.cssText =
            "display: flex; flex-direction: column; gap: 8px; justify-content: center; align-items: center; margin-left: 8px;";
        }
        controlsRoot.insertBefore(buttonContainer, columnOne.nextSibling);
        createdColumnTwo = true;
      }
    }
    if (!buttonContainer) return;

    const sampleButtonInContainer = Array.from(
      buttonContainer.querySelectorAll("button"),
    ).find((button) => !button.disabled);
    const sampleButton =
      sampleButtonInContainer ||
      document.querySelector('[data-qa="in-game-settings-button"]') ||
      document.querySelector('[data-qa="pano-zoom-in"]') ||
      document.querySelector('[data-qa="pano-zoom-out"]');
    const sampleControl =
      (sampleButton && sampleButton.closest('[class*="styles_control__"]')) ||
      document.querySelector('[class*="styles_control__"]');
    const sampleTooltipRef =
      buttonContainer.querySelector('[class*="tooltip_reference__"]') ||
      (sampleButton &&
        sampleButton.closest('[class*="tooltip_reference__"]')) ||
      document.querySelector('[class*="tooltip_reference__"]');
    const sampleTooltip =
      (sampleTooltipRef &&
        sampleTooltipRef.querySelector('[class*="tooltip_tooltip__"]')) ||
      buttonContainer.querySelector('[class*="tooltip_tooltip__"]');
    const sampleTooltipArrow =
      sampleTooltip &&
      sampleTooltip.querySelector('[class*="tooltip_arrow__"]');
    const tooltipFromContainer =
      sampleTooltip && buttonContainer.contains(sampleTooltip);

    if (!GG.toggleActiveClass) {
      GG.toggleActiveClass = getClassByPrefix(sampleButton, "styles_active__");
    }

    let controlDiv = document.createElement("div");
    controlDiv.className = sampleControl
      ? sampleControl.className
      : "styles_control__Pa4Ta";

    let tooltipRef = document.createElement("span");
    tooltipRef.className = sampleTooltipRef
      ? sampleTooltipRef.className
      : "tooltip_reference__CwDbn";

    GG.toggleButton = document.createElement("button");
    GG.toggleButton.className = sampleButton
      ? sampleButton.className
      : "styles_hudButton__kzfFK styles_sizeSmall__O7Bw_ styles_roundBoth__hcuEN";
    GG.toggleButton.setAttribute("data-qa", "ghostguessr-toggle");

    let svgContainer = document.createElement("div");
    svgContainer.style.cssText = "transform: none;";
    svgContainer.innerHTML = createSvg(
      GG.settings.enabled ? "#00FF00" : "#FF0000",
    );
    GG.toggleButton.appendChild(svgContainer);

    let tooltip = document.createElement("div");
    tooltip.className =
      sampleTooltip && !createdColumnTwo && tooltipFromContainer
        ? sampleTooltip.className
        : "tooltip_tooltip__3D6bz tooltip_right__wLi_G tooltip_roundnessXS__BGhWu tooltip_variantDefault__7WTJ0 tooltip_hideOnXs__S3erz";
    tooltip.style.cssText =
      "top: 50%; transform: translateY(-50%) scale(0); opacity: 0; visibility: hidden; --tooltip-width: none;";

    let tooltipText = document.createElement("div");
    tooltipText.textContent = GG.settings.enabled
      ? `Hide ghost marker (${GG.settings.hotkey})`
      : `Show ghost marker (${GG.settings.hotkey})`;

    let tooltipArrow = document.createElement("div");
    tooltipArrow.className = sampleTooltipArrow
      ? sampleTooltipArrow.className
      : "tooltip_arrow__LJ1of";

    tooltip.appendChild(tooltipText);
    tooltip.appendChild(tooltipArrow);

    tooltipRef.appendChild(GG.toggleButton);
    tooltipRef.appendChild(tooltip);
    controlDiv.appendChild(tooltipRef);
    buttonContainer.appendChild(controlDiv);

    GG.buttonCreated = true;

    GG.toggleButton.addEventListener("click", function (e) {
      e.stopPropagation();
      GG.toggleMarker();
      GG.updateButtonState();
    });

    GG.toggleButton.addEventListener("mouseenter", function () {
      tooltip.style.transform = "translateY(-50%) scale(1)";
      tooltip.style.opacity = "1";
      tooltip.style.visibility = "visible";
    });

    GG.toggleButton.addEventListener("mouseleave", function () {
      tooltip.style.transform = "translateY(-50%) scale(0)";
      tooltip.style.opacity = "0";
      tooltip.style.visibility = "hidden";
    });

    GG.updateButtonState();
};

export const updateButtonState = () => {
    if (!GG.toggleButton) return;

    let svgContainer = GG.toggleButton.querySelector("div");
    if (!svgContainer) return;

    svgContainer.innerHTML = createSvg(
      GG.settings.enabled ? "#00FF00" : "#FF0000",
    );

    if (GG.settings.enabled) {
      if (
        GG.toggleActiveClass &&
        !GG.toggleButton.classList.contains(GG.toggleActiveClass)
      ) {
        GG.toggleButton.classList.add(GG.toggleActiveClass);
      }
      GG.toggleButton.style.opacity = "1";
      GG.toggleButton.removeAttribute("title");

      let tooltipDiv = GG.toggleButton
        .closest('[class*="tooltip_reference__"]')
        .querySelector('[class*="tooltip_tooltip__"] div');
      if (tooltipDiv) {
        tooltipDiv.textContent = `Hide ghost marker (${GG.settings.hotkey})`;
      }
    } else {
      if (GG.toggleActiveClass) {
        GG.toggleButton.classList.remove(GG.toggleActiveClass);
      }
      GG.toggleButton.style.opacity = "0.8";
      GG.toggleButton.removeAttribute("title");

      let tooltipDiv = GG.toggleButton
        .closest('[class*="tooltip_reference__"]')
        .querySelector('[class*="tooltip_tooltip__"] div');
      if (tooltipDiv) {
        tooltipDiv.textContent = `Show ghost marker (${GG.settings.hotkey})`;
      }
    }
};
