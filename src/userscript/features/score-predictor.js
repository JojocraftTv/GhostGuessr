import { settings, watch } from "../core/settings.js";
import { state, hasOrigin } from "../core/state.js";
import { on, emit } from "../core/events.js";
import { h, isVisible } from "../core/dom.js";
import { distance, formatDistance, predictScore, DEFAULT_MAP_SIZE } from "../core/geo.js";
import { onFetch, nativeFetch } from "../net/interceptor.js";
import { getGoogleMap, getMapContainer, readFiberLatLng } from "./google-map.js";
import { createLogger } from "../core/logger.js";

/**
 * Live score / distance prediction for the guess currently placed on the map.
 */

const log = createLogger("Predictor");
const GUESS_MARKER_SELECTOR = '[data-qa="guess-marker"], [class*="map-pin_mapPin__"]';
const POLL_MS = 250;

let badge = null;
let mapSizeToken = null;

const scoreTier = (score) => {
  if (score >= 4500) return "great";
  if (score >= 3000) return "good";
  if (score >= 1500) return "ok";
  return "bad";
};

const ensureBadge = () => {
  if (badge) return badge;
  badge = h(
    "div",
    { class: "gg-predictor", "aria-live": "polite" },
    h("span", { class: "gg-predictor__score" }),
    h("span", { class: "gg-predictor__sep" }, "•"),
    h("span", { class: "gg-predictor__distance" }),
  );
  return badge;
};

const hideBadge = () => {
  if (badge) badge.classList.remove("gg-predictor--visible");
};

const loadMapSize = async () => {
  const token = state.roundId;
  if (!token || token === mapSizeToken) return;
  mapSizeToken = token;
  state.mapSize = DEFAULT_MAP_SIZE;
  try {
    const doFetch = nativeFetch || window.fetch.bind(window);
    const game = await (await doFetch(`/api/v3/games/${token}`, { credentials: "include" })).json();
    const slug = game && (game.map || (game.options && game.options.map && game.options.map.slug));
    if (!slug) return;
    const map = await (await doFetch(`/api/maps/${slug}`, { credentials: "include" })).json();
    if (map && Number.isFinite(map.maxErrorDistance)) state.mapSize = map.maxErrorDistance;
  } catch (error) {
    log.debug("map size lookup failed", error);
  }
};

const renderBadge = () => {
  const container = getMapContainer();
  const guess = state.guess;
  const show =
    settings.showScorePredictor && settings.gameMode !== "safety" && guess && hasOrigin() && isVisible(container);
  if (!show) return hideBadge();

  const el = ensureBadge();
  if (el.parentElement !== container) container.appendChild(el);

  const meters = distance(state.origin, guess);
  const score = predictScore(meters, state.mapSize);
  const mode = settings.scorePredictorDisplay;
  const scoreEl = el.querySelector(".gg-predictor__score");
  scoreEl.textContent = `~${score.toLocaleString()} pts`;
  scoreEl.dataset.tier = scoreTier(score);
  el.querySelector(".gg-predictor__distance").textContent = formatDistance(meters);
  el.dataset.mode = mode;
  el.classList.add("gg-predictor--visible");
};

const setGuess = (point) => {
  const prev = state.guess;
  if (prev && point && Math.abs(prev.lat - point.lat) < 1e-7 && Math.abs(prev.lng - point.lng) < 1e-7) return;
  if (!prev && !point) return;
  state.guess = point;
  emit("guess:update", point);
};

/** Reads the guess position from the pin element (React props, else pixel projection). */
const readGuessFromDom = () => {
  const pins = Array.from(document.querySelectorAll(GUESS_MARKER_SELECTOR)).filter(isVisible);
  if (!pins.length) return null;
  const pin = pins[pins.length - 1];
  const fromProps = readFiberLatLng(pin);
  if (fromProps) return fromProps;

  const map = getGoogleMap();
  const container = getMapContainer();
  const bounds = map && map.getBounds && map.getBounds();
  if (!bounds || !container) return null;
  const pinRect = pin.getBoundingClientRect();
  const mapRect = container.getBoundingClientRect();
  if (!pinRect.width || !mapRect.width) return null;
  const relX = (pinRect.left + pinRect.width / 2 - mapRect.left) / mapRect.width;
  const relY = (pinRect.bottom - mapRect.top) / mapRect.height;
  const ne = bounds.getNorthEast();
  const sw = bounds.getSouthWest();
  return { lat: ne.lat() - (ne.lat() - sw.lat()) * relY, lng: sw.lng() + (ne.lng() - sw.lng()) * relX };
};

const tick = () => {
  if (!settings.showScorePredictor && !settings.showConnectionLine) return;
  if (document.hidden || !getMapContainer()) return;
  setGuess(readGuessFromDom());
};

export const initScorePredictor = () => {
  // GeoGuessr asks for terrain info right after a guess is placed: exact coordinates.
  onFetch({
    match: ({ url }) => url.includes("/api/v4/geo-coding/terrain"),
    before: (ctx) => {
      try {
        const body = ctx.init && typeof ctx.init.body === "string" ? JSON.parse(ctx.init.body) : null;
        if (body && Number.isFinite(body.lat) && Number.isFinite(body.lng)) setGuess({ lat: body.lat, lng: body.lng });
      } catch {}
    },
  });

  on("round:start", () => {
    setGuess(null);
    hideBadge();
    loadMapSize();
  });
  on("guess:update", () => {
    loadMapSize();
    renderBadge();
  });
  watch(["showScorePredictor", "scorePredictorDisplay", "gameMode"], renderBadge);

  setInterval(tick, POLL_MS);
};
