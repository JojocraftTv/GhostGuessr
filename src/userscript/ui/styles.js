import { whenBody } from "../core/dom.js";

/**
 * Small page stylesheet. Visual styling comes from GeoGuessr's own classes;
 * this only adds layout for our rows, the map badge, the HUD tooltip and the
 * fallback marker.
 */
const PAGE_CSS = `
/* GhostGuessr tab / rows inside GeoGuessr's settings dialog */
.gg-settings-panel .gg-heading, .gg-legacy-section .gg-heading { margin: 8px 0 4px; }
.gg-settings-panel .gg-note a { color: inherit; font-weight: 700; text-decoration: underline; }
.gg-keys { display: grid; gap: 8px; margin: 4px 0 8px; }
.gg-color { width: 34px; height: 26px; padding: 0; border: 2px solid rgba(255,255,255,.25); border-radius: 6px; background: none; cursor: pointer; }
.gg-color::-webkit-color-swatch-wrapper { padding: 2px; }
.gg-color::-webkit-color-swatch { border: 0; border-radius: 3px; }
[data-gg-recording] { outline: 2px solid #7950e5; outline-offset: 2px; }
.gg-legacy-section { width: 100%; }

/* GhostGuessr page in the main-menu settings (main-settings.js) */
[data-gg-hidden] { display: none !important; }
.gg-main-content[hidden] { display: none !important; }
/* Our own scroll areas (scroll.js): the Steam layout never scrolls the page. */
.gg-scroll { overflow-y: auto !important; overscroll-behavior: contain; scrollbar-width: thin; scrollbar-color: rgba(255,255,255,.3) transparent; padding-right: 6px; }
.gg-scroll::-webkit-scrollbar { width: 8px; }
.gg-scroll::-webkit-scrollbar-thumb { background: rgba(255,255,255,.25); border-radius: 8px; }
.gg-scroll::-webkit-scrollbar-track { background: transparent; }
.gg-main-stack { display: flex; flex-direction: column; gap: 8px; }
.gg-main-control { cursor: default; }
.gg-main-color { display: flex; align-items: center; gap: 10px; margin-left: auto; }
.gg-main-hex { font-size: 12px; font-weight: 700; opacity: .7; font-variant-numeric: tabular-nums; }
.gg-main-key {
  margin-left: auto; min-width: 44px; height: 30px; padding: 0 12px; border-radius: 8px; cursor: pointer;
  border: 1px solid rgba(255,255,255,.25); border-bottom-width: 3px; background: rgba(255,255,255,.1);
  color: #fff; font: inherit; font-size: 13px; font-weight: 700;
}
.gg-main-key:hover { background: rgba(255,255,255,.18); }
.gg-main-note { padding: 8px 10px; border-radius: 8px; font-size: 13px; background: rgba(121, 80, 229, .2); border: 1px solid rgba(121, 80, 229, .45); }
.gg-main-note a { color: #fff; font-weight: 700; }
.gg-main-version { margin-top: 12px; font-size: 12px; opacity: .45; }
.gg-main-help { margin: -4px 0 4px 38px; font-size: 12px; opacity: .6; }
.gg-main-help--flush { margin-left: 0; }

/* Round HUD toggle */
.gg-hud-btn svg { width: 24px; height: 24px; display: block; }
.gg-hud-btn[data-on="true"] .gg-hud-core { fill: #22c55e; }
.gg-hud-reference { position: relative; display: inline-flex; }
.gg-hud-tooltip {
  position: absolute; left: calc(100% + 10px); top: 50%; transform: translateY(-50%);
  white-space: nowrap; pointer-events: none; z-index: 10;
  opacity: 0; visibility: hidden; transition: opacity .15s ease;
}
.gg-hud-btn:hover + .gg-hud-tooltip, .gg-hud-btn:focus-visible + .gg-hud-tooltip { opacity: 1; visibility: visible; }

.gg-predictor {
  position: absolute; left: 12px; bottom: 12px; z-index: 1000; pointer-events: none;
  display: none; align-items: center; gap: 8px; height: 30px; padding: 0 12px; border-radius: 999px;
  font-family: inherit; font-size: 13.5px; font-weight: 800; color: #fff;
  background: rgba(16, 16, 40, 0.82); box-shadow: 0 4px 16px rgba(0,0,0,.35), 0 0 0 1px rgba(255,255,255,.12);
}
.gg-predictor--visible { display: inline-flex; }
.gg-predictor__sep { opacity: .4; font-weight: 400; }
.gg-predictor__score[data-tier="great"] { color: #4ade80; }
.gg-predictor__score[data-tier="good"] { color: #facc15; }
.gg-predictor__score[data-tier="ok"] { color: #fb923c; }
.gg-predictor__score[data-tier="bad"] { color: #f87171; }
.gg-predictor[data-mode="score"] .gg-predictor__sep, .gg-predictor[data-mode="score"] .gg-predictor__distance,
.gg-predictor[data-mode="distance"] .gg-predictor__sep, .gg-predictor[data-mode="distance"] .gg-predictor__score { display: none; }

.gg-fallback-marker { position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); border-radius: 50%; pointer-events: none; z-index: 9999; }
`;

export const injectPageStyle = async () => {
  await whenBody();
  if (document.getElementById("ghostguessr-page-style")) return;
  const style = document.createElement("style");
  style.id = "ghostguessr-page-style";
  style.textContent = PAGE_CSS;
  (document.head || document.documentElement).appendChild(style);
};
