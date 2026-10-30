/**
 * Minimal synchronous event bus shared by all modules.
 *
 * Events used across the app:
 *   settings:change  { key, value, previous }
 *   round:start      { roundId, roundNumber, origin }
 *   location:update  { lat, lng }
 *   guess:update     { lat, lng } | null
 *   marker:toggle    { enabled }
 *   rage:pin         (none) — place the guess pin now
 *   update:notice    { text, linkLabel?, url? } | null
 */
const listeners = new Map();

export const on = (event, handler) => {
  if (!listeners.has(event)) listeners.set(event, new Set());
  listeners.get(event).add(handler);
  return () => off(event, handler);
};

export const off = (event, handler) => {
  const set = listeners.get(event);
  if (set) set.delete(handler);
};

export const emit = (event, payload) => {
  const set = listeners.get(event);
  if (!set) return;
  for (const handler of Array.from(set)) {
    try {
      handler(payload);
    } catch (error) {
      console.error(`[GhostGuessr] handler for "${event}" failed`, error);
    }
  }
};
