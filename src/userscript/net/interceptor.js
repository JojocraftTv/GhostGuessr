import { pageWindow } from "../core/env.js";
import { createLogger } from "../core/logger.js";

/**
 * Single network interception layer.
 *
 * Instead of every feature wrapping `fetch` / `XMLHttpRequest` on its own
 * (which stacks wrappers and makes ordering bugs likely), features register
 * hooks here. The page APIs are patched exactly once.
 *
 * Fetch hook:
 *   {
 *     match(ctx) -> boolean,
 *     before?(ctx) -> Response | void | Promise<...>   // short-circuit with a Response
 *     after?(ctx, response) -> Response | void | Promise<...> // replace / observe response
 *   }
 * XHR hook:
 *   {
 *     match(ctx) -> boolean,
 *     before?(ctx, xhr, body) -> string | void | Promise<string|void> // fake a response body
 *     after?(ctx, xhr, text) -> string | void            // replace / observe responseText
 *     rewriteUrl?(url) -> string                         // change the request URL
 *   }
 * `ctx` = { url, path, method, init?, input? }
 */

const log = createLogger("Net");
const fetchHooks = [];
const xhrHooks = [];

export const toPath = (url) => {
  const raw = String(url || "");
  try {
    return new URL(raw, window.location.origin).pathname;
  } catch {
    return raw.split("?")[0];
  }
};

export const onFetch = (hook) => {
  fetchHooks.push(hook);
  return () => fetchHooks.splice(fetchHooks.indexOf(hook), 1);
};

export const onXhr = (hook) => {
  xhrHooks.push(hook);
  return () => xhrHooks.splice(xhrHooks.indexOf(hook), 1);
};

export const jsonResponse = (data, init = {}) =>
  new Response(typeof data === "string" ? data : JSON.stringify(data), {
    status: 200,
    ...init,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      ...(init.headers || {}),
    },
  });

/** Unhooked fetch — use for requests GhostGuessr makes itself. */
export let nativeFetch = pageWindow.fetch ? pageWindow.fetch.bind(pageWindow) : null;

const matching = (hooks, ctx) =>
  hooks.filter((hook) => {
    try {
      return hook.match(ctx);
    } catch {
      return false;
    }
  });

const installFetch = () => {
  const original = pageWindow.fetch;
  if (typeof original !== "function" || original.__ggHooked) return;
  nativeFetch = original.bind(pageWindow);

  const hooked = async function (input, init) {
    const url = typeof input === "string" ? input : input && input.url ? input.url : String(input || "");
    const method = String((init && init.method) || (input && input.method) || "GET").toUpperCase();
    const ctx = { url, path: toPath(url), method, input, init };
    const hooks = matching(fetchHooks, ctx);

    if (!hooks.length) return original.apply(this, arguments);

    for (const hook of hooks) {
      if (!hook.before) continue;
      try {
        const early = await hook.before(ctx);
        if (early instanceof Response) return early;
      } catch (error) {
        log.warn("fetch before-hook failed", error);
      }
    }

    let response = await original.call(this, ctx.input, ctx.init);

    for (const hook of hooks) {
      if (!hook.after) continue;
      try {
        const replaced = await hook.after(ctx, response);
        if (replaced instanceof Response) response = replaced;
      } catch (error) {
        log.warn("fetch after-hook failed", error);
      }
    }
    return response;
  };
  hooked.__ggHooked = true;
  pageWindow.fetch = hooked;
};

/** Makes an XHR look like it completed with `text` without hitting the network. */
export const fakeXhrResponse = (xhr, text, status = 200) => {
  const define = (name, value) => Object.defineProperty(xhr, name, { configurable: true, value });
  define("readyState", 4);
  define("status", status);
  define("statusText", "OK");
  define("responseText", text);
  define("response", xhr.responseType === "json" ? safeJson(text) : text);
  for (const type of ["readystatechange", "load", "loadend"]) {
    xhr.dispatchEvent(new Event(type));
    const handler = xhr[`on${type}`];
    if (typeof handler === "function") {
      try {
        handler.call(xhr, new Event(type));
      } catch {}
    }
  }
};

const safeJson = (text) => {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
};

const installXhr = () => {
  const XHR = pageWindow.XMLHttpRequest;
  if (!XHR || XHR.prototype.__ggHooked) return;
  const proto = XHR.prototype;
  const originalOpen = proto.open;
  const originalSend = proto.send;

  const applyAfterHooks = (xhr, meta) => {
    if (xhr.readyState !== 4 || meta.done) return;
    meta.done = true;
    let text;
    try {
      text = xhr.responseText;
    } catch {
      return; // responseType is not text-based
    }
    for (const hook of meta.hooks) {
      if (!hook.after) continue;
      try {
        const replaced = hook.after(meta.ctx, xhr, text);
        if (typeof replaced === "string" && replaced !== text) {
          text = replaced;
          Object.defineProperty(xhr, "responseText", { configurable: true, value: text });
          Object.defineProperty(xhr, "response", {
            configurable: true,
            value: xhr.responseType === "json" ? safeJson(text) : text,
          });
        }
      } catch (error) {
        log.warn("xhr after-hook failed", error);
      }
    }
  };

  proto.open = function (method, url) {
    const ctx = { method: String(method || "GET").toUpperCase(), url: String(url || "") };
    ctx.path = toPath(ctx.url);
    const meta = { ctx, hooks: matching(xhrHooks, ctx), done: false };
    this.__gg = meta;

    // Registered in open() so we run before handlers the page attaches afterwards.
    if (meta.hooks.some((hook) => hook.after)) {
      this.addEventListener("readystatechange", () => applyAfterHooks(this, meta));
    }

    const args = Array.from(arguments);
    for (const hook of meta.hooks) {
      if (hook.rewriteUrl) ctx.url = hook.rewriteUrl(ctx.url) || ctx.url;
    }
    args[1] = ctx.url;
    return originalOpen.apply(this, args);
  };

  proto.send = function (body) {
    const meta = this.__gg;
    const beforeHooks = meta ? meta.hooks.filter((hook) => hook.before) : [];
    if (!beforeHooks.length) return originalSend.apply(this, arguments);
    const args = arguments;

    (async () => {
      for (const hook of beforeHooks) {
        try {
          const fake = await hook.before(meta.ctx, this, body);
          if (typeof fake === "string") {
            meta.done = true;
            fakeXhrResponse(this, fake);
            return;
          }
        } catch (error) {
          log.warn("xhr before-hook failed", error);
        }
      }
      originalSend.apply(this, args);
    })();
  };

  proto.__ggHooked = true;
};

let installed = false;

export const installInterceptor = () => {
  if (installed) return;
  installed = true;
  installFetch();
  installXhr();
};
