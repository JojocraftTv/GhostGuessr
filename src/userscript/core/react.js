import { pageWindow } from "./env.js";

/**
 * Helpers to reach into GeoGuessr's React app from the outside.
 * Used to refresh data the app already cached in memory (React Query / SWR).
 */

const MAX_FIBERS = 40000;

/** Root fibers of all React trees on the page. */
const rootFibers = () => {
  const roots = [];
  const candidates = [document.getElementById("__next"), document.body, ...Array.from(document.body ? document.body.children : [])];
  for (const el of candidates) {
    if (!el) continue;
    const key = Object.keys(el).find((k) => k.startsWith("__reactContainer$"));
    if (key && el[key]) roots.push(el[key].stateNode && el[key].stateNode.current ? el[key].stateNode.current : el[key]);
  }
  return roots;
};

/** Depth-first walk over fibers; stops when `visit` returns true. */
export const walkFibers = (visit) => {
  let seen = 0;
  for (const root of rootFibers()) {
    const stack = [root];
    while (stack.length && seen < MAX_FIBERS) {
      const fiber = stack.pop();
      seen += 1;
      if (visit(fiber)) return;
      if (fiber.sibling) stack.push(fiber.sibling);
      if (fiber.child) stack.push(fiber.child);
    }
  }
};

const isQueryClient = (v) => !!v && typeof v.invalidateQueries === "function" && typeof v.getQueryCache === "function";
const isSwrConfig = (v) => !!v && typeof v === "object" && v.cache && typeof v.cache.keys === "function" && typeof v.mutate === "function";

/** Data caches used by the app: React Query clients and SWR configs. */
export const findDataCaches = () => {
  const queryClients = new Set();
  const swr = new Set();
  walkFibers((fiber) => {
    const props = fiber.memoizedProps;
    if (props && typeof props === "object") {
      if (isQueryClient(props.client)) queryClients.add(props.client);
      if (isQueryClient(props.value)) queryClients.add(props.value);
      if (isSwrConfig(props.value)) swr.add(props.value);
    }
    return false;
  });
  return { queryClients: [...queryClients], swr: [...swr] };
};

/**
 * Marks cached entries whose key matches `pattern` as stale so the app
 * re-fetches them. Returns how many caches were touched.
 */
export const invalidateCachedData = (pattern) => {
  const { queryClients, swr } = findDataCaches();
  const matches = (key) => {
    try {
      return pattern.test(typeof key === "string" ? key : JSON.stringify(key));
    } catch {
      return false;
    }
  };
  for (const client of queryClients) {
    try {
      client.invalidateQueries({ predicate: (query) => matches(query.queryKey), refetchType: "all" });
    } catch {
      try {
        client.invalidateQueries();
      } catch {}
    }
  }
  for (const config of swr) {
    for (const key of Array.from(config.cache.keys())) {
      if (matches(key)) config.mutate(key);
    }
  }
  return queryClients.length + swr.length;
};

/** Soft re-render of the current route (Next.js), without reloading the page. */
export const softRefreshRoute = () => {
  const router = pageWindow.next && pageWindow.next.router;
  if (!router) return false;
  try {
    if (typeof router.refresh === "function") router.refresh(); // app router
    else router.replace(router.asPath, undefined, { scroll: false, shallow: false }); // pages router
    return true;
  } catch {
    return false;
  }
};
