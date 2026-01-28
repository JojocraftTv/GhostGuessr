
import { hasClassPrefix } from './utils.js';
import { createSlider, createColorPicker, createToggle } from './components.js';
import { buildAutoClaimToggle } from './AutoClaimToggle.js';
import { buildStreamerModeToggle } from './StreamerModeToggle.js';
import { createScorePredictorToggle } from './ScorePredictorToggle.js';
import { buildScorePredictorSettings } from './ScorePredictorSettings.js';

const GG = window.GhostGuessr;

export const getSettingsContainer = function () {
    return (
      document.querySelector('[class*="duels-settings_columns__"]') ||
      document.querySelector(
        '[class*="settings_root__"] [class*="settings_container__"]',
      ) ||
      document.querySelector('[class*="settings_sectionContainer__"]') ||
      document.querySelector('[class*="game-menu_settingsContainer__"]')
    );
};

export const createGhostMarkerSettings = function () {
    const settingsContainer = getSettingsContainer();
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

      const gameModeContainer = document.createElement("div");
      gameModeContainer.className = "slider-option_wrapper__3gsTQ";
      gameModeContainer.style.cssText = "margin-bottom: 24px; padding-bottom: 16px; border-bottom: 1px solid rgba(255,255,255,0.1);";

      const gameModeLabel = document.createElement("div");
      gameModeLabel.className = "slider-option_label__HSXrJ";
      gameModeLabel.textContent = "Modes";
      gameModeLabel.style.cssText = "margin-bottom: 12px; font-weight: 600; color: #fff;";
      
      const gameModeSelect = document.createElement("div");
      gameModeSelect.className = "flex_flex__Rxtgm flex_direction__Fa3Gs flex_gap__sXfgm";
      gameModeSelect.style.cssText = "display: flex; gap: 8px;";

      const modes = [
        { id: "normal", label: "Normal", color: "#8b5cf6", desc: "Standard GhostGuessr experience" },
        { id: "safety", label: "Safety", color: "#Green", desc: "No exact markers, only country outline" },
        { id: "risky", label: "Risky", color: "#f43f5e", desc: "Coming Soon" }
      ];

      modes.forEach(mode => {
        const btn = document.createElement("button");
        const isActive = GG.settings.gameMode === mode.id;
        
        btn.textContent = mode.label;
        btn.style.cssText = `
          flex: 1;
          padding: 8px;
          border-radius: 6px;
          border: 1px solid ${isActive ? mode.color : 'rgba(255,255,255,0.2)'};
          background: ${isActive ? mode.color + '40' : 'rgba(255,255,255,0.05)'};
          color: ${isActive ? '#fff' : 'rgba(255,255,255,0.6)'};
          cursor: pointer;
          font-weight: 600;
          transition: all 0.2s;
        `;
        
        btn.onclick = () => {
          GG.settings.gameMode = mode.id;
          
          if (mode.id === 'safety') {
             GG.settings.showStreetviewMarker = false;
             GG.settings.showConnectionLine = false;
             if (GG.connectionLine) {
                 GG.connectionLine.setMap(null);
             }
          } else {
             if (typeof GG.clearSafetyEffects === 'function') GG.clearSafetyEffects();

             GG.settings.showStreetviewMarker = true;
             GG.settings.showConnectionLine = true;
             
             if (GG.connectionLine) GG.connectionLine.setMap(GG.gmap);
             if (GG.streetviewMarker) GG.streetviewMarker.setMap(GG.gmap);
          }

          GG.saveSettings();
          
          const allBtns = gameModeSelect.children;
          Array.from(allBtns).forEach((b, i) => {
            const m = modes[i];
            const active = m.id === mode.id;
            b.style.borderColor = active ? m.color : 'rgba(255,255,255,0.2)';
            b.style.background = active ? m.color + '40' : 'rgba(255,255,255,0.05)';
            b.style.color = active ? '#fff' : 'rgba(255,255,255,0.6)';
          });
          
          if (typeof GG.updateSettingsVisibility === 'function') {
            GG.updateSettingsVisibility();
          }
          if (typeof GG.toggleMarker === 'function') {
             if (GG.settings.enabled) GG.placeMarker(); 
             else GG.toggleMarker();
          }
        };

        gameModeSelect.appendChild(btn);
      });

      gameModeContainer.appendChild(gameModeLabel);
      gameModeContainer.appendChild(gameModeSelect);
      sectionContent.appendChild(gameModeContainer);

      const dynamicSettingsContainer = document.createElement("div");
      dynamicSettingsContainer.id = "gg-dynamic-settings";
      sectionContent.appendChild(dynamicSettingsContainer);

      GG.updateSettingsVisibility = () => {
        dynamicSettingsContainer.innerHTML = "";
        const mode = GG.settings.gameMode;
        
        if (mode === "normal") {
           // Normal mode specific (currently none, as marker settings are shared but handled by logic)
           // If we had specific text or extra options for normal, they'd go here.
        } 
        
        if (mode === "risky") {
             const infoBox = document.createElement("div");
            infoBox.style.cssText = "background: rgba(244, 63, 94, 0.1); border: 1px solid rgba(244, 63, 94, 0.3); border-radius: 8px; padding: 12px; margin-bottom: 16px;";
            infoBox.innerHTML = `
                <div style="display: flex; gap: 8px; align-items: start;">
                    <div style="color: #f43f5e;">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
                    </div>
                    <div>
                        <div style="font-weight: 700; color: #f43f5e; margin-bottom: 4px;">Risky Mode</div>
                        <div style="font-size: 13px; color: #d1d5db; line-height: 1.4;">
                            Features coming soon.
                        </div>
                    </div>
                </div>
            `;
            dynamicSettingsContainer.appendChild(infoBox);
        }

        const hotkeyContainer = document.createElement("div");
        hotkeyContainer.className = "slider-option_wrapper__3gsTQ";
        hotkeyContainer.style.cssText = "margin-bottom: 20px; border-bottom: 1px solid rgba(255, 255, 255, 0.1); padding-bottom: 15px;";

        const hotkeyIcon = document.createElement("div");
        hotkeyIcon.className = "slider-option_icon__qtnY8";
        hotkeyIcon.style.cssText = "width: 35px; height: 35px; display: flex; align-items: center; justify-content: center;";
        hotkeyIcon.innerHTML = `
        <svg width="35" height="35" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect x="4" y="6" width="16" height="15" rx="2" stroke="#ffffff" stroke-width="2" fill="none"/>
            <text x="12" y="16" text-anchor="middle" dominant-baseline="middle" font-family="Arial" font-size="10" fill="#ffffff">${GG.settings.hotkey}</text>
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
            if (typeof GG.updateButtonState === 'function') GG.updateButtonState();

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
        dynamicSettingsContainer.appendChild(hotkeyContainer);

        if (!GG.isElectron && !GG.isSteam) {
            const autoClaimToggle = buildAutoClaimToggle(settingsContainer);
            if (autoClaimToggle) {
            dynamicSettingsContainer.appendChild(autoClaimToggle);
            }
            
            const streamerModeToggle = buildStreamerModeToggle();
            if (streamerModeToggle) {
            dynamicSettingsContainer.appendChild(streamerModeToggle);
            }
        }

        if (mode !== "safety") {
            const scorePredictorToggle = createScorePredictorToggle();
            if (scorePredictorToggle) {
                dynamicSettingsContainer.appendChild(scorePredictorToggle);
                const scorePredictorSettings = buildScorePredictorSettings();
                if (scorePredictorSettings) {
                dynamicSettingsContainer.appendChild(scorePredictorSettings);
                }
            }
        } else {
            const infoBox = document.createElement("div");
            infoBox.style.cssText = "background: rgba(16, 185, 129, 0.1); border: 1px solid rgba(16, 185, 129, 0.3); border-radius: 8px; padding: 12px; margin-bottom: 16px; margin-top: 16px;";
            infoBox.innerHTML = `
                <div style="display: flex; gap: 8px; align-items: start;">
                    <div style="color: #10b981;">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
                    </div>
                    <div>
                        <div style="font-weight: 700; color: #10b981; margin-bottom: 4px;">Safety Mode Active</div>
                        <div style="font-size: 13px; color: #d1d5db; line-height: 1.4;">
                            Markers disabled. Country outline enabled.
                        </div>
                    </div>
                </div>
            `;
            dynamicSettingsContainer.appendChild(infoBox);

            const targetSelect = document.createElement("div");
            targetSelect.className = "ghostguessr-setting";
            targetSelect.style.cssText = "margin-bottom: 16px; display: flex; align-items: center; justify-content: space-between; background: rgba(255,255,255,0.05); padding: 8px; border-radius: 6px;";
            
            const targetLabel = document.createElement("span");
            targetLabel.textContent = "Target Region:";
            targetLabel.style.cssText = "font-size: 13px; font-weight: 600; color: #e5e7eb;";
            targetSelect.appendChild(targetLabel);

            const toggleWrapper = document.createElement("div");
            toggleWrapper.style.cssText = "display: flex; gap: 4px; background: rgba(0,0,0,0.2); padding: 2px; border-radius: 4px;";
            
            const rOptions = [
                { id: 'country', label: 'Country' },
                { id: 'state', label: 'State' }
            ];

            const currentRegion = GG.settings.safetyModeRegion || 'country';

            rOptions.forEach(opt => {
                const rBtn = document.createElement("button");
                const isAct = currentRegion === opt.id;
                rBtn.textContent = opt.label;
                rBtn.style.cssText = `
                    padding: 4px 12px;
                    border-radius: 4px;
                    font-size: 12px;
                    font-weight: 600;
                    border: none;
                    cursor: pointer;
                    background: ${isAct ? '#10b981' : 'transparent'};
                    color: ${isAct ? '#fff' : '#9ca3af'};
                    transition: all 0.2s;
                `;
                rBtn.onclick = () => {
                    GG.settings.safetyModeRegion = opt.id;
                    GG.saveSettings();
                    if (typeof GG.updateSettingsVisibility === 'function') GG.updateSettingsVisibility();
                    if (GG.settings.enabled) GG.placeMarker();
                };
                toggleWrapper.appendChild(rBtn);
            });
            targetSelect.appendChild(toggleWrapper);
            dynamicSettingsContainer.appendChild(targetSelect);

            const detailToggle = createToggle("Detailed Outline", "safetyDetailed", `
                <svg width="25" height="25" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" stroke="#ffffff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <circle cx="12" cy="12" r="10"></circle>
                  <line x1="2" y1="12" x2="22" y2="12"></line>
                  <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path>
                </svg>
            `, (checked) => {
                 if (GG.settings.enabled) GG.placeMarker();
            });
            dynamicSettingsContainer.appendChild(detailToggle);

            const safetySettings = document.createElement("div");
            safetySettings.style.cssText = "margin-top: 10px; border-top: 1px solid rgba(255,255,255,0.1); paddingTop: 10px;";
            
            const colorContainer = createColorPicker("Outline Color", "safetyOutlineColor", "safetyOutlineColor", "safetyOutlineColor");
            const colorWrapper = document.createElement("div");
            colorWrapper.style.cssText = "display: flex; margin-bottom: 16px;";
            colorWrapper.appendChild(colorContainer);
            safetySettings.appendChild(colorWrapper);

            safetySettings.appendChild(createSlider("Outline Width", "safetyOutlineWidth", 0.5, 5, 0.1, "px", (val) => `
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <rect x="4" y="4" width="16" height="16" rx="2" fill="none" stroke="${GG.settings.safetyOutlineColor}" stroke-width="${val}"/>
                </svg>
            `));

            safetySettings.appendChild(createSlider("Fill Opacity", "safetyOutlineOpacity", 0, 1, 0.01, "%", (val) => `
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <rect x="4" y="4" width="16" height="16" rx="2" fill="${GG.settings.safetyOutlineColor}" fill-opacity="${val}" stroke="${GG.settings.safetyOutlineColor}" stroke-width="2"/>
                </svg>
            `));
            
            dynamicSettingsContainer.appendChild(safetySettings);
        }
      };

      if (typeof GG.updateSettingsVisibility === 'function') {
        GG.updateSettingsVisibility();
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

    const gameModeContainer = document.createElement("div");
    gameModeContainer.className = "game-menu_volumeContainer__aWb0Y ghostguessr-setting";
    gameModeContainer.style.cssText = "margin-bottom: 20px; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 15px;";

    const gameModeLabel = document.createElement("p");
    gameModeLabel.className = "game-menu_subHeader__Ul5Vl";
    gameModeLabel.textContent = "Modes";
    gameModeContainer.appendChild(gameModeLabel);

    const gameModeSelect = document.createElement("div");
    gameModeSelect.style.cssText = "display: flex; gap: 8px; margin-top: 10px;";

    const modes = [
        { id: "normal", label: "Normal", color: "#8b5cf6" },
        { id: "safety", label: "Safety", color: "#10b981" },
        { id: "risky", label: "Risky", color: "#f43f5e" }
    ];

    modes.forEach(mode => {
        const btn = document.createElement("button");
        const isActive = GG.settings.gameMode === mode.id;
        
        btn.textContent = mode.label;
        btn.style.cssText = `
          flex: 1;
          padding: 8px;
          border-radius: 6px;
          border: 1px solid ${isActive ? mode.color : 'rgba(255,255,255,0.2)'};
          background: ${isActive ? mode.color + '40' : 'rgba(255,255,255,0.05)'};
          color: ${isActive ? '#fff' : 'rgba(255,255,255,0.6)'};
          cursor: pointer;
          font-weight: 600;
          transition: all 0.2s;
        `;
        
        btn.onclick = () => {
          GG.settings.gameMode = mode.id;

          if (mode.id === "safety") {
              GG.settings.showStreetviewMarker = false;
              GG.settings.showConnectionLine = false;

              if (typeof GG.toggleScorePredictor === 'function' && GG.settings.showScorePredictor) {
                 if (document.getElementById('gg-score-predictor')) {
                     document.getElementById('gg-score-predictor').style.display = 'none';
                 }
              }
              if (GG.connectionLine) {
                 GG.connectionLine.setMap(null);
              }
          } else {
             if (typeof GG.clearSafetyEffects === 'function') GG.clearSafetyEffects();
             
             GG.settings.showStreetviewMarker = true;
             GG.settings.showConnectionLine = true;
             
             if (GG.connectionLine) GG.connectionLine.setMap(GG.gmap);
             if (GG.streetviewMarker) GG.streetviewMarker.setMap(GG.gmap);
          }

          GG.saveSettings();
          
          Array.from(gameModeSelect.children).forEach((b, i) => {
            const m = modes[i];
            const active = m.id === mode.id;
            b.style.borderColor = active ? m.color : 'rgba(255,255,255,0.2)';
            b.style.background = active ? m.color + '40' : 'rgba(255,255,255,0.05)';
            b.style.color = active ? '#fff' : 'rgba(255,255,255,0.6)';
          });
          
          if (typeof GG.updateSettingsVisibilityLegacy === 'function') {
            GG.updateSettingsVisibilityLegacy();
          }
          if (typeof GG.updateSettingsVisibility === 'function') {
            GG.updateSettingsVisibility();
          }
          
          if (typeof GG.toggleMarker === 'function') {
             if (GG.settings.enabled) GG.placeMarker(); 
             else GG.toggleMarker();
          }
        };
        gameModeSelect.appendChild(btn);
    });

    gameModeContainer.appendChild(gameModeSelect);
    ghostSettingsContainer.appendChild(gameModeContainer);

    const dynamicSettingsContainer = document.createElement("div");
    dynamicSettingsContainer.className = "ghostguessr-setting";
    dynamicSettingsContainer.style.width = "100%";
    ghostSettingsContainer.appendChild(dynamicSettingsContainer);

    GG.updateSettingsVisibilityLegacy = () => {
        dynamicSettingsContainer.innerHTML = "";
        const mode = GG.settings.gameMode;

        if (mode === "safety") {
            const infoBox = document.createElement("div");
            infoBox.style.cssText = "background: rgba(16, 185, 129, 0.1); border: 1px solid rgba(16, 185, 129, 0.3); border-radius: 8px; padding: 12px; margin-bottom: 16px;";
            infoBox.innerHTML = `
                <div style="font-weight: 700; color: #10b981; margin-bottom: 4px;">Safety Mode Active</div>
                <div style="font-size: 13px; color: #d1d5db; line-height: 1.4;">Markers disabled. Country outline only.</div>
            `;
            dynamicSettingsContainer.appendChild(infoBox);

            const targetSelect = document.createElement("div");
            targetSelect.className = "ghostguessr-setting";
            targetSelect.style.cssText = "margin-bottom: 16px; display: flex; align-items: center; justify-content: space-between; background: rgba(255,255,255,0.05); padding: 8px; border-radius: 6px;";
            
            const targetLabel = document.createElement("span");
            targetLabel.textContent = "Target Region:";
            targetLabel.style.cssText = "font-size: 13px; font-weight: 600; color: #e5e7eb;";
            targetSelect.appendChild(targetLabel);

            const toggleWrapper = document.createElement("div");
            toggleWrapper.style.cssText = "display: flex; gap: 4px; background: rgba(0,0,0,0.2); padding: 2px; border-radius: 4px;";
            
            const rOptions = [
                { id: 'country', label: 'Country' },
                { id: 'state', label: 'State' }
            ];

            const currentRegion = GG.settings.safetyModeRegion || 'country';

            rOptions.forEach(opt => {
                const rBtn = document.createElement("button");
                const isAct = currentRegion === opt.id;
                rBtn.textContent = opt.label;
                rBtn.style.cssText = `
                    padding: 4px 12px;
                    border-radius: 4px;
                    font-size: 12px;
                    font-weight: 600;
                    border: none;
                    cursor: pointer;
                    background: ${isAct ? '#10b981' : 'transparent'};
                    color: ${isAct ? '#fff' : '#9ca3af'};
                    transition: all 0.2s;
                `;
                rBtn.onclick = () => {
                    GG.settings.safetyModeRegion = opt.id;
                    GG.saveSettings();
                    if (typeof GG.updateSettingsVisibilityLegacy === 'function') GG.updateSettingsVisibilityLegacy();
                    if (GG.settings.enabled) GG.placeMarker();
                };
                toggleWrapper.appendChild(rBtn);
            });
            targetSelect.appendChild(toggleWrapper);
            dynamicSettingsContainer.appendChild(targetSelect);

            const detailToggle = createToggle("Detailed Outline", "safetyDetailed", `
                <svg width="25" height="25" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" stroke="#ffffff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <circle cx="12" cy="12" r="10"></circle>
                  <line x1="2" y1="12" x2="22" y2="12"></line>
                  <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path>
                </svg>
            `, (checked) => {
                 if (GG.settings.enabled) GG.placeMarker();
            });
            dynamicSettingsContainer.appendChild(detailToggle);
        }
        else if (mode === "risky") {
            const infoBox = document.createElement("div");
            infoBox.style.cssText = "background: rgba(244, 63, 94, 0.1); border: 1px solid rgba(244, 63, 94, 0.3); border-radius: 8px; padding: 12px; margin-bottom: 16px;";
            infoBox.innerHTML = `
                <div style="font-weight: 700; color: #f43f5e; margin-bottom: 4px;">Risky Mode</div>
                <div style="font-size: 13px; color: #d1d5db; line-height: 1.4;">Coming soon.</div>
            `;
            dynamicSettingsContainer.appendChild(infoBox);
        }

        const hotkeyContainer = document.createElement("div");
        hotkeyContainer.className = "game-menu_volumeContainer__aWb0Y";
        hotkeyContainer.style.cssText = "margin-bottom: 20px; border-bottom: 1px solid rgba(255, 255, 255, 0.1); padding-bottom: 15px;";
        
        const hotkeyLabel = document.createElement("p");
        hotkeyLabel.className = "game-menu_subHeader__Ul5Vl";
        hotkeyLabel.textContent = "Hotkey";
        hotkeyContainer.appendChild(hotkeyLabel);

        const hotkeyInputContainer = document.createElement("div");
        hotkeyInputContainer.className = "game-menu_sliderContainer__suHjk";
        hotkeyInputContainer.style.cssText = "display: flex; align-items: center; gap: 10px;";

        const hotkeyIcon = document.createElement("div");
        hotkeyIcon.className = "game-menu_icon__qC_vb";
        hotkeyIcon.innerHTML = `
            <svg width="35" height="35" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <rect x="4" y="6" width="16" height="17" rx="2" stroke="#ffffff" stroke-width="2" fill="none"/>
                <text x="12" y="16" text-anchor="middle" dominant-baseline="middle" font-family="Arial" font-size="10" fill="#ffffff">${GG.settings.hotkey}</text>
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
                    <svg width="35" height="35" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <rect x="4" y="6" width="16" height="17" rx="2" stroke="#ffffff" stroke-width="2" fill="none"/>
                    <text x="12" y="16" text-anchor="middle" dominant-baseline="middle" font-family="Arial" font-size="10" fill="#ffffff">${GG.settings.hotkey}</text>
                </svg>`;
            }
        };

        const recordKey = (e) => {
            e.preventDefault();
            e.stopPropagation();
            if (e.key === 'Escape') { endRecording(false); return; }
            const key = e.key.toUpperCase();
            if (key.length === 1 && /[A-Z0-9 ]/.test(key) || key === 'SPACE') {
                    const finalKey = key === ' ' ? 'SPACE' : key;
                    GG.settings.hotkey = finalKey;
                    GG.saveSettings();
                    GG.setupHotkeyListener();
                    if (typeof GG.updateButtonState === 'function') GG.updateButtonState();
                    endRecording(true);
            }
        };

        const checkClickOutside = (e) => { if (e.target !== GG.hotkeyInput) endRecording(false); };

        GG.hotkeyInput.onclick = () => {
            if (isRecording) { endRecording(false); return; }
            isRecording = true;
            GG.hotkeyInput.textContent = "Press any key...";
            GG.hotkeyInput.style.background = 'rgba(139, 92, 246, 0.3)';
            GG.hotkeyInput.style.borderColor = '#fff';
            document.addEventListener('keydown', recordKey);
            setTimeout(() => document.addEventListener('mousedown', checkClickOutside), 100);
        };

        const hotkeyHelp = document.createElement("span");
        hotkeyHelp.textContent = "Press any key";
        hotkeyHelp.style.cssText = "font-size: 12px; color: #888; font-style: italic; min-width: 100px;";

        hotkeyInputContainer.appendChild(hotkeyIcon);
        hotkeyInputContainer.appendChild(GG.hotkeyInput);
        hotkeyInputContainer.appendChild(hotkeyHelp);
        hotkeyContainer.appendChild(hotkeyInputContainer);
        dynamicSettingsContainer.appendChild(hotkeyContainer);

        if (!GG.isElectron && !GG.isSteam) {
            const autoClaimToggle = buildAutoClaimToggle(settingsContainer);
            if (autoClaimToggle) dynamicSettingsContainer.appendChild(autoClaimToggle);
            
            const streamerModeToggle = buildStreamerModeToggle();
            if (streamerModeToggle) dynamicSettingsContainer.appendChild(streamerModeToggle);
        }

        if (mode === "safety") {
            const safetySettings = document.createElement("div");
            safetySettings.style.cssText = "margin-top: 10px; border-top: 1px solid rgba(255,255,255,0.1); paddingTop: 10px;";
            
            const colorContainer = createColorPicker("Outline Color", "safetyOutlineColor", "safetyOutlineColor", "safetyOutlineColor");
            const colorWrapper = document.createElement("div");
            colorWrapper.style.cssText = "display: flex; margin-bottom: 16px;";
            colorWrapper.appendChild(colorContainer);
            safetySettings.appendChild(colorWrapper);

            safetySettings.appendChild(createSlider("Outline Width", "safetyOutlineWidth", 0.5, 5, 0.1, "px", (val) => `
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <rect x="4" y="4" width="16" height="16" rx="2" fill="none" stroke="${GG.settings.safetyOutlineColor}" stroke-width="${val}"/>
                </svg>
            `));

            safetySettings.appendChild(createSlider("Fill Opacity", "safetyOutlineOpacity", 0, 1, 0.01, "%", (val) => `
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <rect x="4" y="4" width="16" height="16" rx="2" fill="${GG.settings.safetyOutlineColor}" fill-opacity="${val}" stroke="${GG.settings.safetyOutlineColor}" stroke-width="2"/>
                </svg>
            `));
            
            dynamicSettingsContainer.appendChild(safetySettings);
        }

        if (mode !== "safety") {
            const scorePredictorToggle = createScorePredictorToggle();
            if (scorePredictorToggle) {
                dynamicSettingsContainer.appendChild(scorePredictorToggle);
                const scorePredictorSettings = buildScorePredictorSettings();
                if (scorePredictorSettings) dynamicSettingsContainer.appendChild(scorePredictorSettings);
            }
        }
    };

    GG.updateSettingsVisibilityLegacy();

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
