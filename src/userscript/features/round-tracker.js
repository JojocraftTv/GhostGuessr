import { onFetch, onXhr } from "../net/interceptor.js";
import { state, hasPoint } from "../core/state.js";
import { emit } from "../core/events.js";
import { distance } from "../core/geo.js";
import { createLogger } from "../core/logger.js";

/**
 * Tracks the current round and the Street View location by observing
 *  - GeoGuessr game API responses (`/api/v3/games/...`, duels/battle-royale game-server)
 *  - Google Street View metadata requests (GetMetadata / SingleImageSearch)
 */

const log = createLogger("Round");
const COORD_PATTERN = /-?\d+\.\d+,-?\d+\.\d+/;
const NEW_LOCATION_JUMP_KM = 20;

const urlRoundId = () => {
  const match = window.location.pathname.match(/\/(?:game|challenge|duels|team-duels|battle-royale|live-challenge)\/([^/?#]+)/);
  return match ? match[1] : null;
};

const startRound = (origin, { roundId = state.roundId, roundNumber = state.roundNumber } = {}) => {
  state.roundId = roundId;
  state.roundNumber = roundNumber;
  state.origin = origin ? { ...origin } : { lat: 0, lng: 0 };
  state.current = origin ? { ...origin } : { lat: 0, lng: 0 };
  state.guess = null;
  log.debug("round start", state.roundId, state.roundNumber);
  emit("round:start", { roundId, roundNumber, origin: state.origin });
};

/** Current round location from a classic (`rounds[].lat`) or duels (`rounds[].panorama`) payload. */
const extractOrigin = (data, roundNumber) => {
  const rounds = data && Array.isArray(data.rounds) ? data.rounds : null;
  if (!rounds || !rounds.length) return null;
  const round = (roundNumber && rounds[roundNumber - 1]) || rounds[rounds.length - 1];
  const point = round && (round.panorama || round);
  if (point && Number.isFinite(point.lat) && Number.isFinite(point.lng)) return { lat: point.lat, lng: point.lng };
  return null;
};

const handleGamePayload = (data) => {
  if (!data || typeof data !== "object") return;
  const token = data.token || data.gameId || null;
  const roundNumber = data.round || data.currentRoundNumber || 0;
  const origin = extractOrigin(data, roundNumber);

  const isNewGame = token && token !== state.roundId;
  const isNewRound = !isNewGame && roundNumber && roundNumber !== state.roundNumber;
  if (!isNewGame && !isNewRound) return;

  const recentLocation = Date.now() - state.lastLocationAt < 3000;
  // Street View metadata may have arrived just before the game payload; keep it then.
  const nextOrigin = origin || (recentLocation && hasPoint(state.origin) ? state.origin : null);
  startRound(nextOrigin, { roundId: token || state.roundId, roundNumber: roundNumber || 1 });
};

const handleStreetViewMetadata = (text) => {
  const match = typeof text === "string" ? text.match(COORD_PATTERN) : null;
  if (!match) return;
  const [lat, lng] = match[0].split(",").map(Number.parseFloat);
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || (lat === 0 && lng === 0)) return;
  const point = { lat, lng };

  const routeId = urlRoundId();
  const routeChanged = routeId && state.roundId && routeId !== state.roundId;
  const jumpedKm = hasPoint(state.current) ? distance(state.current, point) / 1000 : 0;

  if (routeChanged || jumpedKm > NEW_LOCATION_JUMP_KM) {
    startRound(point, { roundId: routeId || state.roundId, roundNumber: state.roundNumber });
  } else if (!hasPoint(state.origin)) {
    state.origin = { ...point };
    if (!state.roundId && routeId) state.roundId = routeId;
    emit("round:start", { roundId: state.roundId, roundNumber: state.roundNumber, origin: state.origin });
  }

  state.current = point;
  state.lastLocationAt = Date.now();
  emit("location:update", point);
};

const isGameApi = (url) =>
  url.includes("/api/v3/games/") ||
  /game-server\.geoguessr\.com\/api\/(duels|battle-royale|live-challenge)\//.test(url);

export const initRoundTracker = () => {
  onFetch({
    match: ({ url }) => isGameApi(url),
    after: (_ctx, response) => {
      if (!response.ok) return;
      response
        .clone()
        .json()
        .then(handleGamePayload)
        .catch(() => {});
    },
  });

  onXhr({
    match: ({ method, url }) =>
      method === "POST" && url.includes("maps.googleapis.com") && /GetMetadata|SingleImageSearch/.test(url),
    after: (_ctx, _xhr, text) => {
      handleStreetViewMetadata(text);
    },
  });
};
