/**
 * Runtime (non-persisted) game state shared between features.
 */
export const state = {
  roundId: null,
  roundNumber: 0,
  /** Where the round started — the ghost marker position. */
  origin: { lat: 0, lng: 0 },
  /** Current Street View panorama position. */
  current: { lat: 0, lng: 0 },
  /** Timestamp of the last location update from Street View metadata. */
  lastLocationAt: 0,
  /** Current player guess on the map, if any. */
  guess: null,
  /** Max error distance of the current map (used for score prediction). */
  mapSize: 14916862,
};

export const hasPoint = (point) =>
  !!point && Number.isFinite(point.lat) && Number.isFinite(point.lng) && (point.lat !== 0 || point.lng !== 0);

export const hasOrigin = () => hasPoint(state.origin);
