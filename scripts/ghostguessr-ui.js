(function () {
  "use strict";

  const GG = window.GhostGuessr;

  GG.createSvg = function (color) {
    return `
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style="color: transparent;">
                <circle cx="12" cy="12" r="8" fill="currentColor" stroke="white" stroke-width="2"/>
                <circle cx="12" cy="12" r="6" fill="${color}"/>
            </svg>
        `;
  };

  GG.createToggleButton = function () {
    if (document.querySelector('[data-qa="ghost-marker-toggle"]')) {
      GG.toggleButton = document.querySelector('[data-qa="ghost-marker-toggle"]');
      GG.buttonCreated = true;
      GG.updateButtonState();
      return;
    }

    let buttonContainer = document.querySelector(".styles_columnTwo__kyT60");
    if (!buttonContainer) return;

    let controlDiv = document.createElement("div");
    controlDiv.className = "styles_control__Pa4Ta";

    let tooltipRef = document.createElement("span");
    tooltipRef.className = "tooltip_reference__CwDbn";

    GG.toggleButton = document.createElement("button");
    GG.toggleButton.className =
      "styles_hudButton__kzfFK styles_sizeSmall__O7Bw_ styles_roundBoth__hcuEN";
    GG.toggleButton.setAttribute("data-qa", "ghost-marker-toggle");

    let svgContainer = document.createElement("div");
    svgContainer.style.cssText = "transform: none;";
    svgContainer.innerHTML = GG.createSvg(
      GG.settings.enabled ? "#00FF00" : "#FF0000",
    );
    GG.toggleButton.appendChild(svgContainer);

    let tooltip = document.createElement("div");
    tooltip.className =
      "tooltip_tooltip__3D6bz tooltip_right__wLi_G tooltip_roundnessXS__BGhWu tooltip_variantDefault__7WTJ0 tooltip_hideOnXs__S3erz";
    tooltip.style.cssText =
      "top: 50%; transform: translateY(-50%) scale(0); opacity: 0; visibility: hidden; --tooltip-width: none;";

    let tooltipText = document.createElement("div");
    tooltipText.textContent = GG.settings.enabled
      ? `Hide ghost marker (${GG.settings.hotkey})`
      : `Show ghost marker (${GG.settings.hotkey})`;

    let tooltipArrow = document.createElement("div");
    tooltipArrow.className = "tooltip_arrow__LJ1of";

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

  GG.updateButtonState = function () {
    if (!GG.toggleButton) return;

    let svgContainer = GG.toggleButton.querySelector("div");
    if (!svgContainer) return;

    svgContainer.innerHTML = GG.createSvg(
      GG.settings.enabled ? "#00FF00" : "#FF0000",
    );

    if (GG.settings.enabled) {
      if (!GG.toggleButton.classList.contains("styles_active__bPW2Y")) {
        GG.toggleButton.classList.add("styles_active__bPW2Y");
      }
      GG.toggleButton.style.opacity = "1";
      GG.toggleButton.removeAttribute("title");

      let tooltipDiv = GG.toggleButton
        .closest(".tooltip_reference__CwDbn")
        .querySelector(".tooltip_tooltip__3D6bz div");
      if (tooltipDiv) {
        tooltipDiv.textContent = `Hide ghost marker (${GG.settings.hotkey})`;
      }
    } else {
      GG.toggleButton.classList.remove("styles_active__bPW2Y");
      GG.toggleButton.style.opacity = "0.8";
      GG.toggleButton.removeAttribute("title");

      let tooltipDiv = GG.toggleButton
        .closest(".tooltip_reference__CwDbn")
        .querySelector(".tooltip_tooltip__3D6bz div");
      if (tooltipDiv) {
        tooltipDiv.textContent = `Show ghost marker (${GG.settings.hotkey})`;
      }
    }
  };

  GG.createGhostMarkerSettings = function () {
    const settingsContainer = document.querySelector(
      ".game-menu_settingsContainer__NeJu2",
    );
    if (!settingsContainer) return;
    if (settingsContainer.querySelector(".ghost-marker-settings-container")) {
      return;
    }

    document
      .querySelectorAll(".ghost-marker-setting")
      .forEach((el) => el.remove());
    const buttonsContainer = settingsContainer.querySelector(
      ".buttons_buttons__3yvvA",
    );
    const closeButton = settingsContainer.querySelector(
      'button[class*="button_button"]',
    );
    const dividers = settingsContainer.querySelectorAll(
      ".game-menu_divider__IhA4t",
    );
    const lastDivider = dividers[dividers.length - 1] || null;
    const useExistingDivider = Boolean(lastDivider);

    const ghostSettingsContainer = document.createElement("div");
    ghostSettingsContainer.className = "ghost-marker-settings-container";
    ghostSettingsContainer.style.cssText =
      "width: 100%; align-self: stretch; box-sizing: border-box; margin: 0; padding: 0;";

    if (!useExistingDivider) {
      const dividerTop = document.createElement("div");
      dividerTop.className = "game-menu_divider__IhA4t ghost-marker-setting";
      ghostSettingsContainer.appendChild(dividerTop);
    }

    const headerContainer = document.createElement("div");
    headerContainer.className =
      "game-menu_volumeContainer__aWb0Y ghost-marker-setting";

    const headerLabel = document.createElement("p");
    headerLabel.className = "game-menu_subHeader__Ul5Vl";
    headerLabel.textContent = "Ghost Marker";
    headerLabel.style.cssText = "font-size: 16px; color: #fff;";
    headerContainer.appendChild(headerLabel);

    ghostSettingsContainer.appendChild(headerContainer);

    const hotkeyContainer = document.createElement("div");
    hotkeyContainer.className =
      "game-menu_volumeContainer__aWb0Y ghost-marker-setting";

    const hotkeyLabel = document.createElement("p");
    hotkeyLabel.className = "game-menu_subHeader__Ul5Vl";
    hotkeyLabel.textContent = "Hotkey";
    hotkeyContainer.appendChild(hotkeyLabel);

    const hotkeyInputContainer = document.createElement("div");
    hotkeyInputContainer.className = "game-menu_sliderContainer__suHjk";
    hotkeyInputContainer.style.cssText =
      "display: flex; align-items: center; gap: 10px;";

    const hotkeyIcon = document.createElement("div");
    hotkeyIcon.className = "game-menu_icon__qC_vb";
    hotkeyIcon.innerHTML = `
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <rect x="4" y="6" width="16" height="12" rx="2" stroke="#8b5cf6" stroke-width="2" fill="none"/>
                <text x="12" y="15" text-anchor="middle" font-family="Arial" font-size="10" fill="#8b5cf6">${GG.settings.hotkey}</text>
            </svg>
        `;

    GG.hotkeyInput = document.createElement("input");
    GG.hotkeyInput.type = "text";
    GG.hotkeyInput.value = GG.settings.hotkey;
    GG.hotkeyInput.maxLength = 1;
    GG.hotkeyInput.style.cssText = `
            flex: 1;
            height: 36px;
            background: rgba(255, 255, 255, 0.1);
            border: 1px solid #8b5cf6;
            border-radius: 6px;
            color: #fff;
            padding: 0 10px;
            font-size: 16px;
            text-align: center;
            text-transform: uppercase;
            outline: none;
        `;

    GG.hotkeyInput.addEventListener("focus", function () {
      this.value = "";
    });

    GG.hotkeyInput.addEventListener("blur", function () {
      if (this.value === "") {
        this.value = GG.settings.hotkey;
      }
    });

    GG.hotkeyInput.addEventListener("input", function () {
      const key = this.value.toUpperCase();
      if (key.length > 0 && /^[A-Z0-9]$/.test(key)) {
        this.value = key;
        GG.settings.hotkey = key;
        GG.saveSettings();
        GG.setupHotkeyListener();
        GG.updateButtonState();

        hotkeyIcon.innerHTML = `
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <rect x="4" y="6" width="16" height="12" rx="2" stroke="#8b5cf6" stroke-width="2" fill="none"/>
                        <text x="12" y="15" text-anchor="middle" font-family="Arial" font-size="10" fill="#8b5cf6">${key}</text>
                    </svg>
                `;
      }
    });

    const hotkeyHelp = document.createElement("span");
    hotkeyHelp.textContent = "Press any key";
    hotkeyHelp.style.cssText =
      "font-size: 12px; color: #888; font-style: italic; min-width: 100px;";

    hotkeyInputContainer.appendChild(hotkeyIcon);
    hotkeyInputContainer.appendChild(GG.hotkeyInput);
    hotkeyInputContainer.appendChild(hotkeyHelp);
    hotkeyContainer.appendChild(hotkeyInputContainer);
    ghostSettingsContainer.appendChild(hotkeyContainer);

    const colorContainer = document.createElement("div");
    colorContainer.className =
      "game-menu_volumeContainer__aWb0Y ghost-marker-setting";

    const colorLabel = document.createElement("p");
    colorLabel.className = "game-menu_subHeader__Ul5Vl";
    colorLabel.textContent = "Marker Color";
    colorContainer.appendChild(colorLabel);

    const colorSliderContainer = document.createElement("div");
    colorSliderContainer.className = "game-menu_sliderContainer__suHjk";
    colorSliderContainer.style.cssText =
      "display: flex; align-items: center; gap: 10px;";

    const colorIcon = document.createElement("div");
    colorIcon.className = "game-menu_icon__qC_vb";
    colorIcon.innerHTML = `
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <circle cx="12" cy="12" r="10" fill="${GG.settings.markerColor}" stroke="#333" stroke-width="2"/>
            </svg>
        `;

    const colorInput = document.createElement("input");
    colorInput.type = "color";
    colorInput.value = GG.settings.markerColor;
    colorInput.style.cssText =
      "flex: 1; height: 36px; border: none; background: transparent; cursor: pointer;";

    const colorHex = document.createElement("span");
    colorHex.textContent = GG.settings.markerColor;
    colorHex.style.cssText =
      "font-family: monospace; font-size: 14px; color: #ccc; min-width: 60px;";

    colorInput.addEventListener("input", function () {
      GG.settings.markerColor = this.value;
      colorIcon.innerHTML = `
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <circle cx="12" cy="12" r="10" fill="${this.value}" stroke="#333" stroke-width="2"/>
                </svg>
            `;
      colorHex.textContent = this.value;
      GG.saveSettings();
    });

    colorSliderContainer.appendChild(colorIcon);
    colorSliderContainer.appendChild(colorInput);
    colorSliderContainer.appendChild(colorHex);
    colorContainer.appendChild(colorSliderContainer);
    ghostSettingsContainer.appendChild(colorContainer);

    const outlineContainer = document.createElement("div");
    outlineContainer.className =
      "game-menu_volumeContainer__aWb0Y ghost-marker-setting";

    const outlineLabel = document.createElement("p");
    outlineLabel.className = "game-menu_subHeader__Ul5Vl";
    outlineLabel.textContent = "Outline Color";
    outlineContainer.appendChild(outlineLabel);

    const outlineSliderContainer = document.createElement("div");
    outlineSliderContainer.className = "game-menu_sliderContainer__suHjk";
    outlineSliderContainer.style.cssText =
      "display: flex; align-items: center; gap: 10px;";

    const outlineIcon = document.createElement("div");
    outlineIcon.className = "game-menu_icon__qC_vb";
    outlineIcon.innerHTML = `
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <circle cx="12" cy="12" r="10" fill="none" stroke="${GG.settings.outlineColor}" stroke-width="4"/>
            </svg>
        `;

    const outlineInput = document.createElement("input");
    outlineInput.type = "color";
    outlineInput.value = GG.settings.outlineColor;
    outlineInput.style.cssText =
      "flex: 1; height: 36px; border: none; background: transparent; cursor: pointer;";

    const outlineHex = document.createElement("span");
    outlineHex.textContent = GG.settings.outlineColor;
    outlineHex.style.cssText =
      "font-family: monospace; font-size: 14px; color: #ccc; min-width: 60px;";

    outlineInput.addEventListener("input", function () {
      GG.settings.outlineColor = this.value;
      outlineIcon.innerHTML = `
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <circle cx="12" cy="12" r="10" fill="none" stroke="${this.value}" stroke-width="4"/>
                </svg>
            `;
      outlineHex.textContent = this.value;
      GG.saveSettings();
    });

    outlineSliderContainer.appendChild(outlineIcon);
    outlineSliderContainer.appendChild(outlineInput);
    outlineSliderContainer.appendChild(outlineHex);
    outlineContainer.appendChild(outlineSliderContainer);
    ghostSettingsContainer.appendChild(outlineContainer);

    const opacityContainer = document.createElement("div");
    opacityContainer.className =
      "game-menu_volumeContainer__aWb0Y ghost-marker-setting";

    const opacityLabel = document.createElement("p");
    opacityLabel.className = "game-menu_subHeader__Ul5Vl";
    opacityLabel.textContent = "Transparency";
    opacityContainer.appendChild(opacityLabel);

    const opacitySliderContainer = document.createElement("div");
    opacitySliderContainer.className = "game-menu_sliderContainer__suHjk";
    opacitySliderContainer.style.cssText =
      "display: flex; align-items: center; gap: 10px;";

    const opacityIcon = document.createElement("div");
    opacityIcon.className = "game-menu_icon__qC_vb";
    opacityIcon.innerHTML = `
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <circle cx="12" cy="12" r="10" fill="${GG.settings.markerColor}" fill-opacity="${GG.settings.opacity}" stroke="${GG.settings.outlineColor}" stroke-width="2"/>
            </svg>
        `;

    const opacitySlider = document.createElement("div");
    opacitySlider.className =
      "styles_rangeslider__8vVg3 styles_variantPurple__1s1cU";
    opacitySlider.style.cssText = "flex: 1;";

    const opacityFill = document.createElement("div");
    opacityFill.className = "styles_fill__9MeZ9";
    opacityFill.style.width = `${GG.settings.opacity * 100}%`;

    const opacityHandle = document.createElement("div");
    opacityHandle.className = "styles_handle__h9ytQ";
    opacityHandle.tabIndex = 0;
    opacityHandle.style.left = `${GG.settings.opacity * 100}%`;
    opacityHandle.innerHTML = "<div></div>";

    opacitySlider.appendChild(opacityFill);
    opacitySlider.appendChild(opacityHandle);

    const opacityValue = document.createElement("span");
    opacityValue.textContent = `${Math.round(GG.settings.opacity * 100)}%`;
    opacityValue.style.cssText =
      "font-size: 14px; color: #ccc; min-width: 40px;";

    const makeSliderDraggable = (
      slider,
      fill,
      handle,
      min,
      max,
      step,
      onChange,
    ) => {
      let isDragging = false;

      const updateFromEvent = (e) => {
        const rect = slider.getBoundingClientRect();
        let x = e.clientX - rect.left;
        x = Math.max(0, Math.min(x, rect.width));
        const percent = x / rect.width;
        const value = min + (max - min) * percent;
        const stepped = step ? Math.round(value / step) * step : value;
        const clamped = Math.max(min, Math.min(stepped, max));

        fill.style.width = `${(clamped / max) * 100}%`;
        handle.style.left = `${(clamped / max) * 100}%`;
        onChange(clamped);
      };

      handle.addEventListener("mousedown", (e) => {
        e.preventDefault();
        isDragging = true;
        document.addEventListener("mousemove", onMouseMove);
        document.addEventListener("mouseup", onMouseUp);
      });

      slider.addEventListener("click", (e) => {
        if (!isDragging) {
          updateFromEvent(e);
        }
      });

      const onMouseMove = (e) => {
        if (isDragging) {
          updateFromEvent(e);
        }
      };

      const onMouseUp = () => {
        isDragging = false;
        document.removeEventListener("mousemove", onMouseMove);
        document.removeEventListener("mouseup", onMouseUp);
      };
    };

    makeSliderDraggable(
      opacitySlider,
      opacityFill,
      opacityHandle,
      0,
      1,
      0.01,
      (value) => {
        GG.settings.opacity = value;
        opacityValue.textContent = `${Math.round(value * 100)}%`;
        opacityIcon.innerHTML = `
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <circle cx="12" cy="12" r="10" fill="${GG.settings.markerColor}" fill-opacity="${value}" stroke="${GG.settings.outlineColor}" stroke-width="2"/>
                </svg>
            `;
        GG.saveSettings();
      },
    );

    opacitySliderContainer.appendChild(opacityIcon);
    opacitySliderContainer.appendChild(opacitySlider);
    opacitySliderContainer.appendChild(opacityValue);
    opacityContainer.appendChild(opacitySliderContainer);
    ghostSettingsContainer.appendChild(opacityContainer);

    const widthContainer = document.createElement("div");
    widthContainer.className =
      "game-menu_volumeContainer__aWb0Y ghost-marker-setting";

    const widthLabel = document.createElement("p");
    widthLabel.className = "game-menu_subHeader__Ul5Vl";
    widthLabel.textContent = "Outline Width";
    widthContainer.appendChild(widthLabel);

    const widthSliderContainer = document.createElement("div");
    widthSliderContainer.className = "game-menu_sliderContainer__suHjk";
    widthSliderContainer.style.cssText =
      "display: flex; align-items: center; gap: 10px;";

    const widthIcon = document.createElement("div");
    widthIcon.className = "game-menu_icon__qC_vb";
    widthIcon.innerHTML = `
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <circle cx="12" cy="12" r="10" fill="none" stroke="${GG.settings.outlineColor}" stroke-width="${GG.settings.outlineWidth}"/>
            </svg>
        `;

    const widthSlider = document.createElement("div");
    widthSlider.className =
      "styles_rangeslider__8vVg3 styles_variantPurple__1s1cU";
    widthSlider.style.cssText = "flex: 1;";

    const widthFill = document.createElement("div");
    widthFill.className = "styles_fill__9MeZ9";
    widthFill.style.width = `${(GG.settings.outlineWidth / 5) * 100}%`;

    const widthHandle = document.createElement("div");
    widthHandle.className = "styles_handle__h9ytQ";
    widthHandle.tabIndex = 0;
    widthHandle.style.left = `${(GG.settings.outlineWidth / 5) * 100}%`;
    widthHandle.innerHTML = "<div></div>";

    widthSlider.appendChild(widthFill);
    widthSlider.appendChild(widthHandle);

    const widthValue = document.createElement("span");
    widthValue.textContent = `${GG.settings.outlineWidth}px`;
    widthValue.style.cssText = "font-size: 14px; color: #ccc; min-width: 40px;";

    makeSliderDraggable(
      widthSlider,
      widthFill,
      widthHandle,
      0,
      5,
      0.1,
      (value) => {
        const displayValue = Number.isInteger(value) ? value : value.toFixed(1);
        GG.settings.outlineWidth = value;
        widthValue.textContent = `${displayValue}px`;
        widthFill.style.width = `${(value / 5) * 100}%`;
        widthHandle.style.left = `${(value / 5) * 100}%`;
        widthIcon.innerHTML = `
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <circle cx="12" cy="12" r="10" fill="none" stroke="${GG.settings.outlineColor}" stroke-width="${value}"/>
                </svg>
            `;
        GG.saveSettings();
      },
    );

    widthSliderContainer.appendChild(widthIcon);
    widthSliderContainer.appendChild(widthSlider);
    widthSliderContainer.appendChild(widthValue);
    widthContainer.appendChild(widthSliderContainer);
    ghostSettingsContainer.appendChild(widthContainer);

    const sizeContainer = document.createElement("div");
    sizeContainer.className =
      "game-menu_volumeContainer__aWb0Y ghost-marker-setting";

    const sizeLabel = document.createElement("p");
    sizeLabel.className = "game-menu_subHeader__Ul5Vl";
    sizeLabel.textContent = "Marker Size";
    sizeContainer.appendChild(sizeLabel);

    const sizeSliderContainer = document.createElement("div");
    sizeSliderContainer.className = "game-menu_sliderContainer__suHjk";
    sizeSliderContainer.style.cssText =
      "display: flex; align-items: center; gap: 10px;";

    const sizeIcon = document.createElement("div");
    sizeIcon.className = "game-menu_icon__qC_vb";
    sizeIcon.innerHTML = `
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <circle cx="12" cy="12" r="${GG.settings.size / 2}" fill="${
                  GG.settings.markerColor
                }" fill-opacity="${GG.settings.opacity}" stroke="${
                  GG.settings.outlineColor
                }" stroke-width="${GG.settings.outlineWidth}"/>
            </svg>
        `;

    const sizeSlider = document.createElement("div");
    sizeSlider.className =
      "styles_rangeslider__8vVg3 styles_variantPurple__1s1cU";
    sizeSlider.style.cssText = "flex: 1;";

    const sizeFill = document.createElement("div");
    sizeFill.className = "styles_fill__9MeZ9";
    sizeFill.style.width = `${((GG.settings.size - 5) / 15) * 100}%`;

    const sizeHandle = document.createElement("div");
    sizeHandle.className = "styles_handle__h9ytQ";
    sizeHandle.tabIndex = 0;
    sizeHandle.style.left = `${((GG.settings.size - 5) / 15) * 100}%`;
    sizeHandle.innerHTML = "<div></div>";

    sizeSlider.appendChild(sizeFill);
    sizeSlider.appendChild(sizeHandle);

    const sizeValue = document.createElement("span");
    sizeValue.textContent = GG.settings.size;
    sizeValue.style.cssText = "font-size: 14px; color: #ccc; min-width: 40px;";

    makeSliderDraggable(
      sizeSlider,
      sizeFill,
      sizeHandle,
      5,
      20,
      0.1,
      (value) => {
        const displayValue = Number.isInteger(value) ? value : value.toFixed(1);
        GG.settings.size = value;
        sizeValue.textContent = displayValue;
        sizeFill.style.width = `${((value - 5) / 15) * 100}%`;
        sizeHandle.style.left = `${((value - 5) / 15) * 100}%`;
        sizeIcon.innerHTML = `
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <circle cx="12" cy="12" r="${value / 2}" fill="${
                      GG.settings.markerColor
                    }" fill-opacity="${GG.settings.opacity}" stroke="${
                      GG.settings.outlineColor
                    }" stroke-width="${GG.settings.outlineWidth}"/>
                </svg>
            `;
        GG.saveSettings();
      },
    );

    sizeSliderContainer.appendChild(sizeIcon);
    sizeSliderContainer.appendChild(sizeSlider);
    sizeSliderContainer.appendChild(sizeValue);
    sizeContainer.appendChild(sizeSliderContainer);
    ghostSettingsContainer.appendChild(sizeContainer);

    if (!useExistingDivider) {
      const dividerBottom = document.createElement("div");
      dividerBottom.className = "game-menu_divider__IhA4t ghost-marker-setting";
      ghostSettingsContainer.appendChild(dividerBottom);
    }

    if (useExistingDivider && lastDivider.parentNode) {
      lastDivider.parentNode.insertBefore(
        ghostSettingsContainer,
        lastDivider.nextSibling,
      );
    } else if (closeButton && closeButton.parentNode) {
      closeButton.parentNode.insertBefore(ghostSettingsContainer, closeButton);
    } else if (buttonsContainer && buttonsContainer.parentNode) {
      buttonsContainer.parentNode.insertBefore(
        ghostSettingsContainer,
        buttonsContainer,
      );
    } else {
      settingsContainer.appendChild(ghostSettingsContainer);
    }
  };
})();