
import { createSlider, createColorPicker } from './components.js';

const GG = window.GhostGuessr;

export const buildScorePredictorSettings = () => {
    const container = document.createElement("div");
    container.className = "gg-score-predictor-settings";
    container.style.cssText = "margin-top: 16px;";

    const displayModeContainer = document.createElement("div");
    displayModeContainer.id = "gg-display-mode-section";
    displayModeContainer.className = "game-menu_compassContainer__ESwVy";
    if (!GG.settings.showScorePredictor) {
      displayModeContainer.style.display = "none";
    }

    const subHeader = document.createElement("p");
    subHeader.className = "game-menu_subHeader__Ul5Vl";
    subHeader.textContent = "Display Mode";
    displayModeContainer.appendChild(subHeader);

    const switchContainer = document.createElement("div");
    switchContainer.className = "compass-switch_container__UteW2";

    const icon = document.createElement("img");
    icon.alt = "Display Mode";
    icon.loading = "lazy";
    icon.width = 25;
    icon.height = 24;
    icon.decoding = "async";
    icon.setAttribute("data-nimg", "1");
    icon.className = "compass-switch_compassIcon__n9OoQ";
    icon.style.color = "transparent";
    icon.src = "data:image/svg+xml," + encodeURIComponent(`
      <svg width="25" height="24" viewBox="0 0 25 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="12.5" cy="12" r="9" stroke="#ffffff" stroke-width="2" fill="none"/>
        <text x="12.5" y="15" text-anchor="middle" font-size="7" fill="#ffffff" font-weight="bold">5K</text>
      </svg>
    `);
    switchContainer.appendChild(icon);

    const switchWrapper = document.createElement("div");
    switchWrapper.className = "switch_switch__ie6MF switch_horizontal__KO_Qe";

    const options = [
      { value: "both", label: "Both" },
      { value: "score", label: "Score" },
      { value: "distance", label: "Distance" },
    ];

    options.forEach((opt) => {
      const switchItem = document.createElement("div");
      switchItem.className = "switch_switchItem__LQpWl";

      const background = document.createElement("div");
      const isSelected = GG.settings.scorePredictorDisplay === opt.value;
      background.className = "switch_background__M2QFN " + (isSelected ? "switch_show__V6W5T" : "switch_hide__KyksT");

      const label = document.createElement("label");
      label.className = "switch_label__KrnMF";
      label.setAttribute("aria-selected", isSelected ? "true" : "false");
      label.textContent = opt.label;

      switchItem.appendChild(background);
      switchItem.appendChild(label);

      switchItem.addEventListener("click", () => {
        GG.settings.scorePredictorDisplay = opt.value;
        GG.saveSettings();

        switchWrapper.querySelectorAll(".switch_switchItem__LQpWl").forEach((item, i) => {
          const bg = item.querySelector(".switch_background__M2QFN");
          const lbl = item.querySelector(".switch_label__KrnMF");
          const selected = options[i].value === opt.value;
          bg.className = "switch_background__M2QFN " + (selected ? "switch_show__V6W5T" : "switch_hide__KyksT");
          lbl.setAttribute("aria-selected", selected ? "true" : "false");
        });
      });

      switchWrapper.appendChild(switchItem);
    });

    switchContainer.appendChild(switchWrapper);
    displayModeContainer.appendChild(switchContainer);
    container.appendChild(displayModeContainer);

    const createNativeToggle = (labelTextStr, settingKey, iconSvg, onChange) => {
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
        if (typeof onChange === "function") {
          onChange(checkbox.checked);
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

    container.appendChild(createNativeToggle("Connection Line (Beta)", "showConnectionLine",
      `<svg width="25" height="25" viewBox="0 0 25 25" fill="none" xmlns="http://www.w3.org/2000/svg">
        <line x1="5" y1="20" x2="20" y2="5" stroke="#ffffff" stroke-width="2" stroke-linecap="round"/>
        <circle cx="5" cy="20" r="3" stroke="#ffffff" stroke-width="2" fill="none"/>
        <circle cx="20" cy="5" r="3" stroke="#ffffff" stroke-width="2" fill="none"/>
      </svg>`,
      (checked) => {
        if (!checked && typeof GG.updateConnectionLine === 'function') {
          GG.updateConnectionLine(null, null);
        } else if (checked && typeof GG.checkScorePredictor === 'function') {
          setTimeout(() => GG.checkScorePredictor(), 100);
        }
      }
    ));

    const streetviewMarkerToggle = createNativeToggle("Streetview Marker", "showStreetviewMarker",
      `<svg width="25" height="25" viewBox="0 0 25 25" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="12.5" cy="12.5" r="6" stroke="#ffffff" stroke-width="2" fill="none"/>
      </svg>`,
      (checked) => {
        const section = document.getElementById("gg-streetview-marker-section");
        if (section) {
          section.style.display = checked ? "block" : "none";
        }
      }
    );
    streetviewMarkerToggle.id = "gg-streetview-marker-toggle";
    container.appendChild(streetviewMarkerToggle);

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

      colorFlexContainer.appendChild(createColorPicker("Color", colorKey));
      colorFlexContainer.appendChild(createColorPicker("Outline", outlineKey));
      section.appendChild(colorFlexContainer);

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
    
    const streetviewMarkerSection = createMarkerSection("Streetview Marker", "#3B82F6", "streetviewMarkerColor", "streetviewMarkerOutline", "streetviewMarkerSize", 3, 15, "streetviewMarkerOutlineWidth", "streetviewMarkerOpacity");
    streetviewMarkerSection.id = "gg-streetview-marker-section";
    if (!GG.settings.showStreetviewMarker) {
      streetviewMarkerSection.style.display = "none";
    }
    container.appendChild(streetviewMarkerSection);

    return container;
};
