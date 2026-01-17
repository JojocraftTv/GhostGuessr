// ==GhostGuessr Steam Edition==
// @name         GhostGuessr
// @version      2.1 Steam Edition
// @author       Niceas
// ==GhostGuessr Steam Edition==

(function () {
  "use strict";

  const SCRIPT_BASE =
    "https://raw.githubusercontent.com/JojocraftTv/GhostGuessr/refs/heads/main/scripts/";
  const files = [
    "ghostguessr-state.js",
    "ghostguessr-utils.js",
    "ghostguessr-map.js",
    "ghostguessr-ui.js",
    "ghostguessr-settings.js",
    "ghostguessr-main.js",
  ];

  const loadScript = (src) =>
    new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = src;
      script.async = false;
      script.onload = () => resolve(src);
      script.onerror = () => reject(new Error(`Failed to load ${src}`));
      document.head.appendChild(script);
    });

  const loadAllScripts = async () => {
    for (const file of files) {
      await loadScript(`${SCRIPT_BASE}${file}`);
    }
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => {
      loadAllScripts().catch(() => {});
    });
  } else {
    loadAllScripts().catch(() => {});
  }
})();
