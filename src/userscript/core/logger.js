const PREFIX = "%c[GhostGuessr]";
const STYLE = "color:#a78bfa;font-weight:700";

/** Namespaced console logger: `const log = createLogger("Map"); log.info(...)`. */
export const createLogger = (scope) => {
  const tag = scope ? `${PREFIX}%c ${scope}` : PREFIX;
  const scopeStyle = "color:inherit;font-weight:600";
  const args = scope ? [tag, STYLE, scopeStyle] : [tag, STYLE];
  return {
    debug: (...rest) => console.debug(...args, ...rest),
    info: (...rest) => console.log(...args, ...rest),
    warn: (...rest) => console.warn(...args, ...rest),
    error: (...rest) => console.error(...args, ...rest),
  };
};

export const log = createLogger();
