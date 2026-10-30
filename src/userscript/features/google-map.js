import { pageWindow } from "../core/env.js";
import { queryFirst } from "../core/dom.js";

/**
 * Locates the guess map container and the Google Maps instance GeoGuessr
 * renders into it (via the React fiber tree).
 */

const MAP_CONTAINER_SELECTORS = [
  '[data-qa="guess-map-canvas"]',
  '[class*="guess-map_canvas__"]',
  '[class*="run-game-guess-map-contents_canvas__"]',
  '[class*="coordinate-map_canvasContainer__"]',
  '[class*="guess-map-container_map__"]',
  '[class*="game-layout_map__"]',
  '[class*="coordinate-guess_mapContainer__"]',
  ".gm-style",
];

export const getMaps = () => {
  try {
    const google = pageWindow.google;
    return google && google.maps ? google.maps : null;
  } catch {
    return null;
  }
};

export const getMapContainer = () => {
  const el = queryFirst(MAP_CONTAINER_SELECTORS);
  if (el && el.classList.contains("gm-style") && el.parentElement) return el.parentElement;
  return el;
};

export const findReactFiber = (el) => {
  if (!el) return null;
  const key = Object.keys(el).find((k) => k.startsWith("__reactFiber$") || k.startsWith("__reactInternalInstance$"));
  return key ? el[key] : null;
};

const isMapInstance = (value) =>
  !!value && typeof value.setCenter === "function" && typeof value.getDiv === "function";

let cachedMap = null;

/** Returns the guess map `google.maps.Map` or null. */
export const getGoogleMap = () => {
  const container = getMapContainer();
  if (!container) return null;
  if (cachedMap && container.contains(cachedMap.getDiv())) return cachedMap;
  cachedMap = null;

  for (const start of [container, container.firstElementChild]) {
    let fiber = findReactFiber(start);
    for (let depth = 0; fiber && depth < 40; depth += 1) {
      const props = fiber.memoizedProps;
      if (props && isMapInstance(props.map)) {
        cachedMap = props.map;
        return cachedMap;
      }
      fiber = fiber.return;
    }
  }
  return null;
};

/** Reads a lat/lng from a React element's props (guess marker pins). */
export const readFiberLatLng = (el) => {
  let fiber = findReactFiber(el);
  for (let depth = 0; fiber && depth < 25; depth += 1) {
    const props = fiber.memoizedProps;
    if (props) {
      if (Number.isFinite(props.lat) && Number.isFinite(props.lng)) return { lat: props.lat, lng: props.lng };
      const pos = props.position || props.coordinates;
      if (pos) {
        const lat = typeof pos.lat === "function" ? pos.lat() : pos.lat;
        const lng = typeof pos.lng === "function" ? pos.lng() : pos.lng;
        if (Number.isFinite(lat) && Number.isFinite(lng)) return { lat, lng };
      }
    }
    fiber = fiber.return;
  }
  return null;
};
