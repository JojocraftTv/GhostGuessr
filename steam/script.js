// ==GhostGuessr Steam Edition==
// @name         GhostGuessr
// @version      2.1 Steam Edition
// @author       Niceas
// ==GhostGuessr Steam Edition==

(function () {
  "use strict";

  const SCRIPT_BASE =
    "https://raw.githubusercontent.com/JojocraftTv/GhostGuessr/refs/heads/test/scripts/";
  const files = [
    "ghostguessr-state.js",
    "ghostguessr-utils.js",
    "ghostguessr-map.js",
    "ghostguessr-ui.js",
    "ghostguessr-settings.js",
    "ghostguessr-main.js",
  ];

  const injectCode = (code) =>
    new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.type = "text/javascript";
      script.textContent = code;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error("Failed to execute injected code"));
      (document.head || document.documentElement).appendChild(script);
      script.remove();
    });

  const loadScript = async (src) => {
    const response = await fetch(src, { cache: "no-cache" });
    if (!response.ok) {
      throw new Error(`Failed to load ${src}: ${response.status}`);
    }
    const code = await response.text();
    const wrapped = `(() => { ${code}\n })();`;
    await injectCode(wrapped);
  };

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
