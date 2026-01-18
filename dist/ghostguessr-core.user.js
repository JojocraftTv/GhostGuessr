// ==UserScript==
// @name         GhostGuessr (Auto-Build Version)
// @namespace    https://github.com/JojocraftTv/GhostGuessr
// @version      Auto-Build Version
// @description  Marks your Current Streetview Location on the GeoGuessr Map with a Red Dot. Toggle with hotkey.
// @author       VellusFox, Niceas
// @match        https://www.geoguessr.com/*
// @icon         https://raw.githubusercontent.com/JojocraftTv/GhostGuessr/refs/heads/main/icons/GhostGuessr.png
// @grant        GM_setValue
// @grant        GM_getValue
// @license      MIT
// ==/UserScript==

(function () {
  "use strict";

  const GG = (window.GhostGuessr = window.GhostGuessr || {});

  GG.DEFAULT_SETTINGS = {
    enabled: false,
    markerColor: "#FF0000",
    outlineColor: "#FFFFFF",
    opacity: 0.7,
    outlineWidth: 2,
    size: 10,
    hotkey: "1",
  };

  GG.coords = { lat: 0, lng: 0 };
  GG.marker = null;
  GG.settings = { ...GG.DEFAULT_SETTINGS };
  GG.gmap = null;
  GG.toggleButton = null;
  GG.buttonCreated = false;
  GG.hotkeyInput = null;
  GG.markerRetryId = null;
  GG.settingsLoaded = false;
})();



(function () {
  "use strict";

  const GG = window.GhostGuessr;

  GG.hexToRgba = function (hex, alpha) {
    let r = parseInt(hex.slice(1, 3), 16);
    let g = parseInt(hex.slice(3, 5), 16);
    let b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  };
})();


(function () {
  "use strict";

  const GG = window.GhostGuessr;

  const originalOpen = XMLHttpRequest.prototype.open;
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
            GG.coords.lat = Number.parseFloat(split[0]);
            GG.coords.lng = Number.parseFloat(split[1]);
            if (GG.settings.enabled && GG.gmap) GG.placeMarker();
          }
        } catch (e) {}
      });
    }
    return originalOpen.apply(this, arguments);
  };

  GG.getGoogleMap = function () {
    let container =
      document.querySelector(".guess-map_canvas__cvpqv") ||
      document.querySelector('[data-qa="guess-map-canvas"]');
    if (!container) return null;
    if (GG.gmap && GG.gmap.getDiv && GG.gmap.getDiv() === container) {
      return GG.gmap;
    }
    GG.gmap = null;
    try {
      let reactKey = Object.keys(container).find((key) =>
        key.startsWith("__reactFiber$"),
      );
      if (reactKey) {
        let fiber = container[reactKey];
        let current = fiber;
        while (current) {
          if (current.memoizedProps && current.memoizedProps.map) {
            GG.gmap = current.memoizedProps.map;
            return GG.gmap;
          }
          current = current.return;
        }
      }
    } catch (e) {}
    return null;
  };

  GG.createMarker = function () {
    if (!GG.coords.lat || !GG.coords.lng) return;
    GG.gmap = GG.getGoogleMap();
    if (!GG.gmap) return;
    if (GG.marker) {
      GG.marker.setMap(null);
      GG.marker = null;
    }
    try {
      if (typeof google !== "undefined" && google.maps) {
        let position = new google.maps.LatLng(GG.coords.lat, GG.coords.lng);
        let icon = {
          path: google.maps.SymbolPath.CIRCLE,
          fillColor: GG.hexToRgba(GG.settings.markerColor, GG.settings.opacity),
          fillOpacity: 1,
          strokeColor: GG.settings.outlineColor,
          strokeWeight: GG.settings.outlineWidth,
          scale: GG.settings.size,
        };
        GG.marker = new google.maps.Marker({
          position: position,
          map: GG.gmap,
          icon: icon,
          opacity: GG.settings.opacity,
          zIndex: 999,
          optimized: false,
          clickable: false,
          draggable: false,
        });

        if (GG.marker) {
          google.maps.event.clearListeners(GG.marker, "click");
          google.maps.event.clearListeners(GG.marker, "mousedown");
          google.maps.event.clearListeners(GG.marker, "mouseup");
        }
      }
    } catch (e) {
      GG.createDivMarker();
    }
  };

  GG.updateMarkerStyle = function () {
    if (!GG.marker || !GG.marker.setIcon) return;

    try {
      if (typeof google !== "undefined" && google.maps) {
        let icon = {
          path: google.maps.SymbolPath.CIRCLE,
          fillColor: GG.hexToRgba(GG.settings.markerColor, GG.settings.opacity),
          fillOpacity: 1,
          strokeColor: GG.settings.outlineColor,
          strokeWeight: GG.settings.outlineWidth,
          scale: GG.settings.size,
        };
        GG.marker.setIcon(icon);
        GG.marker.setOpacity(GG.settings.opacity);
      }
    } catch (e) {}
  };

  GG.createDivMarker = function () {
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
            width: ${GG.settings.size * 2.5}px !important;
            height: ${GG.settings.size * 2.5}px !important;
            background: ${GG.hexToRgba(
              GG.settings.markerColor,
              GG.settings.opacity,
            )} !important;
            border: ${GG.settings.outlineWidth}px solid ${
              GG.settings.outlineColor
            } !important;
            border-radius: 50% !important;
            pointer-events: none !important;
            z-index: 9999 !important;
            box-shadow: 0 0 10px ${GG.hexToRgba(
              GG.settings.markerColor,
              GG.settings.opacity * 0.5,
            )} !important;
            cursor: default !important;
        `;
    container.appendChild(markerDiv);
  };

  GG.placeMarker = function () {
    if (!GG.coords.lat || !GG.coords.lng) return;
    if (!GG.marker) {
      GG.createMarker();
    } else {
      try {
        if (
          typeof google !== "undefined" &&
          google.maps &&
          GG.marker.setPosition
        ) {
          let position = new google.maps.LatLng(GG.coords.lat, GG.coords.lng);
          GG.marker.setPosition(position);
        }
      } catch (e) {}
    }
  };

  GG.ensureMarkerVisible = function (attempt) {
    if (!GG.settings) {
      setTimeout(() => GG.ensureMarkerVisible(attempt), 100);
      return;
    }

    if (!GG.settings.enabled) return;
    if (!GG.coords.lat || !GG.coords.lng) return;
    if (GG.divMarkerActive) {
      const mapNow = GG.getGoogleMap();
      if (!mapNow || typeof mapNow.getDiv !== "function") return;
      const divMarker = document.getElementById("geo-div-marker");
      if (divMarker) divMarker.remove();
      GG.divMarkerActive = false;
    }

    let isOnMapView =
      document.querySelector(".coordinate-guess_mapContainer__Y3bUt") ||
      document.querySelector(".guess-map_canvas__cvpqv");
    if (!isOnMapView) return;

    GG.placeMarker();

    if (!GG.marker) {
      const nextAttempt = (attempt || 0) + 1;
      if (nextAttempt <= 30) {
        if (GG.markerRetryId) {
          clearTimeout(GG.markerRetryId);
        }
        GG.markerRetryId = setTimeout(
          () => GG.ensureMarkerVisible(nextAttempt),
          500,
        );
      }
    }
  };

  GG.toggleMarker = function () {
    if (!GG.coords.lat || !GG.coords.lng) return;

    let isOnMapView =
      document.querySelector(".coordinate-guess_mapContainer__Y3bUt") ||
      document.querySelector(".guess-map_canvas__cvpqv");
    if (!isOnMapView) return;

    GG.settings.enabled = !GG.settings.enabled;
    GG.saveSettings();

    if (GG.settings.enabled) {
      GG.placeMarker();
    } else {
      if (GG.marker && GG.marker.setMap) GG.marker.setMap(null);
      let divMarker = document.getElementById("geo-div-marker");
      if (divMarker) divMarker.style.display = "none";
      GG.marker = null;
    }
  };
})();



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

  GG.getSettingsContainer = function () {
    return (
      document.querySelector(".duels-settings_columns__At_5b") ||
      document.querySelector(".settings_root__GebxB .settings_container__54_c3") ||
      document.querySelector(".settings_sectionContainer__UIjyf") ||
      document.querySelector(".game-menu_settingsContainer__NeJu2")
    );
  };

  GG.createToggleButton = function () {
    if (document.querySelector('[data-qa="ghost-marker-toggle"]')) {
      GG.toggleButton = document.querySelector(
        '[data-qa="ghost-marker-toggle"]',
      );
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
    const settingsContainer = GG.getSettingsContainer();
    if (!settingsContainer) return;
    if (settingsContainer.querySelector(".ghost-marker-settings-container")) {
      return;
    }

    const isModernSettings = settingsContainer.classList.contains(
      "settings_container__54_c3",
    );
    const isNewSettingsSection = settingsContainer.classList.contains(
      "settings_sectionContainer__UIjyf",
    );

    const useModernStructure = isModernSettings || isNewSettingsSection;

    if (useModernStructure) {
      const ghostSettingsContainer = document.createElement("div");
      ghostSettingsContainer.className = "ghost-marker-settings-container";
      ghostSettingsContainer.style.cssText =
        "width: 100%; margin: 0; padding: 0;";

      const settingsSection = document.createElement("div");
      settingsSection.className = "settings-section_root__Wt_cF";

      const sectionHeader = document.createElement("div");
      sectionHeader.className =
        "section_sectionHeader___QLJB section_sizeMedium__CuXRP section_variantLight__G_gsY";

      const barsRoot = document.createElement("div");
      barsRoot.className = "bars_root__tryg2 bars_variantLight__r_x6H";

      const barsContent = document.createElement("span");
      barsContent.className = "bars_content__Nw_TD";

      const h2 = document.createElement("h2");
      h2.textContent = "Ghost Marker";
      barsContent.appendChild(h2);

      const barsAfter = document.createElement("div");
      barsAfter.className = "bars_after__50_BW";

      barsRoot.appendChild(barsContent);
      barsRoot.appendChild(barsAfter);
      sectionHeader.appendChild(barsRoot);

      const sectionContent = document.createElement("div");
      sectionContent.className = "settings-section_content__LGzLT";

      const hotkeyContainer = document.createElement("div");
      hotkeyContainer.className = "slider-option_wrapper__3gsTQ";
      hotkeyContainer.style.cssText = "margin-bottom: 16px;";

      const hotkeyIcon = document.createElement("div");
      hotkeyIcon.className = "slider-option_icon__qtnY8";
      hotkeyIcon.innerHTML = `
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect x="4" y="6" width="16" height="12" rx="2" stroke="#8b5cf6" stroke-width="2" fill="none"/>
        <text x="12" y="15" text-anchor="middle" font-family="Arial" font-size="10" fill="#8b5cf6">${GG.settings.hotkey}</text>
      </svg>
    `;

      const hotkeyLabel = document.createElement("div");
      hotkeyLabel.className = "slider-option_label__HSXrJ";
      hotkeyLabel.textContent = "Hotkey";

      const hotkeyValueContainer = document.createElement("form");
      hotkeyValueContainer.className = "slider-option_value__OM__C";

      GG.hotkeyInput = document.createElement("input");
      GG.hotkeyInput.type = "text";
      GG.hotkeyInput.value = GG.settings.hotkey;
      GG.hotkeyInput.maxLength = 1;
      GG.hotkeyInput.style.cssText = `
      width: 60px;
      height: 32px;
      background: rgba(255, 255, 255, 0.1);
      border: 1px solid #8b5cf6;
      border-radius: 6px;
      color: #fff;
      padding: 0 8px;
      font-size: 14px;
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

      hotkeyValueContainer.appendChild(GG.hotkeyInput);
      hotkeyContainer.appendChild(hotkeyIcon);
      hotkeyContainer.appendChild(hotkeyLabel);
      hotkeyContainer.appendChild(hotkeyValueContainer);
      sectionContent.appendChild(hotkeyContainer);

      const colorFlexContainer = document.createElement("div");
      colorFlexContainer.className =
        "flex_flex__Rxtgm flex_direction__Fa3Gs flex_gap__sXfgm flex_justify__2rGZO flex_align__PRoee";
      colorFlexContainer.style.cssText =
        "--direction: row; --gap: 16px; --justify: space-between; --align: center; margin-bottom: 16px;";

      const markerColorContainer = document.createElement("div");
      markerColorContainer.className =
        "flex_flex__Rxtgm flex_direction__Fa3Gs flex_gap__sXfgm flex_justify__2rGZO flex_align__PRoee";
      markerColorContainer.style.cssText =
        "--direction: column; --gap: 4px; --justify: flex-start; --align: stretch; flex: 1;";

      const markerColorLabel = document.createElement("label");
      markerColorLabel.className =
        "label_label__9xkbh shared_white60Variant__EC173 shared_boldWeight__U2puG label_italic__LM62Y";
      markerColorLabel.style.cssText =
        "--fs: var(--font-size-14); --lh: var(--line-height-14);";
      markerColorLabel.textContent = "Marker Color";

      const markerColorInputContainer = document.createElement("div");
      markerColorInputContainer.className =
        "flex_flex__Rxtgm flex_direction__Fa3Gs flex_gap__sXfgm flex_justify__2rGZO flex_align__PRoee";
      markerColorInputContainer.style.cssText =
        "--direction: row; --gap: 8px; --justify: flex-start; --align: center;";

      const markerColorPreview = document.createElement("div");
      markerColorPreview.style.cssText = `
      width: 32px;
      height: 32px;
      border-radius: 4px;
      background: ${GG.settings.markerColor};
      border: 2px solid rgba(255, 255, 255, 0.2);
      cursor: pointer;
    `;

      const markerColorInput = document.createElement("input");
      markerColorInput.type = "color";
      markerColorInput.value = GG.settings.markerColor;
      markerColorInput.style.cssText = `
      width: 32px;
      height: 32px;
      opacity: 0;
      position: absolute;
      cursor: pointer;
    `;

      const markerColorHex = document.createElement("label");
      markerColorHex.className =
        "label_label__9xkbh shared_boldWeight__U2puG label_italic__LM62Y";
      markerColorHex.style.cssText =
        "--fs: var(--font-size-14); --lh: var(--line-height-14); min-width: 70px;";
      markerColorHex.textContent = GG.settings.markerColor;

      markerColorInput.addEventListener("input", function () {
        GG.settings.markerColor = this.value;
        markerColorPreview.style.background = this.value;
        markerColorHex.textContent = this.value;
        GG.saveSettings();
      });

      markerColorInputContainer.appendChild(markerColorPreview);
      markerColorInputContainer.appendChild(markerColorInput);
      markerColorContainer.appendChild(markerColorLabel);
      markerColorContainer.appendChild(markerColorInputContainer);
      markerColorContainer.appendChild(markerColorHex);

      const outlineColorContainer = document.createElement("div");
      outlineColorContainer.className =
        "flex_flex__Rxtgm flex_direction__Fa3Gs flex_gap__sXfgm flex_justify__2rGZO flex_align__PRoee";
      outlineColorContainer.style.cssText =
        "--direction: column; --gap: 4px; --justify: flex-start; --align: stretch; flex: 1;";

      const outlineColorLabel = document.createElement("label");
      outlineColorLabel.className =
        "label_label__9xkbh shared_white60Variant__EC173 shared_boldWeight__U2puG label_italic__LM62Y";
      outlineColorLabel.style.cssText =
        "--fs: var(--font-size-14); --lh: var(--line-height-14);";
      outlineColorLabel.textContent = "Outline Color";

      const outlineColorInputContainer = document.createElement("div");
      outlineColorInputContainer.className =
        "flex_flex__Rxtgm flex_direction__Fa3Gs flex_gap__sXfgm flex_justify__2rGZO flex_align__PRoee";
      outlineColorInputContainer.style.cssText =
        "--direction: row; --gap: 8px; --justify: flex-start; --align: center;";

      const outlineColorPreview = document.createElement("div");
      outlineColorPreview.style.cssText = `
      width: 32px;
      height: 32px;
      border-radius: 4px;
      background: ${GG.settings.outlineColor};
      border: 2px solid rgba(255, 255, 255, 0.2);
      cursor: pointer;
    `;

      const outlineColorInput = document.createElement("input");
      outlineColorInput.type = "color";
      outlineColorInput.value = GG.settings.outlineColor;
      outlineColorInput.style.cssText = `
      width: 32px;
      height: 32px;
      opacity: 0;
      position: absolute;
      cursor: pointer;
    `;

      const outlineColorHex = document.createElement("label");
      outlineColorHex.className =
        "label_label__9xkbh shared_boldWeight__U2puG label_italic__LM62Y";
      outlineColorHex.style.cssText =
        "--fs: var(--font-size-14); --lh: var(--line-height-14); min-width: 70px;";
      outlineColorHex.textContent = GG.settings.outlineColor;

      outlineColorInput.addEventListener("input", function () {
        GG.settings.outlineColor = this.value;
        outlineColorPreview.style.background = this.value;
        outlineColorHex.textContent = this.value;
        GG.saveSettings();
      });

      outlineColorInputContainer.appendChild(outlineColorPreview);
      outlineColorInputContainer.appendChild(outlineColorInput);
      outlineColorContainer.appendChild(outlineColorLabel);
      outlineColorContainer.appendChild(outlineColorInputContainer);
      outlineColorContainer.appendChild(outlineColorHex);

      colorFlexContainer.appendChild(markerColorContainer);
      colorFlexContainer.appendChild(outlineColorContainer);
      sectionContent.appendChild(colorFlexContainer);

      const createSliderOption = (
        labelText,
        iconSvg,
        value,
        min,
        max,
        step,
        unit,
        onChange,
        onUpdateIcon = null,
      ) => {
        const sliderContainer = document.createElement("div");
        sliderContainer.className = "slider-option_wrapper__3gsTQ";
        sliderContainer.style.cssText = "margin-bottom: 16px;";

        const icon = document.createElement("div");
        icon.className = "slider-option_icon__qtnY8";
        icon.innerHTML = iconSvg;
        if (onUpdateIcon) {
          onUpdateIcon(icon, value);
        }

        const label = document.createElement("div");
        label.className = "slider-option_label__HSXrJ";
        label.textContent = labelText;

        const valueContainer = document.createElement("form");
        valueContainer.className = "slider-option_value__OM__C";

        const valueLabel = document.createElement("div");
        valueLabel.className = "slider-option_valueLabel__XS837";
        valueLabel.textContent =
          unit === "%" ? `${Math.round(value)}${unit}` : `${value}${unit}`;

        valueContainer.appendChild(valueLabel);

        const sliderWrapper = document.createElement("div");
        sliderWrapper.className = "slider-option_slider__kJaCT";

        const slider = document.createElement("div");
        slider.className =
          "styles_rangeslider__8vVg3 styles_variantPurple__1s1cU";
        slider.setAttribute("aria-valuemin", min);
        slider.setAttribute("aria-valuemax", max);
        slider.setAttribute("aria-valuenow", value);
        slider.setAttribute("aria-orientation", "horizontal");
        slider.setAttribute("aria-disabled", "false");

        const fill = document.createElement("div");
        fill.className = "styles_fill__9MeZ9";
        fill.style.width = `${((value - min) / (max - min)) * 100}%`;

        const handle = document.createElement("div");
        handle.className = "styles_handle__h9ytQ";
        handle.tabIndex = 0;
        handle.style.left = `${((value - min) / (max - min)) * 100}%`;
        handle.innerHTML = "<div></div>";

        slider.appendChild(fill);
        slider.appendChild(handle);
        sliderWrapper.appendChild(slider);

        sliderContainer.appendChild(icon);
        sliderContainer.appendChild(label);
        sliderContainer.appendChild(valueContainer);
        sliderContainer.appendChild(sliderWrapper);

        let isDragging = false;

        const updateFromEvent = (e) => {
          const rect = slider.getBoundingClientRect();
          let x = e.clientX - rect.left;
          x = Math.max(0, Math.min(x, rect.width));
          const percent = x / rect.width;
          const newValue = min + (max - min) * percent;
          const stepped = step ? Math.round(newValue / step) * step : newValue;
          const clamped = Math.max(min, Math.min(stepped, max));

          fill.style.width = `${((clamped - min) / (max - min)) * 100}%`;
          handle.style.left = `${((clamped - min) / (max - min)) * 100}%`;
          valueLabel.textContent =
            unit === "%"
              ? `${Math.round(clamped)}${unit}`
              : `${clamped.toFixed(1)}${unit}`;

          slider.setAttribute("aria-valuenow", clamped);
          if (onUpdateIcon) {
            onUpdateIcon(icon, clamped);
          }
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

        return sliderContainer;
      };

      const transparencySlider = createSliderOption(
        "Transparency",
        `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="12" cy="12" r="10" fill="${GG.settings.markerColor}" fill-opacity="${GG.settings.opacity}" stroke="${GG.settings.outlineColor}" stroke-width="${GG.settings.outlineWidth}"/>
      </svg>`,
        Math.round(GG.settings.opacity * 100),
        0,
        100,
        1,
        "%",
        (value) => {
          GG.settings.opacity = value / 100;
          GG.saveSettings();
        },
        (icon, value) => {
          icon.innerHTML = `
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <circle cx="12" cy="12" r="10" fill="${GG.settings.markerColor}" fill-opacity="${
            value / 100
          }" stroke="${GG.settings.outlineColor}" stroke-width="${GG.settings.outlineWidth}"/>
        </svg>`;
        },
      );

      sectionContent.appendChild(transparencySlider);

      const outlineWidthSlider = createSliderOption(
        "Outline Width",
        `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="12" cy="12" r="10" fill="none" stroke="${GG.settings.outlineColor}" stroke-width="${GG.settings.outlineWidth}"/>
      </svg>`,
        GG.settings.outlineWidth,
        0.5,
        5,
        0.1,
        "px",
        (value) => {
          GG.settings.outlineWidth = value;
          GG.saveSettings();
        },
        (icon, value) => {
          icon.innerHTML = `
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <circle cx="12" cy="12" r="10" fill="none" stroke="${GG.settings.outlineColor}" stroke-width="${value}"/>
        </svg>`;
        },
      );

      sectionContent.appendChild(outlineWidthSlider);

      const sizeSlider = createSliderOption(
        "Marker Size",
        `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="12" cy="12" r="${GG.settings.size / 2}" fill="${GG.settings.markerColor}" fill-opacity="${GG.settings.opacity}" stroke="${GG.settings.outlineColor}" stroke-width="${GG.settings.outlineWidth}"/>
      </svg>`,
        GG.settings.size,
        5,
        20,
        0.5,
        "",
        (value) => {
          GG.settings.size = value;
          GG.saveSettings();
        },
        (icon, value) => {
          icon.innerHTML = `
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <circle cx="12" cy="12" r="${value / 2}" fill="${GG.settings.markerColor}" fill-opacity="${GG.settings.opacity}" stroke="${GG.settings.outlineColor}" stroke-width="${GG.settings.outlineWidth}"/>
        </svg>`;
        },
      );

      sectionContent.appendChild(sizeSlider);

      settingsSection.appendChild(sectionHeader);
      settingsSection.appendChild(sectionContent);
      ghostSettingsContainer.appendChild(settingsSection);

      const existingSections = settingsContainer.querySelectorAll(
        ".settings-section_root__Wt_cF",
      );
      if (existingSections.length > 0) {
        const lastSection = existingSections[existingSections.length - 1];
        lastSection.parentNode.insertBefore(
          ghostSettingsContainer,
          lastSection.nextSibling,
        );
      } else {
        settingsContainer.appendChild(ghostSettingsContainer);
      }

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



(function () {
  "use strict";

  const GG = window.GhostGuessr;
  const hasGMStorage =
    typeof GM_getValue === "function" && typeof GM_setValue === "function";

  const normalizeOpacity = (value) => {
    if (typeof value !== "number" || Number.isNaN(value)) return 0.7;
    if (value > 1) {
      return value > 100 ? 1 : value / 100;
    }
    return value < 0 ? 0 : value;
  };

  const loadLocalSettings = () => {
    try {
      const rawValue = window.localStorage.getItem("ghostguessr_settings");
      return rawValue ? JSON.parse(rawValue) : null;
    } catch {
      return null;
    }
  };

  const saveLocalSettings = (value) => {
    try {
      window.localStorage.setItem("ghostguessr_settings", JSON.stringify(value));
    } catch {}
  };

  GG.loadSettings = function () {
    let saved = null;
    if (hasGMStorage) {
      try {
        saved = GM_getValue("ghostguessr_settings");
      } catch {}
    } else {
      saved = loadLocalSettings();
    }
    if (saved) {
      GG.settings = { ...GG.DEFAULT_SETTINGS, ...saved };
    } else {
      GG.settings = { ...GG.DEFAULT_SETTINGS };
    }
    GG.settings.opacity = normalizeOpacity(GG.settings.opacity);
    GG.settingsLoaded = true;
  };

  GG.saveSettings = function () {
    if (hasGMStorage) {
      try {
        GM_setValue("ghostguessr_settings", GG.settings);
      } catch {}
    } else {
      saveLocalSettings(GG.settings);
    }
    if (GG.marker && GG.settings.enabled) {
      GG.updateMarkerStyle();
    }
  };

  GG.handleHotkey = function (event) {
    if (
      event.key.toLowerCase() === GG.settings.hotkey.toLowerCase() &&
      !event.ctrlKey &&
      !event.altKey &&
      !event.metaKey
    ) {
      event.stopPropagation();
      event.preventDefault();
      GG.toggleMarker();
      if (GG.toggleButton) GG.updateButtonState();
    }
  };

  GG.setupHotkeyListener = function () {
    document.removeEventListener("keydown", GG.handleHotkey, true);
    document.addEventListener("keydown", GG.handleHotkey, true);
  };

  if (!GG.settingsLoaded) {
    GG.loadSettings();
  }
})();



(function () {
  "use strict";

  const GG = window.GhostGuessr;

  GG.initialize = function () {
    GG.loadSettings();
    GG.setupHotkeyListener();

    const checkAndCreate = () => {
      if (
        !GG.buttonCreated &&
        document.querySelector(".styles_columnTwo__kyT60")
      ) {
        GG.createToggleButton();
      }
      if (GG.settings.enabled) {
        GG.ensureMarkerVisible();
      }

      const settingsContainer = GG.getSettingsContainer
        ? GG.getSettingsContainer()
        : document.querySelector(".game-menu_settingsContainer__NeJu2");
      if (settingsContainer && settingsContainer.offsetParent !== null) {
        GG.createGhostMarkerSettings();
      }
    };

    let checkTimer = null;
    const scheduleCheck = () => {
      if (checkTimer) return;
      checkTimer = setTimeout(() => {
        checkTimer = null;
        checkAndCreate();
      }, 20);
    };

    checkAndCreate();

    const observer = new MutationObserver(function () {
      scheduleCheck();
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["style"],
    });
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", GG.initialize);
  } else {
    GG.initialize();
  }
})();


