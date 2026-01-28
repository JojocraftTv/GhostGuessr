
import { buildAutoClaimToggle } from './AutoClaimToggle.js';
import { createScorePredictorToggle } from './ScorePredictorToggle.js';
import { buildScorePredictorSettings } from './ScorePredictorSettings.js';
import { buildStreamerModeToggle } from './StreamerModeToggle.js';
import { showNotification, showUpdateNotification } from './Notifications.js';
import { createGhostMarkerSettings, getSettingsContainer } from './GhostMarkerSettings.js';
import { createToggleButton, updateButtonState } from './ToggleButton.js';
import { createSvg, createSlider, createColorPicker } from './components.js';
import { hasClassPrefix, getClassByPrefix } from './utils.js';
import { injectSkinchangerToggle, applySkinchangerHoverZ, addGithubLink } from './Skinchanger.js';

const GG = window.GhostGuessr;

GG.buildAutoClaimToggle = buildAutoClaimToggle;
GG.createScorePredictorToggle = createScorePredictorToggle;
GG.buildScorePredictorSettings = buildScorePredictorSettings;
GG.buildStreamerModeToggle = buildStreamerModeToggle;
GG.showNotification = showNotification;
GG.showUpdateNotification = showUpdateNotification;
GG.createGhostMarkerSettings = createGhostMarkerSettings;
GG.getSettingsContainer = getSettingsContainer;
GG.createToggleButton = createToggleButton;
GG.updateButtonState = updateButtonState;
GG.createSvg = createSvg;
GG.createSlider = createSlider;
GG.createColorPicker = createColorPicker;
GG.injectSkinchangerToggle = injectSkinchangerToggle;
GG.applySkinchangerHoverZ = applySkinchangerHoverZ;
GG.addGithubLink = addGithubLink;

const _ggSkinMo = new MutationObserver(() => {
    try {
      GG.injectSkinchangerToggle();
    } catch {}
});
_ggSkinMo.observe(document.documentElement, {
    childList: true,
    subtree: true,
});
