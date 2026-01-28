
const GG = window.GhostGuessr;

export const applySkinchangerHoverZ = function (host) {
    const center = host.closest('[class*="pro-user-start-page_center"]');
    const hoverCatch = center
      ? center.querySelector('[class*="pro-user-start-page_hoverCatch"]')
      : document.querySelector('[class*="pro-user-start-page_hoverCatch"]');
    if (!hoverCatch) return;
    if (hoverCatch.dataset.ggZFixed === "1") return;

    hoverCatch.style.zIndex = "5";
    hoverCatch.dataset.ggZFixed = "1";
};

export const injectSkinchangerToggle = function (initialLocalSaveOnly) {
    try {
      const host = document.querySelector(
        '[class*="pro-user-start-page_globeWrapper"]',
      );
      if (!host) return;

      applySkinchangerHoverZ(host);

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
        labelText.textContent = "Skinchanger (Beta)";
      };

      updateToggleVisuals();

      checkbox.addEventListener("change", () => {
        const next = !!checkbox.checked;
        
        if (next) {
          window.postMessage({ type: "GG_AVATAR_STORE_ORIGINAL" }, "*");
        }
        
        if (GG.avatarStorage && GG.avatarStorage.setLocalSaveOnly) {
          GG.avatarStorage.setLocalSaveOnly(next);
        } else if (typeof GM_setValue === "function") {
          try {
            GM_setValue("gg_local_save_only_v1", next);
          } catch {}
        }
        
        
        window.postMessage({ type: "GG_AVATAR_LOCAL_SAVE_ONLY", value: next }, "*");
        
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

export const addGithubLink = function () {
    if (document.getElementById("gg-github-link")) return;

    const header = document.querySelector('[class*="header-desktop_root__"]');
    if (!header) return;

    const rightSection = header.querySelector(
      '[class*="header-desktop_desktopSectionRight__"]',
    );
    if (!rightSection) return;

    const refLink = header.querySelector(
      '[class*="menu-item-secondary_container__"]',
    );
    
    const link = document.createElement("a");
    link.id = "gg-github-link";
    link.href = "https://github.com/JojocraftTv/GhostGuessr";
    link.target = "_blank";
    link.style.textDecoration = "none";
    link.style.cursor = "pointer";
    link.style.marginLeft = "auto"; 
    link.style.marginRight = "20px"; 
    link.style.alignSelf = "center";
    link.style.zIndex = "100";
    link.style.display = "flex";
    link.style.alignItems = "center";
    link.style.gap = "8px";
    
    const icon = document.createElement("img");
    icon.src = "https://raw.githubusercontent.com/JojocraftTv/GhostGuessr/refs/heads/main/icons/GhostGuessr.png";
    icon.style.width = "20px";
    icon.style.height = "20px";
    icon.style.display = "block";
    link.appendChild(icon);

    const text = document.createElement("span");
    text.textContent = "GhostGuessr";
    link.appendChild(text);
    
    link.style.color = "#FFFFFF";
    link.style.fontWeight = "bold";
    link.style.textTransform = "uppercase";
    link.style.fontSize = "12px";
    
    if (refLink) {
      const style = window.getComputedStyle(refLink);
      link.style.fontFamily = style.fontFamily;
      link.style.fontSize = style.fontSize;
      link.style.fontWeight = style.fontWeight;
      link.style.letterSpacing = style.letterSpacing;
      
      link.style.opacity = "0.7"; 
      link.style.transition = "opacity 0.2s";
      
      link.addEventListener("mouseenter", () => link.style.opacity = "1");
      link.addEventListener("mouseleave", () => link.style.opacity = "0.7");
    }

    header.insertBefore(link, rightSection);
};
