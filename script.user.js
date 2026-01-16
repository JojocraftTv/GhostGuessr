// ==UserScript==
// @name         GhostGuessr
// @namespace    http://tampermonkey.net/
// @version      2.0
// @description  Marks your Current Streetview Location on the GeoGuessr Map with a Red Dot. Toggle with hotkey.
// @author       VellusFox, Niceas
// @match        https://www.geoguessr.com/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=geoguessr.com
// @grant        GM_setValue
// @grant        GM_getValue
// @license      MIT
// ==/UserScript==

(function () {
  "use strict";

  const DEFAULT_SETTINGS = {
    enabled: false,
    markerColor: "#FF0000",
    outlineColor: "#FFFFFF",
    opacity: 0.7,
    outlineWidth: 2,
    size: 10,
    hotkey: "1",
  };

  let coords = { lat: 0, lng: 0 };
  let marker = null;
  let settings = { ...DEFAULT_SETTINGS };
  let gmap = null;
  let toggleButton = null;
  let buttonCreated = false;
  let hotkeyInput = null;

  function loadSettings() {
    const saved = GM_getValue("ghostguessr_settings");
    if (saved) {
      settings = { ...DEFAULT_SETTINGS, ...saved };
    } else {
      settings = { ...DEFAULT_SETTINGS };
    }
  }

  function saveSettings() {
    GM_setValue("ghostguessr_settings", settings);
    if (marker && settings.enabled) {
      updateMarkerStyle();
    }
  }

  var originalOpen = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function (method, url) {
    if (
      method.toUpperCase() === "POST" &&
      url.includes("maps.googleapis.com") &&
      (url.includes("GetMetadata") || url.includes("SingleImageSearch"))
    ) {
      this.addEventListener("load", function () {
        try {
          let result = this.responseText;
          let pattern = /-?\d+\.\d+,-?\d+\.\d+/g;
          let matches = result.match(pattern);
          if (matches && matches.length > 0) {
            let match = matches[0];
            let split = match.split(",");
            coords.lat = Number.parseFloat(split[0]);
            coords.lng = Number.parseFloat(split[1]);
            if (settings.enabled && gmap) placeMarker();
          }
        } catch (e) {}
      });
    }
    return originalOpen.apply(this, arguments);
  };

  function getGoogleMap() {
    let container =
      document.querySelector(".guess-map_canvas__cvpqv") ||
      document.querySelector('[data-qa="guess-map-canvas"]');
    if (!container) return null;
    if (gmap && gmap.getDiv && gmap.getDiv() === container) return gmap;
    gmap = null;
    try {
      let reactKey = Object.keys(container).find((key) =>
        key.startsWith("__reactFiber$")
      );
      if (reactKey) {
        let fiber = container[reactKey];
        let current = fiber;
        while (current) {
          if (current.memoizedProps && current.memoizedProps.map) {
            gmap = current.memoizedProps.map;
            return gmap;
          }
          current = current.return;
        }
      }
    } catch (e) {}
    return null;
  }

  function createMarker() {
    if (!coords.lat || !coords.lng) return;
    gmap = getGoogleMap();
    if (!gmap) return;
    if (marker) {
      marker.setMap(null);
      marker = null;
    }
    try {
      if (typeof google !== "undefined" && google.maps) {
        let position = new google.maps.LatLng(coords.lat, coords.lng);
        let icon = {
          path: google.maps.SymbolPath.CIRCLE,
          fillColor: hexToRgba(settings.markerColor, settings.opacity),
          fillOpacity: 1,
          strokeColor: settings.outlineColor,
          strokeWeight: settings.outlineWidth,
          scale: settings.size,
        };
        marker = new google.maps.Marker({
          position: position,
          map: gmap,
          icon: icon,
          opacity: settings.opacity,
          zIndex: 999,
          optimized: false,
          clickable: false,
          draggable: false,
        });

        if (marker) {
          google.maps.event.clearListeners(marker, "click");
          google.maps.event.clearListeners(marker, "mousedown");
          google.maps.event.clearListeners(marker, "mouseup");
        }
      }
    } catch (e) {
      createDivMarker();
    }
  }

  function updateMarkerStyle() {
    if (!marker || !marker.setIcon) return;

    try {
      if (typeof google !== "undefined" && google.maps) {
        let icon = {
          path: google.maps.SymbolPath.CIRCLE,
          fillColor: hexToRgba(settings.markerColor, settings.opacity),
          fillOpacity: 1,
          strokeColor: settings.outlineColor,
          strokeWeight: settings.outlineWidth,
          scale: settings.size,
        };
        marker.setIcon(icon);
        marker.setOpacity(settings.opacity);
      }
    } catch (e) {}
  }

  function hexToRgba(hex, alpha) {
    let r = parseInt(hex.slice(1, 3), 16);
    let g = parseInt(hex.slice(3, 5), 16);
    let b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }

  function createDivMarker() {
    let container =
      document.querySelector(".guess-map_canvas__cvpqv") ||
      document.querySelector('[data-qa="guess-map-canvas"]');
    if (!container) return;
    let existing = document.getElementById("geo-div-marker");
    if (existing) existing.remove();
    let markerDiv = document.createElement("div");
    markerDiv.id = "geo-div-marker";
    markerDiv.style.cssText = `
            position: absolute !important;
            top: 50% !important;
            left: 50% !important;
            transform: translate(-50%, -50%) !important;
            width: ${settings.size * 2.5}px !important;
            height: ${settings.size * 2.5}px !important;
            background: ${hexToRgba(
              settings.markerColor,
              settings.opacity
            )} !important;
            border: ${settings.outlineWidth}px solid ${
      settings.outlineColor
    } !important;
            border-radius: 50% !important;
            pointer-events: none !important;
            z-index: 9999 !important;
            box-shadow: 0 0 10px ${hexToRgba(
              settings.markerColor,
              settings.opacity * 0.5
            )} !important;
            cursor: default !important;
        `;
    container.appendChild(markerDiv);
  }

  function placeMarker() {
    if (!coords.lat || !coords.lng) return;
    if (!marker) {
      createMarker();
    } else {
      try {
        if (
          typeof google !== "undefined" &&
          google.maps &&
          marker.setPosition
        ) {
          let position = new google.maps.LatLng(coords.lat, coords.lng);
          marker.setPosition(position);
        }
      } catch (e) {}
    }
  }

  function createToggleButton() {
    if (document.querySelector('[data-qa="ghost-marker-toggle"]')) {
      toggleButton = document.querySelector('[data-qa="ghost-marker-toggle"]');
      buttonCreated = true;
      updateButtonState();
      return;
    }

    let buttonContainer = document.querySelector(".styles_columnTwo__kyT60");
    if (!buttonContainer) return;

    let controlDiv = document.createElement("div");
    controlDiv.className = "styles_control__Pa4Ta";

    let tooltipRef = document.createElement("span");
    tooltipRef.className = "tooltip_reference__CwDbn";

    toggleButton = document.createElement("button");
    toggleButton.className =
      "styles_hudButton__kzfFK styles_sizeSmall__O7Bw_ styles_roundBoth__hcuEN";
    toggleButton.setAttribute("data-qa", "ghost-marker-toggle");

    let svgContainer = document.createElement("div");
    svgContainer.style.cssText = "transform: none;";
    svgContainer.innerHTML = createSvg(
      settings.enabled ? "#00FF00" : "#FF0000"
    );
    toggleButton.appendChild(svgContainer);

    let tooltip = document.createElement("div");
    tooltip.className =
      "tooltip_tooltip__3D6bz tooltip_right__wLi_G tooltip_roundnessXS__BGhWu tooltip_variantDefault__7WTJ0 tooltip_hideOnXs__S3erz";
    tooltip.style.cssText =
      "top: 50%; transform: translateY(-50%) scale(0); opacity: 0; visibility: hidden; --tooltip-width: none;";

    let tooltipText = document.createElement("div");
    tooltipText.textContent = settings.enabled
      ? `Hide ghost marker (${settings.hotkey})`
      : `Show ghost marker (${settings.hotkey})`;

    let tooltipArrow = document.createElement("div");
    tooltipArrow.className = "tooltip_arrow__LJ1of";

    tooltip.appendChild(tooltipText);
    tooltip.appendChild(tooltipArrow);

    tooltipRef.appendChild(toggleButton);
    tooltipRef.appendChild(tooltip);
    controlDiv.appendChild(tooltipRef);
    buttonContainer.appendChild(controlDiv);

    buttonCreated = true;

    toggleButton.addEventListener("click", function (e) {
      e.stopPropagation();
      toggleMarker();
      updateButtonState();
    });

    toggleButton.addEventListener("mouseenter", function () {
      tooltip.style.transform = "translateY(-50%) scale(1)";
      tooltip.style.opacity = "1";
      tooltip.style.visibility = "visible";
    });

    toggleButton.addEventListener("mouseleave", function () {
      tooltip.style.transform = "translateY(-50%) scale(0)";
      tooltip.style.opacity = "0";
      tooltip.style.visibility = "hidden";
    });

    updateButtonState();
  }

  function updateButtonState() {
    if (!toggleButton) return;

    let svgContainer = toggleButton.querySelector("div");
    if (!svgContainer) return;

    svgContainer.innerHTML = createSvg(
      settings.enabled ? "#00FF00" : "#FF0000"
    );

    if (settings.enabled) {
      if (!toggleButton.classList.contains("styles_active__bPW2Y")) {
        toggleButton.classList.add("styles_active__bPW2Y");
      }
      toggleButton.style.opacity = "1";
      toggleButton.removeAttribute("title");

      let tooltipDiv = toggleButton
        .closest(".tooltip_reference__CwDbn")
        .querySelector(".tooltip_tooltip__3D6bz div");
      if (tooltipDiv) {
        tooltipDiv.textContent = `Hide ghost marker (${settings.hotkey})`;
      }
    } else {
      toggleButton.classList.remove("styles_active__bPW2Y");
      toggleButton.style.opacity = "0.8";
      toggleButton.removeAttribute("title");

      let tooltipDiv = toggleButton
        .closest(".tooltip_reference__CwDbn")
        .querySelector(".tooltip_tooltip__3D6bz div");
      if (tooltipDiv) {
        tooltipDiv.textContent = `Show ghost marker (${settings.hotkey})`;
      }
    }
  }

  function createSvg(color) {
    return `
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style="color: transparent;">
                <circle cx="12" cy="12" r="8" fill="currentColor" stroke="white" stroke-width="2"/>
                <circle cx="12" cy="12" r="6" fill="${color}"/>
            </svg>
        `;
  }

  function toggleMarker() {
    if (!coords.lat || !coords.lng) return;

    let isOnMapView =
      document.querySelector(".coordinate-guess_mapContainer__Y3bUt") ||
      document.querySelector(".guess-map_canvas__cvpqv");
    if (!isOnMapView) return;

    settings.enabled = !settings.enabled;
    saveSettings();

    if (settings.enabled) {
      placeMarker();
    } else {
      if (marker && marker.setMap) marker.setMap(null);
      let divMarker = document.getElementById("geo-div-marker");
      if (divMarker) divMarker.style.display = "none";
      marker = null;
    }
  }

  function handleHotkey(event) {
    if (
      event.key.toLowerCase() === settings.hotkey.toLowerCase() &&
      !event.ctrlKey &&
      !event.altKey &&
      !event.metaKey
    ) {
      event.stopPropagation();
      event.preventDefault();
      toggleMarker();
      if (toggleButton) updateButtonState();
    }
  }

  function setupHotkeyListener() {
    document.removeEventListener("keydown", handleHotkey, true);
    document.addEventListener("keydown", handleHotkey, true);
  }

  function createGhostMarkerSettings() {
    const settingsContainer = document.querySelector(
      ".game-menu_settingsContainer__NeJu2"
    );
    if (!settingsContainer) return;
    if (settingsContainer.querySelector(".ghost-marker-settings-container")) {
      return;
    }

    document
      .querySelectorAll(".ghost-marker-setting")
      .forEach((el) => el.remove());
    const buttonsContainer = settingsContainer.querySelector(
      ".buttons_buttons__3yvvA"
    );
    const closeButton = settingsContainer.querySelector(
      'button[class*="button_button"]'
    );
    const dividers = settingsContainer.querySelectorAll(
      ".game-menu_divider__IhA4t"
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
                <text x="12" y="15" text-anchor="middle" font-family="Arial" font-size="10" fill="#8b5cf6">${settings.hotkey}</text>
            </svg>
        `;

    hotkeyInput = document.createElement("input");
    hotkeyInput.type = "text";
    hotkeyInput.value = settings.hotkey;
    hotkeyInput.maxLength = 1;
    hotkeyInput.style.cssText = `
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

    hotkeyInput.addEventListener("focus", function () {
      this.value = "";
    });

    hotkeyInput.addEventListener("blur", function () {
      if (this.value === "") {
        this.value = settings.hotkey;
      }
    });

    hotkeyInput.addEventListener("input", function () {
      const key = this.value.toUpperCase();
      if (key.length > 0 && /^[A-Z0-9]$/.test(key)) {
        this.value = key;
        settings.hotkey = key;
        saveSettings();
        setupHotkeyListener();
        updateButtonState();

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
    hotkeyInputContainer.appendChild(hotkeyInput);
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
                <circle cx="12" cy="12" r="10" fill="${settings.markerColor}" stroke="#333" stroke-width="2"/>
            </svg>
        `;

    const colorInput = document.createElement("input");
    colorInput.type = "color";
    colorInput.value = settings.markerColor;
    colorInput.style.cssText =
      "flex: 1; height: 36px; border: none; background: transparent; cursor: pointer;";

    const colorHex = document.createElement("span");
    colorHex.textContent = settings.markerColor;
    colorHex.style.cssText =
      "font-family: monospace; font-size: 14px; color: #ccc; min-width: 60px;";

    colorInput.addEventListener("input", function () {
      settings.markerColor = this.value;
      colorIcon.innerHTML = `
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <circle cx="12" cy="12" r="10" fill="${this.value}" stroke="#333" stroke-width="2"/>
                </svg>
            `;
      colorHex.textContent = this.value;
      saveSettings();
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
                <circle cx="12" cy="12" r="10" fill="none" stroke="${settings.outlineColor}" stroke-width="4"/>
            </svg>
        `;

    const outlineInput = document.createElement("input");
    outlineInput.type = "color";
    outlineInput.value = settings.outlineColor;
    outlineInput.style.cssText =
      "flex: 1; height: 36px; border: none; background: transparent; cursor: pointer;";

    const outlineHex = document.createElement("span");
    outlineHex.textContent = settings.outlineColor;
    outlineHex.style.cssText =
      "font-family: monospace; font-size: 14px; color: #ccc; min-width: 60px;";

    outlineInput.addEventListener("input", function () {
      settings.outlineColor = this.value;
      outlineIcon.innerHTML = `
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <circle cx="12" cy="12" r="10" fill="none" stroke="${this.value}" stroke-width="4"/>
                </svg>
            `;
      outlineHex.textContent = this.value;
      saveSettings();
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
                <circle cx="12" cy="12" r="10" fill="${settings.markerColor}" fill-opacity="${settings.opacity}" stroke="${settings.outlineColor}" stroke-width="2"/>
            </svg>
        `;

    const opacitySlider = document.createElement("div");
    opacitySlider.className =
      "styles_rangeslider__8vVg3 styles_variantPurple__1s1cU";
    opacitySlider.style.cssText = "flex: 1;";

    const opacityFill = document.createElement("div");
    opacityFill.className = "styles_fill__9MeZ9";
    opacityFill.style.width = `${settings.opacity * 100}%`;

    const opacityHandle = document.createElement("div");
    opacityHandle.className = "styles_handle__h9ytQ";
    opacityHandle.tabIndex = 0;
    opacityHandle.style.left = `${settings.opacity * 100}%`;
    opacityHandle.innerHTML = "<div></div>";

    opacitySlider.appendChild(opacityFill);
    opacitySlider.appendChild(opacityHandle);

    const opacityValue = document.createElement("span");
    opacityValue.textContent = `${Math.round(settings.opacity * 100)}%`;
    opacityValue.style.cssText =
      "font-size: 14px; color: #ccc; min-width: 40px;";

    const makeSliderDraggable = (
      slider,
      fill,
      handle,
      min,
      max,
      step,
      onChange
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
        settings.opacity = value;
        opacityValue.textContent = `${Math.round(value * 100)}%`;
        opacityIcon.innerHTML = `
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <circle cx="12" cy="12" r="10" fill="${settings.markerColor}" fill-opacity="${value}" stroke="${settings.outlineColor}" stroke-width="2"/>
                </svg>
            `;
        saveSettings();
      }
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
                <circle cx="12" cy="12" r="10" fill="none" stroke="${settings.outlineColor}" stroke-width="${settings.outlineWidth}"/>
            </svg>
        `;

    const widthSlider = document.createElement("div");
    widthSlider.className =
      "styles_rangeslider__8vVg3 styles_variantPurple__1s1cU";
    widthSlider.style.cssText = "flex: 1;";

    const widthFill = document.createElement("div");
    widthFill.className = "styles_fill__9MeZ9";
    widthFill.style.width = `${(settings.outlineWidth / 5) * 100}%`;

    const widthHandle = document.createElement("div");
    widthHandle.className = "styles_handle__h9ytQ";
    widthHandle.tabIndex = 0;
    widthHandle.style.left = `${(settings.outlineWidth / 5) * 100}%`;
    widthHandle.innerHTML = "<div></div>";

    widthSlider.appendChild(widthFill);
    widthSlider.appendChild(widthHandle);

    const widthValue = document.createElement("span");
    widthValue.textContent = `${settings.outlineWidth}px`;
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
        settings.outlineWidth = value;
        widthValue.textContent = `${displayValue}px`;
        widthFill.style.width = `${(value / 5) * 100}%`;
        widthHandle.style.left = `${(value / 5) * 100}%`;
        widthIcon.innerHTML = `
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <circle cx="12" cy="12" r="10" fill="none" stroke="${settings.outlineColor}" stroke-width="${value}"/>
                </svg>
            `;
        saveSettings();
      }
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
                <circle cx="12" cy="12" r="${settings.size / 2}" fill="${
      settings.markerColor
    }" fill-opacity="${settings.opacity}" stroke="${
      settings.outlineColor
    }" stroke-width="${settings.outlineWidth}"/>
            </svg>
        `;

    const sizeSlider = document.createElement("div");
    sizeSlider.className =
      "styles_rangeslider__8vVg3 styles_variantPurple__1s1cU";
    sizeSlider.style.cssText = "flex: 1;";

    const sizeFill = document.createElement("div");
    sizeFill.className = "styles_fill__9MeZ9";
    sizeFill.style.width = `${((settings.size - 5) / 15) * 100}%`;

    const sizeHandle = document.createElement("div");
    sizeHandle.className = "styles_handle__h9ytQ";
    sizeHandle.tabIndex = 0;
    sizeHandle.style.left = `${((settings.size - 5) / 15) * 100}%`;
    sizeHandle.innerHTML = "<div></div>";

    sizeSlider.appendChild(sizeFill);
    sizeSlider.appendChild(sizeHandle);

    const sizeValue = document.createElement("span");
    sizeValue.textContent = settings.size;
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
        settings.size = value;
        sizeValue.textContent = displayValue;
        sizeFill.style.width = `${((value - 5) / 15) * 100}%`;
        sizeHandle.style.left = `${((value - 5) / 15) * 100}%`;
        sizeIcon.innerHTML = `
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <circle cx="12" cy="12" r="${value / 2}" fill="${
          settings.markerColor
        }" fill-opacity="${settings.opacity}" stroke="${
          settings.outlineColor
        }" stroke-width="${settings.outlineWidth}"/>
                </svg>
            `;
        saveSettings();
      }
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
        lastDivider.nextSibling
      );
    } else if (closeButton && closeButton.parentNode) {
      closeButton.parentNode.insertBefore(ghostSettingsContainer, closeButton);
    } else if (buttonsContainer && buttonsContainer.parentNode) {
      buttonsContainer.parentNode.insertBefore(
        ghostSettingsContainer,
        buttonsContainer
      );
    } else {
      settingsContainer.appendChild(ghostSettingsContainer);
    }
  }

  function initialize() {
    loadSettings();
    setupHotkeyListener();

    const checkAndCreate = () => {
      if (
        !buttonCreated &&
        document.querySelector(".styles_columnTwo__kyT60")
      ) {
        createToggleButton();
      }
      if (settings.enabled) {
        placeMarker();
      }

      const settingsContainer = document.querySelector(
        ".game-menu_settingsContainer__NeJu2"
      );
      if (settingsContainer && settingsContainer.offsetParent !== null) {
        createGhostMarkerSettings();
      }
    };

    checkAndCreate();

    const observer = new MutationObserver(function (mutations) {
      const buttonContainerExists = document.querySelector(
        ".styles_columnTwo__kyT60"
      );
      const ourButtonExists = document.querySelector(
        '[data-qa="ghost-marker-toggle"]'
      );

      if (buttonContainerExists && !ourButtonExists) {
        setTimeout(() => {
          buttonCreated = false;
          toggleButton = null;
          createToggleButton();
        }, 500);
      }
      if (settings.enabled) {
        placeMarker();
      }

      const settingsContainer = document.querySelector(
        ".game-menu_settingsContainer__NeJu2"
      );
      if (settingsContainer && settingsContainer.offsetParent !== null) {
        createGhostMarkerSettings();
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["style"],
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initialize);
  } else {
    initialize();
  }
})();
