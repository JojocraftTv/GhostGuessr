import { settings } from "../core/settings.js";
import { state, hasOrigin } from "../core/state.js";
import { getMaps } from "./google-map.js";
import { findCountry, toGeoJson, boundsOf } from "./countries.js";
import { createLogger } from "../core/logger.js";

/**
 * Safety mode: instead of an exact marker, highlight the country (or state)
 * that contains the round location.
 *
 * Countries come from the bundled border data (countries.js): no network
 * requests, no Google Geocoder, works the same on web and Steam.
 * "State" uses the Google Geocoder when GeoGuessr's Maps key allows it and
 * falls back to the country outline otherwise.
 */

const log = createLogger("Safety");

let layer = null; // google.maps.Data or google.maps.Rectangle
let appliedKey = null;
let requestSeq = 0;
let geocoderDenied = false;
let pending = false;

const styleOptions = () => {
  const color = settings.safetyOutlineColor || "#10B981";
  const opacity = settings.safetyOutlineOpacity ?? 0.8;
  return {
    clickable: false,
    fillColor: color,
    fillOpacity: opacity * 0.25,
    strokeColor: color,
    strokeOpacity: opacity,
    strokeWeight: settings.safetyOutlineWidth || 2,
    zIndex: 5,
  };
};

export const clearSafetyOutline = () => {
  if (layer) layer.setMap(null);
  layer = null;
  appliedKey = null;
  pending = false;
  requestSeq += 1;
};

export const updateSafetyStyle = () => {
  if (!layer) return;
  if (typeof layer.setStyle === "function") layer.setStyle(styleOptions());
  else layer.setOptions(styleOptions());
};

const drawCountry = (maps, map, country) => {
  if (settings.safetyDetailed !== false) {
    const data = new maps.Data({ map });
    data.addGeoJson(toGeoJson(country));
    data.setStyle(styleOptions());
    return data;
  }
  return new maps.Rectangle({ ...styleOptions(), map, bounds: boundsOf(country) });
};

/** State/province bounds via the Google Geocoder, or null if unavailable. */
const geocodeState = (maps) =>
  new Promise((resolve) => {
    if (geocoderDenied || !maps.Geocoder) return resolve(null);
    try {
      new maps.Geocoder().geocode({ location: state.origin }, (results, status) => {
        if (status === "REQUEST_DENIED") {
          geocoderDenied = true;
          log.info("Google Geocoder not available on this key; using country outlines for 'State'.");
        }
        const target = status === "OK" && (results || []).find((r) => r.types && r.types.includes("administrative_area_level_1"));
        const geometry = target && target.geometry;
        resolve((geometry && (geometry.bounds || geometry.viewport)) || null);
      });
    } catch {
      resolve(null);
    }
  });

export const renderSafetyOutline = async (map) => {
  const maps = getMaps();
  if (!maps || !hasOrigin()) return;

  const key = `${state.origin.lat},${state.origin.lng}|${settings.safetyModeRegion}|${settings.safetyDetailed}`;
  if (key === appliedKey && (pending || (layer && layer.getMap() === map))) return;
  if (layer) layer.setMap(null);
  layer = null;
  appliedKey = key;
  const seq = ++requestSeq;

  try {
    if (settings.safetyModeRegion === "state") {
      pending = true;
      const bounds = await geocodeState(maps).finally(() => {
        if (seq === requestSeq) pending = false;
      });
      if (seq !== requestSeq || !settings.enabled || settings.gameMode !== "safety") return;
      if (bounds) {
        layer = new maps.Rectangle({ ...styleOptions(), map, bounds });
        return;
      }
    }
    const country = findCountry(state.origin);
    if (!country) {
      log.debug("no country found for", state.origin);
      return;
    }
    layer = drawCountry(maps, map, country);
    log.debug("outlined", country.name);
  } catch (error) {
    appliedKey = null;
    log.warn("outline failed", error);
  }
};
