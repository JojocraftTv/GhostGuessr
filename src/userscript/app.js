import { VERSION, platform, loader, pageWindow } from "./core/env.js";
import { settings } from "./core/settings.js";
import { state } from "./core/state.js";
import { startDomObserver } from "./core/dom.js";
import { createLogger } from "./core/logger.js";
import { installInterceptor } from "./net/interceptor.js";
import { initRoundTracker } from "./features/round-tracker.js";
import { initGhostMarker, toggleMarker, render } from "./features/ghost-marker.js";
import { initScorePredictor } from "./features/score-predictor.js";
import { initHotkeys } from "./features/hotkeys.js";
import { initRewards } from "./features/rewards.js";
import { initStreamerMode } from "./features/streamer-mode.js";
import { initSkinchanger } from "./features/skinchanger.js";
import { initUpdater } from "./features/updater.js";
import { initRageMode, pinGuess } from "./features/rage-mode.js";
import { initSettingsMenu, inspectSettings } from "./ui/settings-menu.js";
import { initHudButton } from "./ui/hud-button.js";
import { injectPageStyle } from "./ui/styles.js";

const log = createLogger();

/**
 * Boot order matters: network hooks must be registered and installed
 * synchronously at document-start, before GeoGuessr issues its first request.
 * Everything DOM-related waits for <body>.
 */
export const start = () => {
  if (pageWindow.__ghostguessrApp) return;

  // 1. Network layer (sync).
  initRoundTracker();
  initScorePredictor();
  initSkinchanger();
  installInterceptor();

  // 2. Features.
  initGhostMarker();
  initHotkeys();
  initRewards();
  initStreamerMode();
  initRageMode();
  initUpdater();

  // 3. UI — lives inside GeoGuessr's own settings menu and HUD.
  injectPageStyle();
  initSettingsMenu();
  initHudButton();
  startDomObserver();

  // Small debugging / scripting surface.
  pageWindow.__ghostguessrApp = {
    version: VERSION,
    platform,
    loader,
    settings,
    state,
    toggleMarker,
    render,
    pinGuess,
    inspectSettings,
  };

  log.info(`v${VERSION} loaded (${platform}${loader ? `, loader ${loader.version}` : ""})`);
};
