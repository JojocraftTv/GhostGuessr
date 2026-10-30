import { settings, set, watch } from "../core/settings.js";
import { state, hasPoint, hasOrigin } from "../core/state.js";
import { on, emit } from "../core/events.js";
import { onDomChange } from "../core/dom.js";
import { hexToRgba } from "../core/geo.js";
import { getGoogleMap, getMaps, getMapContainer } from "./google-map.js";
import { renderSafetyOutline, clearSafetyOutline, updateSafetyStyle } from "./safety-mode.js";

/**
 * Draws the ghost marker (round origin), the Street View marker (current
 * panorama) and the guess -> origin connection line on the guess map.
 */

const overlays = { ghost: null, streetview: null, line: null, map: null };
const FALLBACK_ID = "gg-fallback-marker";

const circleIcon = (maps, { color, outline, outlineWidth, size, opacity }) => ({
  path: maps.SymbolPath.CIRCLE,
  fillColor: hexToRgba(color, opacity),
  fillOpacity: 1,
  strokeColor: outline,
  strokeOpacity: opacity,
  strokeWeight: outlineWidth,
  scale: size,
});

const ghostStyle = () => ({
  color: settings.markerColor,
  outline: settings.outlineColor,
  outlineWidth: settings.outlineWidth,
  size: settings.size,
  opacity: settings.opacity,
});

const streetviewStyle = () => ({
  color: settings.streetviewMarkerColor,
  outline: settings.streetviewMarkerOutline,
  outlineWidth: settings.streetviewMarkerOutlineWidth,
  size: settings.streetviewMarkerSize,
  opacity: settings.streetviewMarkerOpacity,
});

const removeOverlay = (name) => {
  const overlay = overlays[name];
  if (overlay && typeof overlay.setMap === "function") overlay.setMap(null);
  overlays[name] = null;
};

const removeFallback = () => {
  const el = document.getElementById(FALLBACK_ID);
  if (el) el.remove();
};

export const clearOverlays = () => {
  removeOverlay("ghost");
  removeOverlay("streetview");
  removeOverlay("line");
  removeFallback();
  clearSafetyOutline();
};

const upsertMarker = (name, maps, map, point, style, zIndex) => {
  const position = new maps.LatLng(point.lat, point.lng);
  const icon = circleIcon(maps, style);
  const existing = overlays[name];
  if (existing && existing.getMap() === map) {
    existing.setPosition(position);
    existing.setIcon(icon);
    return;
  }
  removeOverlay(name);
  overlays[name] = new maps.Marker({
    position,
    map,
    icon,
    zIndex,
    clickable: false,
    draggable: false,
    optimized: false,
  });
};

/** CSS dot in the middle of the map when the Maps API is unreachable. */
const renderFallback = () => {
  const container = getMapContainer();
  if (!container || document.getElementById(FALLBACK_ID)) return;
  const size = settings.size * 2.5;
  const dot = document.createElement("div");
  dot.id = FALLBACK_ID;
  dot.className = "gg-fallback-marker";
  Object.assign(dot.style, {
    width: `${size}px`,
    height: `${size}px`,
    background: hexToRgba(settings.markerColor, settings.opacity),
    border: `${settings.outlineWidth}px solid ${settings.outlineColor}`,
  });
  container.appendChild(dot);
};

const renderLine = (maps, map) => {
  const guess = state.guess;
  if (!settings.showConnectionLine || !guess || !hasOrigin()) {
    removeOverlay("line");
    return;
  }
  const path = [new maps.LatLng(guess.lat, guess.lng), new maps.LatLng(state.origin.lat, state.origin.lng)];
  const options = {
    path,
    map,
    geodesic: true,
    clickable: false,
    zIndex: 996,
    strokeColor: settings.markerColor,
    strokeOpacity: 0.8,
    strokeWeight: 2,
  };
  if (overlays.line && overlays.line.getMap() === map) overlays.line.setOptions(options);
  else {
    removeOverlay("line");
    overlays.line = new maps.Polyline(options);
  }
};

/** Brings the overlays in line with settings + state. Cheap to call often. */
export const render = () => {
  if (!settings.enabled) {
    clearOverlays();
    return;
  }
  const maps = getMaps();
  const map = getGoogleMap();
  if (!map || !maps) {
    if (hasOrigin() && getMapContainer() && !maps) renderFallback();
    return;
  }
  removeFallback();
  overlays.map = map;

  if (settings.gameMode === "safety") {
    removeOverlay("ghost");
    removeOverlay("streetview");
    removeOverlay("line");
    renderSafetyOutline(map);
    return;
  }
  clearSafetyOutline();

  if (hasOrigin()) upsertMarker("ghost", maps, map, state.origin, ghostStyle(), 999);
  else removeOverlay("ghost");

  if (settings.showStreetviewMarker && hasPoint(state.current)) {
    upsertMarker("streetview", maps, map, state.current, streetviewStyle(), 998);
  } else removeOverlay("streetview");

  renderLine(maps, map);
};

export const setMarkerEnabled = (enabled) => {
  set("enabled", !!enabled);
};

export const toggleMarker = () => setMarkerEnabled(!settings.enabled);

const needsRender = () => {
  if (!settings.enabled) return false;
  const map = getGoogleMap();
  if (!map) return !!getMapContainer();
  if (settings.gameMode === "safety") return true;
  if (overlays.map !== map) return true;
  return hasOrigin() && (!overlays.ghost || overlays.ghost.getMap() !== map);
};

export const initGhostMarker = () => {
  on("round:start", () => {
    clearOverlays();
    render();
  });
  on("location:update", render);
  on("guess:update", () => {
    if (settings.enabled) render();
  });

  watch(["enabled"], ({ value }) => {
    render();
    emit("marker:toggle", { enabled: value });
  });
  watch(
    [
      "gameMode",
      "markerColor",
      "outlineColor",
      "opacity",
      "outlineWidth",
      "size",
      "showStreetviewMarker",
      "streetviewMarkerColor",
      "streetviewMarkerOutline",
      "streetviewMarkerSize",
      "streetviewMarkerOutlineWidth",
      "streetviewMarkerOpacity",
      "showConnectionLine",
      "safetyModeRegion",
      "safetyDetailed",
    ],
    () => {
      removeFallback();
      render();
    },
  );
  watch(["safetyOutlineColor", "safetyOutlineOpacity", "safetyOutlineWidth"], updateSafetyStyle);

  // GeoGuessr re-mounts the map between rounds/pages: re-attach when needed.
  onDomChange(() => {
    if (needsRender()) render();
  });
};
