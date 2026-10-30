/**
 * DOM helpers. `h()` builds elements declaratively:
 *   h("button", { class: "gg-btn", onClick: fn, dataset: { id: 1 } }, "Label")
 */
export const h = (tag, props = {}, ...children) => {
  const el = document.createElement(tag);
  for (const [key, value] of Object.entries(props || {})) {
    if (value === undefined || value === null || value === false) continue;
    if (key === "class" || key === "className") el.className = value;
    else if (key === "style" && typeof value === "object") Object.assign(el.style, value);
    else if (key === "dataset") Object.assign(el.dataset, value);
    else if (key === "html") el.innerHTML = value;
    else if (key.startsWith("on") && typeof value === "function") el.addEventListener(key.slice(2).toLowerCase(), value);
    else if (key in el && typeof value !== "string") el[key] = value;
    else el.setAttribute(key, value === true ? "" : value);
  }
  append(el, children);
  return el;
};

const append = (parent, children) => {
  for (const child of children.flat(Infinity)) {
    if (child === null || child === undefined || child === false) continue;
    parent.appendChild(child instanceof Node ? child : document.createTextNode(String(child)));
  }
};

/** Parses an SVG/HTML string into a single element. */
export const fromHTML = (markup) => {
  const template = document.createElement("template");
  template.innerHTML = markup.trim();
  return template.content.firstElementChild;
};

export const onReady = (fn) => {
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", fn, { once: true });
  else fn();
};

/**
 * Resolves once `document.body` exists. We run at document-start — on Steam
 * (page reloads) even before <html> exists — so observe the document node
 * itself, which is always there.
 */
let bodyPromise = null;
export const whenBody = () => {
  if (document.body) return Promise.resolve(document.body);
  if (!bodyPromise) {
    bodyPromise = new Promise((resolve) => {
      const done = () => {
        if (!document.body) return false;
        observer.disconnect();
        document.removeEventListener("DOMContentLoaded", done);
        resolve(document.body);
        return true;
      };
      const observer = new MutationObserver(done);
      observer.observe(document, { childList: true, subtree: true });
      document.addEventListener("DOMContentLoaded", done);
      done();
    });
  }
  return bodyPromise;
};

/** First element matching any of the selectors. */
export const queryFirst = (selectors, root = document) => {
  for (const selector of selectors) {
    const el = root.querySelector(selector);
    if (el) return el;
  }
  return null;
};

export const getClassByPrefix = (el, prefix) =>
  el ? Array.from(el.classList).find((name) => name.startsWith(prefix)) || null : null;

export const isVisible = (el) => !!el && el.isConnected && el.getClientRects().length > 0;

/**
 * One shared, throttled MutationObserver for the whole app. Modules register
 * callbacks that run at most once per animation frame after DOM changes.
 */
const domTasks = new Set();
// Menus are often shown by toggling attributes, not by adding nodes.
const OBSERVE = { childList: true, subtree: true, attributes: true, attributeFilter: ["style", "class", "hidden", "open"] };
let scheduled = false;
let observer = null;

const flush = () => {
  scheduled = false;
  for (const task of Array.from(domTasks)) {
    try {
      task();
    } catch (error) {
      console.error("[GhostGuessr] DOM task failed", error);
    }
  }
};

const schedule = () => {
  if (scheduled) return;
  scheduled = true;
  (window.requestAnimationFrame || setTimeout)(flush);
};

export const onDomChange = (task) => {
  domTasks.add(task);
  if (!observer && document.body) {
    observer = new MutationObserver(schedule);
    observer.observe(document.body, OBSERVE);
  }
  schedule();
  return () => domTasks.delete(task);
};

/** Starts the shared observer once the body exists. */
export const startDomObserver = async () => {
  await whenBody();
  if (observer) return;
  observer = new MutationObserver(schedule);
  observer.observe(document.body, OBSERVE);
  schedule();
};
