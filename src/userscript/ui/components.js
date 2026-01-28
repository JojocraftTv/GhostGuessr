const GG = window.GhostGuessr;

export const createSvg = (color) => {
  return `
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style="color: transparent;">
        <circle cx="12" cy="12" r="8" fill="currentColor" stroke="white" stroke-width="2"/>
        <circle cx="12" cy="12" r="6" fill="${color}"/>
    </svg>
  `;
};

export const createSlider = (labelText, settingKey, min, max, step, unit, iconFn) => {
    const sliderContainer = document.createElement("div");
    sliderContainer.className = "slider-option_wrapper__3gsTQ";
    sliderContainer.style.cssText = "margin-bottom: 16px; display: flex; align-items: center; gap: 12px;";

    const icon = document.createElement("div");
    icon.className = "slider-option_icon__qtnY8";
    icon.style.cssText = "flex-shrink: 0; width: 24px; height: 24px; display: flex; align-items: center; justify-content: center;";
    if (typeof iconFn === 'function') {
         icon.innerHTML = iconFn(GG.settings[settingKey]);
    } else {
         icon.innerHTML = iconFn || ''; 
    }

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
      
      if (typeof iconFn === 'function') {
        icon.innerHTML = iconFn(settingsValue);
      }
      
      GG.saveSettings();
      if (typeof GG.updateMarkerStyle === 'function') GG.updateMarkerStyle();
      if (typeof GG.updateStreetviewMarkerStyle === 'function') GG.updateStreetviewMarkerStyle();
      if (typeof GG.updateSafetyOutlineStyle === 'function') GG.updateSafetyOutlineStyle();
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

export const createColorPicker = (label, settingKey, colorKey, outlineKey, h3) => {
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
      
      if (h3 && settingKey === colorKey) {
        h3.style.color = this.value;
      }

      GG.saveSettings();
      if (typeof GG.updateMarkerStyle === 'function') GG.updateMarkerStyle();
      if (typeof GG.updateStreetviewMarkerStyle === 'function') GG.updateStreetviewMarkerStyle();
      if (typeof GG.updateSafetyOutlineStyle === 'function') GG.updateSafetyOutlineStyle();
    });

    colorInputContainer.appendChild(colorPreview);
    colorInputContainer.appendChild(colorInput);
    colorContainer.appendChild(colorLabel);
    colorContainer.appendChild(colorInputContainer);
    colorContainer.appendChild(colorHex);

    return colorContainer;
};

export const createToggle = (labelTextStr, settingKey, iconSvg, onChange) => {
    const toggleContainer = document.createElement("div");
    toggleContainer.className = "game-menu_optionsContainer__Eafrd ghostguessr-setting";
    toggleContainer.style.transform = "translateX(-2px)";
    toggleContainer.style.marginLeft = "-2px";
    toggleContainer.style.marginBottom = "8px";

    const option = document.createElement("label");
    option.className = "game-options_option__xQZVa game-options_editableOption__0hL4c";
    option.style.cssText = `
        width: 100%;
        display: flex;
        align-items: center;
        justify-content: space-between;
        cursor: pointer;
    `;
    
    const labelWrap = document.createElement("div");
    labelWrap.className = "game-menu_imgAndLabelWrapper__tHcGz";
    labelWrap.style.cssText = "display: flex; align-items: center; gap: 10px;";

    if (iconSvg) {
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
        labelWrap.appendChild(icon);
    }

    const labelText = document.createElement("div");
    labelText.className = "game-options_optionLabel__Vk5xN";
    labelText.style.cssText = "font-size: 14px; color: #fff; font-weight: 600;";
    labelText.textContent = labelTextStr;
    labelWrap.appendChild(labelText);

    const inputWrap = document.createElement("div");
    inputWrap.className = "game-options_optionInput__paPBZ";
    inputWrap.style.cssText = "margin-left: auto;";

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.className = "toggle_toggle__qfXpL";
    checkbox.checked = GG.settings[settingKey] !== false;
    if (GG.settings[settingKey] === undefined) {
    }
    checkbox.checked = Boolean(GG.settings[settingKey]);

    checkbox.addEventListener("change", function () {
      GG.settings[settingKey] = checkbox.checked;
      GG.saveSettings();
      if (typeof onChange === "function") {
        onChange(checkbox.checked);
      }
    });

    inputWrap.appendChild(checkbox);
    option.appendChild(labelWrap);
    option.appendChild(inputWrap);
    toggleContainer.appendChild(option);

    return toggleContainer;
};
