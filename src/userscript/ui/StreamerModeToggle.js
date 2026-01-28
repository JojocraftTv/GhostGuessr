const GG = window.GhostGuessr;

export const buildStreamerModeToggle = () => {
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
          <circle cx="12.5" cy="12.5" r="9" stroke="#ffffff" stroke-width="2" fill="none"/>
          <path d="M8 12.5h9M12.5 8v9" stroke="#ffffff" stroke-width="2" stroke-linecap="round"/>
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
