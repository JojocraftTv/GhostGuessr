(function () {
  "use strict";

  const GG = window.GhostGuessr;

  const hasClassPrefix = (element, prefix) => {
    if (!element) return false;
    return Array.from(element.classList).some((name) =>
      name.startsWith(prefix),
    );
  };

  const getClassByPrefix = (element, prefix) => {
    if (!element) return null;
    return Array.from(element.classList).find((name) =>
      name.startsWith(prefix),
    );
  };

  const buildAutoClaimToggle = () => {
    if (GG.isElectron || GG.isSteam) return;
    const toggleContainer = document.createElement("div");
    toggleContainer.className = "game-menu_optionsContainer__Eafrd";
    toggleContainer.style.transform = "translateX(-2px)";
    toggleContainer.style.marginLeft = "-2px";

    const option = document.createElement("label");
    option.className =
      "game-options_option__xQZVa game-options_editableOption__0hL4c";
    option.style.cssText = `
        width: 400px;
        max-width: 400px;
        min-width: 400px;
        display: flex;
        align-items: center;
        justify-content: space-between;
    `;

    const labelWrap = document.createElement("div");
    labelWrap.className = "game-menu_imgAndLabelWrapper__tHcGz";

    const icon = document.createElement("img");
    icon.alt = "";
    icon.loading = "lazy";
    icon.width = 25;
    icon.height = 25;
    icon.decoding = "async";
    icon.setAttribute("data-nimg", "1");
    icon.className = "game-menu_fullscreenIcon__agaGg";
    icon.style.color = "transparent";

    icon.src =
      "data:image/svg+xml," +
      encodeURIComponent(
        `<svg width="25" height="25" viewBox="0 0 25 25" fill="none" xmlns="http://www.w3.org/2000/svg">
          <circle cx="12.5" cy="12.5" r="9" fill="#8b5cf6"/>
          <path d="M9.5 12.5L11.5 14.5L15.5 10.5" stroke="#ffffff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>`,
      );

    const labelText = document.createElement("div");
    labelText.className = "game-options_optionLabel__Vk5xN";
    labelText.textContent = "Auto Claim Rewards";

    const inputWrap = document.createElement("div");
    inputWrap.className = "game-options_optionInput__paPBZ";

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.className = "toggle_toggle__qfXpL";
    checkbox.checked = Boolean(GG.settings.autoClaimRewards);

    const updateToggleVisuals = () => {
      labelText.textContent = "Auto Claim Rewards";
    };

    updateToggleVisuals();

    checkbox.addEventListener("change", function () {
      GG.settings.autoClaimRewards = checkbox.checked;
      GG.saveSettings();
      updateToggleVisuals();
      if (GG.settings.autoClaimRewards && GG.tryRewardClaims) {
        GG.tryRewardClaims();
      }
    });

    labelWrap.appendChild(icon);
    labelWrap.appendChild(labelText);
    inputWrap.appendChild(checkbox);
    option.appendChild(labelWrap);
    option.appendChild(inputWrap);

    toggleContainer.appendChild(option);

    return toggleContainer;
  };

  const createScorePredictorToggle = () => {
    const toggleContainer = document.createElement("div");
    toggleContainer.className = "game-menu_optionsContainer__Eafrd";
    toggleContainer.style.transform = "translateX(-2px)";
    toggleContainer.style.marginLeft = "-2px";

    const option = document.createElement("label");
    option.className =
      "game-options_option__xQZVa game-options_editableOption__0hL4c";
    option.style.cssText = `
        width: 400px;
        max-width: 400px;
        min-width: 400px;
        display: flex;
        align-items: center;
        justify-content: space-between;
    `;

    const labelWrap = document.createElement("div");
    labelWrap.className = "game-menu_imgAndLabelWrapper__tHcGz";

    const icon = document.createElement("img");
    icon.alt = "";
    icon.loading = "lazy";
    icon.width = 25;
    icon.height = 25;
    icon.decoding = "async";
    icon.setAttribute("data-nimg", "1");
    icon.className = "game-menu_fullscreenIcon__agaGg";
    icon.style.color = "transparent";

    icon.src =
      "data:image/svg+xml," +
      encodeURIComponent(
        `<svg width="25" height="25" viewBox="0 0 25 25" fill="none" xmlns="http://www.w3.org/2000/svg">
          <circle cx="12.5" cy="12.5" r="10" stroke="#8b5cf6" stroke-width="2" fill="none"/>
          <text x="12.5" y="17" text-anchor="middle" font-size="11" fill="#8b5cf6" font-weight="bold">5K</text>
        </svg>`,
      );

    const labelText = document.createElement("div");
    labelText.className = "game-options_optionLabel__Vk5xN";
    labelText.textContent = "Score Predictor (Beta)";

    const inputWrap = document.createElement("div");
    inputWrap.className = "game-options_optionInput__paPBZ";

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.className = "toggle_toggle__qfXpL";
    checkbox.checked = Boolean(GG.settings.showScorePredictor);

    checkbox.addEventListener("change", function () {
      GG.settings.showScorePredictor = checkbox.checked;
      GG.saveSettings();
      if (!checkbox.checked) {
        const predictor = document.getElementById('gg-score-predictor');
        if (predictor) predictor.style.display = 'none';
      }
    });

    labelWrap.appendChild(icon);
    labelWrap.appendChild(labelText);
    inputWrap.appendChild(checkbox);
    option.appendChild(labelWrap);
    option.appendChild(inputWrap);

    toggleContainer.appendChild(option);

    return toggleContainer;
  };

  const buildScorePredictorSettings = () => {
    const container = document.createElement("div");
    container.className = "gg-score-predictor-settings";
    container.style.cssText = "margin-top: 16px;";

    const displayModeContainer = document.createElement("div");
    displayModeContainer.className = "slider-option_wrapper__3gsTQ";
    displayModeContainer.style.cssText = "margin-bottom: 16px; display: flex; align-items: center; gap: 12px;";

    const displayModeIcon = document.createElement("div");
    displayModeIcon.className = "slider-option_icon__qtnY8";
    displayModeIcon.style.cssText = "flex-shrink: 0; width: 24px; height: 24px;";
    displayModeIcon.innerHTML = `
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="12" cy="12" r="9" stroke="#8b5cf6" stroke-width="2" fill="none"/>
        <text x="12" y="16" text-anchor="middle" font-size="9" fill="#8b5cf6" font-weight="bold">5K</text>
      </svg>
    `;

    const displayModeLabel = document.createElement("div");
    displayModeLabel.className = "slider-option_label__HSXrJ";
    displayModeLabel.style.cssText = "flex: 1; font-size: 14px; color: #fff;";
    displayModeLabel.textContent = "Display Mode";

    const displayModeValue = document.createElement("div");
    displayModeValue.className = "slider-option_value__OM__C";
    displayModeValue.style.cssText = "flex-shrink: 0;";

    const displayModeSelect = document.createElement("select");
    displayModeSelect.style.cssText = `
      width: 140px;
      height: 32px;
      background: rgba(255, 255, 255, 0.1);
      border: 1px solid #8b5cf6;
      border-radius: 6px;
      color: #fff;
      padding: 0 8px;
      font-size: 14px;
      cursor: pointer;
      outline: none;
    `;

    [
      { value: "both", label: "Score + Distance" },
      { value: "score", label: "Score Only" },
      { value: "distance", label: "Distance Only" },
    ].forEach(opt => {
      const optionEl = document.createElement("option");
      optionEl.value = opt.value;
      optionEl.textContent = opt.label;
      optionEl.style.background = "#1a1a2e";
      if (GG.settings.scorePredictorDisplay === opt.value) {
        optionEl.selected = true;
      }
      displayModeSelect.appendChild(optionEl);
    });

    displayModeSelect.addEventListener("change", function () {
      GG.settings.scorePredictorDisplay = this.value;
      GG.saveSettings();
    });

    displayModeValue.appendChild(displayModeSelect);
    displayModeContainer.appendChild(displayModeIcon);
    displayModeContainer.appendChild(displayModeLabel);
    displayModeContainer.appendChild(displayModeValue);
    container.appendChild(displayModeContainer);

    const createNativeToggle = (labelTextStr, settingKey, iconSvg) => {
        const toggleContainer = document.createElement("div");
        toggleContainer.className = "game-menu_optionsContainer__Eafrd";
        toggleContainer.style.transform = "translateX(-2px)";
        toggleContainer.style.marginLeft = "-2px";
    
        const option = document.createElement("label");
        option.className = "game-options_option__xQZVa game-options_editableOption__0hL4c";
        option.style.cssText = `
            width: 100%;
            display: flex;
            align-items: center;
            justify-content: space-between;
        `;

      const labelWrap = document.createElement("div");
      labelWrap.className = "game-menu_imgAndLabelWrapper__tHcGz";
      labelWrap.style.cssText = "display: flex; align-items: center; gap: 10px;";

      const icon = document.createElement("img");
      icon.alt = "";
      icon.loading = "lazy";
      icon.width = 25;
      icon.height = 25;
      icon.decoding = "async";
      icon.setAttribute("data-nimg", "1");
      icon.className = "game-menu_fullscreenIcon__agaGg";
      icon.style.cssText = "color: transparent; flex-shrink: 0;";
      icon.src = "data:image/svg+xml," + encodeURIComponent(iconSvg);

      const labelText = document.createElement("div");
      labelText.className = "game-options_optionLabel__Vk5xN";
      labelText.style.cssText = "font-size: 14px; color: #fff;";
      labelText.textContent = labelTextStr;

      const inputWrap = document.createElement("div");
      inputWrap.className = "game-options_optionInput__paPBZ";
      inputWrap.style.cssText = "margin-left: auto;";

      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.className = "toggle_toggle__qfXpL";
      checkbox.checked = Boolean(GG.settings[settingKey]);

      checkbox.addEventListener("change", function () {
        GG.settings[settingKey] = checkbox.checked;
        GG.saveSettings();
      });

      labelWrap.appendChild(icon);
      labelWrap.appendChild(labelText);
      inputWrap.appendChild(checkbox);
      option.appendChild(labelWrap);
      option.appendChild(inputWrap);
      toggleContainer.appendChild(option);

      return toggleContainer;
    };

    container.appendChild(createNativeToggle("Connection Line (Beta)", "showConnectionLine",
      `<svg width="25" height="25" viewBox="0 0 25 25" fill="none" xmlns="http://www.w3.org/2000/svg">
        <line x1="5" y1="20" x2="20" y2="5" stroke="#8b5cf6" stroke-width="2" stroke-linecap="round"/>
        <circle cx="5" cy="20" r="3" fill="#8b5cf6"/>
        <circle cx="20" cy="5" r="3" fill="#8b5cf6"/>
      </svg>`
    ));

    container.appendChild(createNativeToggle("Streetview Marker", "showStreetviewMarker",
      `<svg width="25" height="25" viewBox="0 0 25 25" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="12.5" cy="12.5" r="6" fill="#3B82F6" stroke="#FFFFFF" stroke-width="2"/>
      </svg>`
    ));

    const createMarkerSection = (title, titleColor, colorKey, outlineKey, sizeKey, sizeMin, sizeMax, outlineWidthKey, opacityKey) => {
      const section = document.createElement("div");
      section.style.cssText = "margin-top: 16px;";

      const sectionTitle = document.createElement("div");
      sectionTitle.className = "section_sectionHeader___QLJB section_sizeMedium__CuXRP section_variantLight__G_gsY";
      sectionTitle.style.cssText = "margin-bottom: 12px;";

      const barsRoot = document.createElement("div");
      barsRoot.className = "bars_root__tryg2 bars_variantLight__r_x6H";
      barsRoot.style.cssText = "display: flex; align-items: center; gap: 12px;";

      const barsContent = document.createElement("span");
      barsContent.className = "bars_content__Nw_TD";
      barsContent.style.cssText = "flex-shrink: 0;";

      const h3 = document.createElement("h3");
      h3.textContent = title;
      h3.style.cssText = `font-size: 14px; color: ${GG.settings[colorKey]}; font-weight: 600;`;
      barsContent.appendChild(h3);

      const barsAfter = document.createElement("div");
      barsAfter.className = "bars_after__50_BW";
      barsAfter.style.cssText = "flex: 1; height: 1px; background: rgba(255, 255, 255, 0.1);";

      barsRoot.appendChild(barsContent);
      barsRoot.appendChild(barsAfter);
      sectionTitle.appendChild(barsRoot);
      section.appendChild(sectionTitle);

      const colorFlexContainer = document.createElement("div");
      colorFlexContainer.className = "flex_flex__Rxtgm flex_direction__Fa3Gs flex_gap__sXfgm flex_justify__2rGZO flex_align__PRoee";
      colorFlexContainer.style.cssText = "display: flex; flex-direction: row; gap: 16px; justify-content: space-between; align-items: center; margin-bottom: 16px;";

      const createColorPicker = (label, settingKey) => {
        const colorContainer = document.createElement("div");
        colorContainer.className = "flex_flex__Rxtgm flex_direction__Fa3Gs flex_gap__sXfgm flex_justify__2rGZO flex_align__PRoee";
        colorContainer.style.cssText = "display: flex; flex-direction: column; gap: 4px; justify-content: flex-start; align-items: stretch; flex: 1;";

        const colorLabel = document.createElement("label");
        colorLabel.className = "label_label__9xkbh shared_white60Variant__EC173 shared_boldWeight__U2puG label_italic__LM62Y";
        colorLabel.style.cssText = "font-size: 14px; line-height: 1.4; color: rgba(255, 255, 255, 0.6); font-weight: 600; font-style: italic;";
        colorLabel.textContent = label;

        const colorInputContainer = document.createElement("div");
        colorInputContainer.className = "flex_flex__Rxtgm flex_direction__Fa3Gs flex_gap__sXfgm flex_justify__2rGZO flex_align__PRoee";
        colorInputContainer.style.cssText = "display: flex; flex-direction: row; gap: 8px; justify-content: flex-start; align-items: center; position: relative;";

        const colorPreview = document.createElement("div");
        colorPreview.style.cssText = `
          width: 32px;
          height: 32px;
          border-radius: 4px;
          background: ${GG.settings[settingKey]};
          border: 2px solid rgba(255, 255, 255, 0.2);
          cursor: pointer;
        `;

        const colorInput = document.createElement("input");
        colorInput.type = "color";
        colorInput.value = GG.settings[settingKey];
        colorInput.style.cssText = `
          width: 32px;
          height: 32px;
          opacity: 0;
          position: absolute;
          cursor: pointer;
        `;

        const colorHex = document.createElement("label");
        colorHex.className = "label_label__9xkbh shared_boldWeight__U2puG label_italic__LM62Y";
        colorHex.style.cssText = "font-size: 14px; line-height: 1.4; font-weight: 600; font-style: italic; min-width: 70px; color: #fff;";
        colorHex.textContent = GG.settings[settingKey];

        colorInput.addEventListener("input", function () {
          GG.settings[settingKey] = this.value;
          colorPreview.style.background = this.value;
          colorHex.textContent = this.value;
          if (settingKey === colorKey) {
            h3.style.color = this.value;
          }
          GG.saveSettings();
          if (typeof GG.updateMarkerStyle === 'function') GG.updateMarkerStyle();
          if (typeof GG.updateStreetviewMarkerStyle === 'function') GG.updateStreetviewMarkerStyle();
        });

        colorInputContainer.appendChild(colorPreview);
        colorInputContainer.appendChild(colorInput);
        colorContainer.appendChild(colorLabel);
        colorContainer.appendChild(colorInputContainer);
        colorContainer.appendChild(colorHex);

        return colorContainer;
      };

      colorFlexContainer.appendChild(createColorPicker("Color", colorKey));
      colorFlexContainer.appendChild(createColorPicker("Outline", outlineKey));
      section.appendChild(colorFlexContainer);

      const createSlider = (labelText, settingKey, min, max, step, unit, iconFn) => {
        const sliderContainer = document.createElement("div");
        sliderContainer.className = "slider-option_wrapper__3gsTQ";
        sliderContainer.style.cssText = "margin-bottom: 16px; display: flex; align-items: center; gap: 12px;";

        const icon = document.createElement("div");
        icon.className = "slider-option_icon__qtnY8";
        icon.style.cssText = "flex-shrink: 0; width: 24px; height: 24px;";
        icon.innerHTML = iconFn(GG.settings[settingKey]);

        const label = document.createElement("div");
        label.className = "slider-option_label__HSXrJ";
        label.style.cssText = "flex: 1; font-size: 14px; color: #fff;";
        label.textContent = labelText;

        const valueContainer = document.createElement("form");
        valueContainer.className = "slider-option_value__OM__C";
        valueContainer.style.cssText = "flex-shrink: 0; min-width: 40px; text-align: right;";

        const valueLabel = document.createElement("div");
        valueLabel.className = "slider-option_valueLabel__XS837";
        valueLabel.style.cssText = "font-size: 14px; color: #fff;";
        const displayVal = unit === "%" ? Math.round(GG.settings[settingKey] * 100) : (step < 1 ? GG.settings[settingKey].toFixed(1) : GG.settings[settingKey]);
        valueLabel.textContent = `${displayVal}${unit}`;

        valueContainer.appendChild(valueLabel);

        const sliderWrapper = document.createElement("div");
        sliderWrapper.className = "slider-option_slider__kJaCT";
        sliderWrapper.style.cssText = "flex: 1; max-width: 150px;";

        const slider = document.createElement("div");
        slider.className = "styles_rangeslider__8vVg3 styles_variantPurple__1s1cU";
        slider.style.cssText = "position: relative; width: 100%; height: 8px; background: rgba(255, 255, 255, 0.2); border-radius: 4px; cursor: pointer;";

        const currentVal = unit === "%" ? GG.settings[settingKey] * 100 : GG.settings[settingKey];
        const effectiveMin = unit === "%" ? min * 100 : min;
        const effectiveMax = unit === "%" ? max * 100 : max;

        const fill = document.createElement("div");
        fill.className = "styles_fill__9MeZ9";
        fill.style.cssText = `position: absolute; left: 0; top: 0; height: 100%; background: #8b5cf6; border-radius: 4px; width: ${((currentVal - effectiveMin) / (effectiveMax - effectiveMin)) * 100}%;`;

        const handle = document.createElement("div");
        handle.className = "styles_handle__h9ytQ";
        handle.tabIndex = 0;
        handle.style.cssText = `position: absolute; top: 50%; transform: translateY(-50%); width: 16px; height: 16px; background: #fff; border-radius: 50%; border: 2px solid #8b5cf6; cursor: grab; left: ${((currentVal - effectiveMin) / (effectiveMax - effectiveMin)) * 100}%;`;
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
          let newValue = effectiveMin + (effectiveMax - effectiveMin) * percent;
          const effectiveStep = unit === "%" ? step * 100 : step;
          const stepped = effectiveStep ? Math.round(newValue / effectiveStep) * effectiveStep : newValue;
          const clamped = Math.max(effectiveMin, Math.min(stepped, effectiveMax));

          fill.style.width = `${((clamped - effectiveMin) / (effectiveMax - effectiveMin)) * 100}%`;
          handle.style.left = `${((clamped - effectiveMin) / (effectiveMax - effectiveMin)) * 100}%`;
          
          const displayValue = unit === "%" ? Math.round(clamped) : (step < 1 ? clamped.toFixed(1) : Math.round(clamped));
          valueLabel.textContent = `${displayValue}${unit}`;

          const settingsValue = unit === "%" ? clamped / 100 : clamped;
          GG.settings[settingKey] = settingsValue;
          icon.innerHTML = iconFn(settingsValue);
          GG.saveSettings();
          if (typeof GG.updateMarkerStyle === 'function') GG.updateMarkerStyle();
          if (typeof GG.updateStreetviewMarkerStyle === 'function') GG.updateStreetviewMarkerStyle();
        };

        handle.addEventListener("mousedown", (e) => {
          e.preventDefault();
          isDragging = true;
          const onMouseMove = (e) => { if (isDragging) updateFromEvent(e); };
          const onMouseUp = () => {
            isDragging = false;
            document.removeEventListener("mousemove", onMouseMove);
            document.removeEventListener("mouseup", onMouseUp);
          };
          document.addEventListener("mousemove", onMouseMove);
          document.addEventListener("mouseup", onMouseUp);
        });

        slider.addEventListener("click", (e) => { if (!isDragging) updateFromEvent(e); });

        return sliderContainer;
      };

      section.appendChild(createSlider("Size", sizeKey, sizeMin, sizeMax, 1, "", (val) => `
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <circle cx="12" cy="12" r="${val / 2}" fill="${GG.settings[colorKey]}" stroke="${GG.settings[outlineKey]}" stroke-width="2"/>
        </svg>
      `));

      section.appendChild(createSlider("Outline Width", outlineWidthKey, 0.5, 5, 0.1, "px", (val) => `
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <circle cx="12" cy="12" r="8" fill="none" stroke="${GG.settings[outlineKey]}" stroke-width="${val}"/>
        </svg>
      `));

      section.appendChild(createSlider("Transparency", opacityKey, 0, 1, 0.01, "%", (val) => `
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <circle cx="12" cy="12" r="8" fill="${GG.settings[colorKey]}" fill-opacity="${val}" stroke="${GG.settings[outlineKey]}" stroke-width="2"/>
        </svg>
      `));

      return section;
    };

    container.appendChild(createMarkerSection("Ghost Marker", "#FF0000", "markerColor", "outlineColor", "size", 5, 20, "outlineWidth", "opacity"));
    container.appendChild(createMarkerSection("Streetview Marker", "#3B82F6", "streetviewMarkerColor", "streetviewMarkerOutline", "streetviewMarkerSize", 3, 15, "streetviewMarkerOutlineWidth", "streetviewMarkerOpacity"));

    return container;
  };

  const buildStreamerModeToggle = () => {
    if (GG.isElectron || GG.isSteam) return null;
    
    const toggleContainer = document.createElement("div");
    toggleContainer.className = "game-menu_optionsContainer__Eafrd";
    toggleContainer.style.transform = "translateX(-2px)";
    toggleContainer.style.marginLeft = "-2px";

    const option = document.createElement("label");
    option.className =
      "game-options_option__xQZVa game-options_editableOption__0hL4c";
    option.style.cssText = `
        width: 400px;
        max-width: 400px;
        min-width: 400px;
        display: flex;
        align-items: center;
        justify-content: space-between;
    `;

    const labelWrap = document.createElement("div");
    labelWrap.className = "game-menu_imgAndLabelWrapper__tHcGz";

    const icon = document.createElement("img");
    icon.alt = "";
    icon.loading = "lazy";
    icon.width = 25;
    icon.height = 25;
    icon.decoding = "async";
    icon.setAttribute("data-nimg", "1");
    icon.className = "game-menu_fullscreenIcon__agaGg";
    icon.style.color = "transparent";

    icon.src =
      "data:image/svg+xml," +
      encodeURIComponent(
        `<svg width="25" height="25" viewBox="0 0 25 25" fill="none" xmlns="http://www.w3.org/2000/svg">
          <circle cx="12.5" cy="12.5" r="9" fill="#8b5cf6"/>
          <path d="M8 12.5h3m3 0h3m-6-3v6" stroke="#ffffff" stroke-width="2" stroke-linecap="round"/>
        </svg>`,
      );

    const labelText = document.createElement("div");
    labelText.className = "game-options_optionLabel__Vk5xN";
    labelText.textContent = "Streamer Mode (WIP)";

    const inputWrap = document.createElement("div");
    inputWrap.className = "game-options_optionInput__paPBZ";

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.className = "toggle_toggle__qfXpL";
    checkbox.checked = Boolean(GG.settings.streamerMode);

    checkbox.addEventListener("change", function () {
      GG.settings.streamerMode = checkbox.checked;
      GG.saveSettings();
      if (typeof GG.applyStreamerMode === "function") {
        GG.applyStreamerMode();
      }
    });

    labelWrap.appendChild(icon);
    labelWrap.appendChild(labelText);
    inputWrap.appendChild(checkbox);
    option.appendChild(labelWrap);
    option.appendChild(inputWrap);

    toggleContainer.appendChild(option);

    return toggleContainer;
  };

  GG.showUpdateNotification = function(newHash) {
    if (document.getElementById('gg-update-banner')) return;
    
    if (!document.body) {
        setTimeout(() => GG.showUpdateNotification(newHash), 500);
        return;
    }

    const banner = document.createElement('div');
    banner.id = 'gg-update-banner';
    banner.style.cssText = `
      position: fixed;
      top: 20px;
      left: 20px;
      right: auto;
      width: auto;
      max-width: 400px;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      padding: 16px;
      display: flex;
      flex-direction: column;
      align-items: flex-start;
      gap: 12px;
      z-index: 2147483647;
      box-shadow: 0 8px 32px rgba(0,0,0,0.4);
      font-family: 'Neo Sans', sans-serif;
      animation: slideDown 0.3s ease-out;
      border-radius: 12px;
      pointer-events: auto;
      border: 1px solid rgba(255,255,255,0.1);
    `;

    const style = document.createElement('style');
    style.textContent = `
      @keyframes slideDown {
        from { transform: translateY(-100%); }
        to { transform: translateY(0); }
      }
    `;
    document.head.appendChild(style);

    const leftContent = document.createElement('div');
    leftContent.style.cssText = 'display: flex; align-items: center; gap: 12px;';

    const icon = document.createElement('div');
    icon.innerHTML = `
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M12 16L12 8" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        <path d="M9 13L12 16L15 13" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        <path d="M17 21H7C5.89543 21 5 20.1046 5 19V5C5 3.89543 5.89543 3 7 3H12.5" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        <circle cx="18" cy="5" r="3" fill="#3bf7bf" stroke="none"/>
      </svg>
    `;
    icon.style.display = 'flex';

    const text = document.createElement('div');
    text.innerHTML = `
      <div style="font-weight: bold; font-size: 14px;">GhostGuessr Update Available!</div>
      <div style="font-size: 12px; opacity: 0.9;">A new version is ready to download</div>
    `;

    leftContent.appendChild(icon);
    leftContent.appendChild(text);

    const rightContent = document.createElement('div');
    rightContent.style.cssText = 'display: flex; align-items: center; gap: 10px; width: 100%;';

    const viewButton = document.createElement('button');
    viewButton.textContent = 'View on GitHub';
    viewButton.style.cssText = `
      background: rgba(255,255,255,0.2);
      border: 1px solid rgba(255,255,255,0.3);
      color: white;
      padding: 8px 16px;
      border-radius: 6px;
      cursor: pointer;
      font-size: 13px;
      font-weight: 600;
      transition: all 0.2s;
      width: 100%;
      text-align: center;
    `;
    viewButton.onmouseover = () => {
      viewButton.style.background = 'rgba(255,255,255,0.3)';
    };
    viewButton.onmouseout = () => {
      viewButton.style.background = 'rgba(255,255,255,0.2)';
    };
    viewButton.onclick = () => {
      window.open(GG.GITHUB_URL, '_blank');
    };

    rightContent.appendChild(viewButton);

    banner.appendChild(leftContent);
    banner.appendChild(rightContent);

    document.body.appendChild(banner);
  };

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
      document.querySelector('[class*="duels-settings_columns__"]') ||
      document.querySelector(
        '[class*="settings_root__"] [class*="settings_container__"]',
      ) ||
      document.querySelector('[class*="settings_sectionContainer__"]') ||
      document.querySelector('[class*="game-menu_settingsContainer__"]')
    );
  };

  GG.createToggleButton = function () {
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
    svgContainer.innerHTML = GG.createSvg(
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

  GG.updateButtonState = function () {
    if (!GG.toggleButton) return;

    let svgContainer = GG.toggleButton.querySelector("div");
    if (!svgContainer) return;

    svgContainer.innerHTML = GG.createSvg(
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

  GG.createGhostMarkerSettings = function () {
    const settingsContainer = GG.getSettingsContainer();
    if (!settingsContainer) return;
    if (settingsContainer.querySelector(".ghostguessr-settings-container")) {
      return;
    }

    const isSteamSettings = hasClassPrefix(
      settingsContainer,
      "settings_container",
    );
    const isNewSettingsSection = hasClassPrefix(
      settingsContainer,
      "settings_sectionContainer",
    );

    const isDuelsLayout = hasClassPrefix(
      settingsContainer,
      "duels-settings_columns",
    );

    const useSteamSettingsStructure = isSteamSettings || isNewSettingsSection || isDuelsLayout;

    if (useSteamSettingsStructure) {
      let targetContainer = settingsContainer;
      
      if (isDuelsLayout) {
        const columnTwo = settingsContainer.querySelector('[class*="duels-settings_columnTwo__"]');
        if (columnTwo) {
            targetContainer = columnTwo;
        } else {
            const columns = settingsContainer.children;
             if (columns.length > 0) {
                 targetContainer = columns[columns.length - 1];
             }
        }
      }

      if (targetContainer) {
        if (!isDuelsLayout) { 
            settingsContainer.style.maxHeight = "80vh";
            settingsContainer.style.overflowY = "auto";
            settingsContainer.style.paddingRight = "120px";
        }
      }

      const ghostSettingsContainer = document.createElement("div");
      ghostSettingsContainer.className = "ghostguessr-settings-container";
      ghostSettingsContainer.style.cssText =
        "width: 100%; margin: 8px 0; padding: 0;";

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

      if (!GG.isElectron && !GG.isSteam) {
        const autoClaimToggle = buildAutoClaimToggle(settingsContainer);
        if (autoClaimToggle) {
          sectionContent.appendChild(autoClaimToggle);
        }
        
        const streamerModeToggle = buildStreamerModeToggle();
        if (streamerModeToggle) {
          sectionContent.appendChild(streamerModeToggle);
        }
      }

      const scorePredictorToggle = createScorePredictorToggle();
        if (scorePredictorToggle) {
          sectionContent.appendChild(scorePredictorToggle);
          const scorePredictorSettings = buildScorePredictorSettings();
          if (scorePredictorSettings) {
            sectionContent.appendChild(scorePredictorSettings);
          }
        }

      settingsSection.appendChild(sectionHeader);
      settingsSection.appendChild(sectionContent);
      ghostSettingsContainer.appendChild(settingsSection);

      const existingSections = settingsContainer.querySelectorAll(
        '[class*="settings-section_root__"]',
      );
      if (existingSections.length > 0) {
        const lastSection = existingSections[existingSections.length - 1];
        lastSection.parentNode.insertBefore(
          ghostSettingsContainer,
          lastSection.nextSibling,
        );
      } else {
        if (typeof targetContainer !== 'undefined' && targetContainer) {
            targetContainer.appendChild(ghostSettingsContainer);
        } else {
            settingsContainer.appendChild(ghostSettingsContainer);
        }
      }

      return;
    }

    document
      .querySelectorAll(".ghostguessr-setting")
      .forEach((el) => el.remove());
    const buttonsContainer = settingsContainer.querySelector(
      '[class*="buttons_buttons__"]',
    );
    const closeButton = settingsContainer.querySelector(
      'button[class*="button_button"]',
    );
    const dividers = settingsContainer.querySelectorAll(
      '[class*="game-menu_divider__"]',
    );
    const lastDivider = dividers[dividers.length - 1] || null;
    const useExistingDivider = Boolean(lastDivider);

    const ghostSettingsContainer = document.createElement("div");
    ghostSettingsContainer.className = "ghostguessr-settings-container";
    ghostSettingsContainer.style.cssText =
      "width: 100%; align-self: stretch; box-sizing: border-box; margin: 0; padding: 0;";

    if (!useExistingDivider) {
      const dividerTop = document.createElement("div");
      dividerTop.className = "game-menu_divider__IhA4t ghostguessr-setting";
      ghostSettingsContainer.appendChild(dividerTop);
    }

    const headerContainer = document.createElement("div");
    headerContainer.className =
      "game-menu_volumeContainer__aWb0Y ghostguessr-setting";

    const headerLabel = document.createElement("p");
    headerLabel.className = "game-menu_subHeader__Ul5Vl";
    headerLabel.textContent = "GhostGuessr";
    headerLabel.style.cssText = "font-size: 16px; color: #fff;";
    headerContainer.appendChild(headerLabel);

    ghostSettingsContainer.appendChild(headerContainer);

    const hotkeyContainer = document.createElement("div");
    hotkeyContainer.className =
      "game-menu_volumeContainer__aWb0Y ghostguessr-setting";

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

    GG.hotkeyInput = document.createElement("button");
    GG.hotkeyInput.textContent = GG.settings.hotkey;
    GG.hotkeyInput.style.cssText = `
            flex: 1;
            height: 36px;
            background: rgba(255, 255, 255, 0.1);
            border: 1px solid #8b5cf6;
            border-radius: 6px;
            color: #fff;
            padding: 0 10px;
            font-size: 14px;
            text-align: center;
            cursor: pointer;
            transition: all 0.2s;
        `;

    let isRecording = false;

    const endRecording = (saved) => {
        isRecording = false;
        document.removeEventListener('keydown', recordKey);
        document.removeEventListener('mousedown', checkClickOutside);
        
        GG.hotkeyInput.textContent = GG.settings.hotkey;
        GG.hotkeyInput.style.background = 'rgba(255, 255, 255, 0.1)';
        GG.hotkeyInput.style.borderColor = '#8b5cf6';
        
        if (saved) {
             hotkeyIcon.innerHTML = `
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <rect x="4" y="6" width="16" height="12" rx="2" stroke="#8b5cf6" stroke-width="2" fill="none"/>
                    <text x="12" y="15" text-anchor="middle" font-family="Arial" font-size="10" fill="#8b5cf6">${GG.settings.hotkey}</text>
                </svg>
            `;
        }
    };

    const recordKey = (e) => {
        e.preventDefault();
        e.stopPropagation();

        if (e.key === 'Escape') {
            endRecording(false);
            return;
        }

        const key = e.key.toUpperCase();
        // Allow A-Z, 0-9, Space
        if (key.length === 1 && /[A-Z0-9 ]/.test(key) || key === 'SPACE') {
             const finalKey = key === ' ' ? 'SPACE' : key;
             GG.settings.hotkey = finalKey;
             GG.saveSettings();
             GG.setupHotkeyListener();
             GG.updateButtonState();
             endRecording(true);
        }
    };

    const checkClickOutside = (e) => {
        if (e.target !== GG.hotkeyInput) {
            endRecording(false);
        }
    };

    GG.hotkeyInput.onclick = () => {
        if (isRecording) {
            endRecording(false);
            return;
        }
        
        isRecording = true;
        GG.hotkeyInput.textContent = "Press any key...";
        GG.hotkeyInput.style.background = 'rgba(139, 92, 246, 0.3)';
        GG.hotkeyInput.style.borderColor = '#fff';
        
        document.addEventListener('keydown', recordKey);
        setTimeout(() => {
             document.addEventListener('mousedown', checkClickOutside);
        }, 100);
    };

    const hotkeyHelp = document.createElement("span");
    hotkeyHelp.textContent = "Press any key";
    hotkeyHelp.style.cssText =
      "font-size: 12px; color: #888; font-style: italic; min-width: 100px;";

    hotkeyInputContainer.appendChild(hotkeyIcon);
    hotkeyInputContainer.appendChild(GG.hotkeyInput);
    hotkeyInputContainer.appendChild(hotkeyHelp);
    hotkeyContainer.appendChild(hotkeyInputContainer);
    ghostSettingsContainer.appendChild(hotkeyContainer);

    if (!GG.isElectron && !GG.isSteam) {
      const autoClaimToggle = buildAutoClaimToggle(settingsContainer);
      if (autoClaimToggle) {
        autoClaimToggle.classList.add("ghostguessr-setting");
        ghostSettingsContainer.appendChild(autoClaimToggle);
      }
      
      const streamerModeToggle = buildStreamerModeToggle();
      if (streamerModeToggle) {
        streamerModeToggle.classList.add("ghostguessr-setting");
        ghostSettingsContainer.appendChild(streamerModeToggle);
      }
      
      const scorePredictorToggle = createScorePredictorToggle();
      if (scorePredictorToggle) {
        scorePredictorToggle.classList.add("ghostguessr-setting");
        ghostSettingsContainer.appendChild(scorePredictorToggle);
        const scorePredictorSettings = buildScorePredictorSettings();
        if (scorePredictorSettings) {
          scorePredictorSettings.classList.add("ghostguessr-setting");
          ghostSettingsContainer.appendChild(scorePredictorSettings);
        }
      }
    }

    if (!useExistingDivider) {
      const dividerBottom = document.createElement("div");
      dividerBottom.className = "game-menu_divider__IhA4t ghostguessr-setting";
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

  GG.applySkinchangerHoverZ = function (host) {
    const center = host.closest('[class*="pro-user-start-page_center"]');
    const hoverCatch = center
      ? center.querySelector('[class*="pro-user-start-page_hoverCatch"]')
      : document.querySelector('[class*="pro-user-start-page_hoverCatch"]');
    if (!hoverCatch) return;
    if (hoverCatch.dataset.ggZFixed === "1") return;

    hoverCatch.style.zIndex = "5";
    hoverCatch.dataset.ggZFixed = "1";
  };

  GG.injectSkinchangerToggle = function (initialLocalSaveOnly) {
    try {
      const host = document.querySelector(
        '[class*="pro-user-start-page_globeWrapper"]',
      );
      if (!host) return;

      GG.applySkinchangerHoverZ(host);

      if (host.querySelector("[data-gg-local-save-toggle]")) return;

      const savedToggle =
        (GG.avatarStorage &&
          GG.avatarStorage.getLocalSaveOnly &&
          GG.avatarStorage.getLocalSaveOnly()) ||
        initialLocalSaveOnly ||
        false;

      const avatarContainer = host.parentElement
        ? host.parentElement.querySelector(
            '[class*="pro-user-start-page_avatarContainer"]',
          )
        : null;
      if (avatarContainer) {
        avatarContainer.style.position = "relative";
        avatarContainer.style.zIndex = "2";
      }
      host.style.position = "relative";
      host.style.zIndex = "1";

      const toggleContainer = document.createElement("div");
      toggleContainer.setAttribute("data-gg-local-save-toggle", "1");
      toggleContainer.className = "game-menu_optionsContainer__Eafrd";
      toggleContainer.style.position = "absolute";
      toggleContainer.style.left = "50%";
      toggleContainer.style.top = "50%";
      toggleContainer.style.transform = "translate(-50%, -50%)";
      toggleContainer.style.zIndex = "2";
      toggleContainer.style.width = "auto";
      toggleContainer.style.display = "inline-flex";

      const option = document.createElement("label");
      option.className =
        "game-options_option__xQZVa game-options_editableOption__0hL4c";
      option.style.cssText = `
        display: inline-flex;
        align-items: center;
        gap: 10px;
        width: auto;
      `;

      const labelWrap = document.createElement("div");
      labelWrap.className = "game-menu_imgAndLabelWrapper__tHcGz";

      const labelText = document.createElement("div");
      labelText.className = "game-options_optionLabel__Vk5xN";
      labelText.textContent = "Skinchanger (Beta)";
      labelText.style.fontSize = "16px";

      const inputWrap = document.createElement("div");
      inputWrap.className = "game-options_optionInput__paPBZ";
      inputWrap.style.marginLeft = "0";

      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.className = "toggle_toggle__qfXpL";
      checkbox.checked = !!savedToggle;

      const updateToggleVisuals = () => {
        labelText.textContent = "Skinchanger";
      };

      updateToggleVisuals();

      checkbox.addEventListener("change", () => {
        const next = !!checkbox.checked;
        if (GG.avatarStorage && GG.avatarStorage.setLocalSaveOnly) {
          GG.avatarStorage.setLocalSaveOnly(next);
        } else if (typeof GM_setValue === "function") {
          try {
            GM_setValue("gg_local_save_only_v1", next);
          } catch {}
        }
        updateToggleVisuals();
        location.reload();
      });

      labelWrap.appendChild(labelText);
      inputWrap.appendChild(checkbox);
      option.appendChild(labelWrap);
      option.appendChild(inputWrap);
      toggleContainer.appendChild(option);

      const img = host.querySelector("img");
      if (img && img.parentNode === host) {
        if (!host.style.position) host.style.position = "relative";
        img.insertAdjacentElement("afterend", toggleContainer);
      } else {
        host.appendChild(toggleContainer);
      }
    } catch {}
  };

  const _ggSkinMo = new MutationObserver(() => {
    try {
      GG.injectSkinchangerToggle();
    } catch {}
  });
  _ggSkinMo.observe(document.documentElement, {
    childList: true,
    subtree: true,
  });
})();
