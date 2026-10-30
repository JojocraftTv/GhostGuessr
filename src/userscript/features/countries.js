import topology from "../data/countries.json";

/**
 * Offline country lookup on bundled Natural Earth borders (1:50m, simplified;
 * regenerate with scripts/build-countries.js). No network and no Google
 * Geocoder needed.
 */

const NEAREST_MAX_KM = 250;

let countries = null;

/* ---------- TopoJSON decoding ---------- */

const decodeArcs = () => {
  const { scale, translate } = topology.transform;
  return topology.arcs.map((arc) => {
    let x = 0;
    let y = 0;
    return arc.map(([dx, dy]) => {
      x += dx;
      y += dy;
      return [x * scale[0] + translate[0], y * scale[1] + translate[1]];
    });
  });
};

const ring = (arcs, indexes) => {
  const points = [];
  for (const index of indexes) {
    const arc = index < 0 ? arcs[~index].slice().reverse() : arcs[index];
    // Consecutive arcs share their joining point.
    points.push(...(points.length ? arc.slice(1) : arc));
  }
  return points;
};

const bboxOf = (polygons) => {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const polygon of polygons) {
    for (const [x, y] of polygon[0]) {
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }
  return { west: minX, east: maxX, south: minY, north: maxY };
};

const load = () => {
  if (countries) return countries;
  const arcs = decodeArcs();
  countries = [];
  for (const geometry of topology.objects.countries.geometries) {
    let polygonArcs;
    if (geometry.type === "Polygon") polygonArcs = [geometry.arcs];
    else if (geometry.type === "MultiPolygon") polygonArcs = geometry.arcs;
    else continue;
    const polygons = polygonArcs.map((rings) => rings.map((indexes) => ring(arcs, indexes)));
    countries.push({
      id: geometry.id || null,
      name: (geometry.properties && geometry.properties.name) || "Unknown",
      polygons,
      bbox: bboxOf(polygons),
    });
  }
  // Smallest first: simplified borders of big neighbours can overlap enclaves
  // and micro-states (Andorra, Vatican, San Marino, ...).
  const area = ({ bbox }) => (bbox.east - bbox.west) * (bbox.north - bbox.south);
  countries.sort((a, b) => area(a) - area(b));
  return countries;
};

/* ---------- geometry ---------- */

const inRing = (x, y, points) => {
  let inside = false;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const [xi, yi] = points[i];
    const [xj, yj] = points[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
};

const inPolygon = (x, y, polygon) => inRing(x, y, polygon[0]) && !polygon.slice(1).some((hole) => inRing(x, y, hole));

const inBbox = (x, y, b, margin = 0) =>
  x >= b.west - margin && x <= b.east + margin && y >= b.south - margin && y <= b.north + margin;

/** Approx. distance in km from a point to segment a-b (equirectangular, fine for < 300 km). */
const segmentKm = (lat, lng, [ax, ay], [bx, by]) => {
  const k = Math.cos((lat * Math.PI) / 180);
  const px = lng * k;
  const py = lat;
  const x1 = ax * k;
  const x2 = bx * k;
  const dx = x2 - x1;
  const dy = by - ay;
  const len = dx * dx + dy * dy;
  const t = len ? Math.max(0, Math.min(1, ((px - x1) * dx + (py - ay) * dy) / len)) : 0;
  return Math.hypot(px - (x1 + t * dx), py - (ay + t * dy)) * 111.32;
};

/* ---------- API ---------- */

/**
 * Country containing the point. Points slightly outside the simplified
 * borders (coasts, islands) snap to the nearest country within 250 km.
 */
export const findCountry = ({ lat, lng }) => {
  const all = load();
  for (const country of all) {
    if (inBbox(lng, lat, country.bbox) && country.polygons.some((p) => inPolygon(lng, lat, p))) return country;
  }

  let best = null;
  let bestKm = NEAREST_MAX_KM;
  for (const country of all) {
    if (!inBbox(lng, lat, country.bbox, 3)) continue;
    for (const polygon of country.polygons) {
      const points = polygon[0];
      for (let i = 1; i < points.length; i += 1) {
        const d = segmentKm(lat, lng, points[i - 1], points[i]);
        if (d < bestKm) {
          bestKm = d;
          best = country;
        }
      }
    }
  }
  return best;
};

/** GeoJSON Feature of a country (for google.maps.Data). */
export const toGeoJson = (country) => ({
  type: "Feature",
  properties: { name: country.name },
  geometry: { type: "MultiPolygon", coordinates: country.polygons },
});

/** Bounds literal { north, south, east, west } of a country. */
export const boundsOf = (country) => ({ ...country.bbox });
