#!/usr/bin/env node
/*
 * Generates src/userscript/data/countries.json — a compact TopoJSON of the
 * world's country borders (Natural Earth 1:50m via world-atlas, public domain)
 * used by Safety mode to find and outline the round's country offline.
 *
 *   mkdir -p /tmp/geo && cd /tmp/geo && npm i world-atlas@2 topojson-simplify@3 topojson-client@3
 *   NODE_PATH=/tmp/geo/node_modules node scripts/build-countries.js
 */
const fs = require("fs");
const path = require("path");
const { presimplify, simplify, quantile } = require("topojson-simplify");
const { quantize } = require("topojson-client");

const source = require("world-atlas/countries-50m.json");
const QUANTILE = Number(process.env.GG_SIMPLIFY_QUANTILE || 0.15);

const SMALL_BBOX_DEG2 = Number(process.env.GG_SMALL_COUNTRY || 4);

const pre = presimplify(source);

// Micro-states and small countries (Andorra, Vatican, Liechtenstein, ...) would
// collapse when simplified: keep every point of their border arcs.
const arcIndexes = (arcs) => (Array.isArray(arcs) ? arcs.flatMap(arcIndexes) : [arcs < 0 ? ~arcs : arcs]);
const decoded = pre.arcs; // presimplify converts arcs to absolute coordinates
for (const geometry of pre.objects.countries.geometries) {
  if (!geometry.arcs) continue;
  const indexes = arcIndexes(geometry.arcs);
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const i of indexes) {
    for (const [x, y] of decoded[i]) {
      minX = Math.min(minX, x); maxX = Math.max(maxX, x);
      minY = Math.min(minY, y); maxY = Math.max(maxY, y);
    }
  }
  if ((maxX - minX) * (maxY - minY) > SMALL_BBOX_DEG2) continue;
  for (const i of indexes) for (const point of decoded[i]) point[2] = Infinity;
}

const simplified = simplify(pre, quantile(pre, QUANTILE));

// Keep only what the script needs: geometry + country name.
const countries = simplified.objects.countries;
for (const geometry of countries.geometries) {
  geometry.properties = { name: geometry.properties && geometry.properties.name };
  if (geometry.id === undefined) delete geometry.id;
}
delete simplified.objects.land;

// Drop the per-point weights added by presimplify, then quantize + delta-encode (small integers).
simplified.arcs = simplified.arcs.map((arc) => arc.map((point) => [point[0], point[1]]));
delete simplified.transform;
const compact = quantize(simplified, Number(process.env.GG_QUANTIZE || 1e5));

const out = path.join(__dirname, "..", "src", "userscript", "data", "countries.json");
fs.writeFileSync(out, JSON.stringify(compact));
console.log(`wrote ${out}: ${countries.geometries.length} countries, ${(fs.statSync(out).size / 1024).toFixed(0)} KB`);
