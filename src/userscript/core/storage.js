/* global GM_getValue, GM_setValue */
import { hasGMStorage } from "./env.js";
import { createLogger } from "./logger.js";

const log = createLogger("Storage");

/** Key/value storage backed by GM storage (userscript) or localStorage (Steam). */
export const storage = {
  get(key, fallback = null) {
    if (hasGMStorage) {
      try {
        const value = GM_getValue(key, undefined);
        if (value !== undefined) return value;
      } catch (error) {
        log.warn("GM_getValue failed", error);
      }
    }
    try {
      const raw = window.localStorage.getItem(key);
      return raw === null ? fallback : JSON.parse(raw);
    } catch {
      return fallback;
    }
  },

  set(key, value) {
    if (hasGMStorage) {
      try {
        GM_setValue(key, value);
        return;
      } catch (error) {
        log.warn("GM_setValue failed", error);
      }
    }
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
    } catch (error) {
      log.warn("localStorage.setItem failed", error);
    }
  },

  remove(key) {
    this.set(key, null);
  },
};
