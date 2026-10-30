const EARTH_RADIUS_M = 6371000;
export const DEFAULT_MAP_SIZE = 14916862;

const toRad = (deg) => (deg * Math.PI) / 180;

/** Great-circle distance in meters (haversine). */
export const distance = (a, b) => {
  if (!a || !b) return 0;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
};

export const formatDistance = (meters) => {
  if (meters < 1000) return `${Math.round(meters)} m`;
  const km = meters / 1000;
  return km < 10 ? `${km.toFixed(2)} km` : `${Math.round(km).toLocaleString()} km`;
};

/** GeoGuessr score formula: 5000 * e^(-10 * d / mapSize). */
export const predictScore = (meters, mapSize = DEFAULT_MAP_SIZE) => {
  if (meters <= 25) return 5000;
  const score = Math.round(5000 * Math.exp((-10 * meters) / (mapSize || DEFAULT_MAP_SIZE)));
  return Math.max(0, Math.min(5000, score));
};

export const hexToRgba = (hex, alpha = 1) => {
  const clean = String(hex || "#000000").replace("#", "");
  const full = clean.length === 3 ? clean.replace(/./g, (c) => c + c) : clean.padEnd(6, "0");
  const r = parseInt(full.slice(0, 2), 16) || 0;
  const g = parseInt(full.slice(2, 4), 16) || 0;
  const b = parseInt(full.slice(4, 6), 16) || 0;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};
