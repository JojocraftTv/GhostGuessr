/**
 * Makes our settings pages scrollable inside GeoGuessr's layouts.
 *
 * The Steam client renders the home/settings view as a fixed full-screen
 * layout: the page itself never scrolls and some containers swallow wheel
 * events. So our content gets
 *   - an explicit max-height that fits the remaining window space, and
 *   - its own wheel handling (we scroll it ourselves and keep the event from
 *     reaching GeoGuessr's handlers).
 */

const LINE_PX = 40;
const fitted = new Map(); // element -> bottom margin

const deltaPx = (event, el) => {
  if (event.deltaMode === 1) return event.deltaY * LINE_PX; // lines
  if (event.deltaMode === 2) return event.deltaY * el.clientHeight; // pages
  return event.deltaY;
};

/** Sets max-height so the element ends `margin` px above the window bottom. */
const fit = (el, margin) => {
  if (!el.isConnected || el.hidden) return;
  const top = el.getBoundingClientRect().top;
  el.style.maxHeight = `${Math.max(200, Math.floor(window.innerHeight - top - margin))}px`;
};

let resizeHooked = false;
const hookResize = () => {
  if (resizeHooked) return;
  resizeHooked = true;
  window.addEventListener("resize", () => {
    for (const [el, margin] of fitted) {
      if (!el.isConnected) fitted.delete(el);
      else fit(el, margin);
    }
  });
};

/**
 * @param {HTMLElement} el      scroll container
 * @param {object} options
 * @param {boolean} options.fitWindow  size el to the remaining window height
 * @param {number}  options.margin     space to keep below el (px)
 */
export const makeScrollable = (el, { fitWindow = false, margin = 24 } = {}) => {
  if (el.__ggScrollable) return el.__ggScrollable;
  el.classList.add("gg-scroll");

  el.addEventListener(
    "wheel",
    (event) => {
      if (event.ctrlKey) return; // pinch-zoom
      const max = el.scrollHeight - el.clientHeight;
      if (max <= 0) return;
      event.preventDefault();
      event.stopPropagation();
      el.scrollTop = Math.max(0, Math.min(max, el.scrollTop + deltaPx(event, el)));
    },
    { passive: false },
  );

  const refit = () => fitWindow && fit(el, margin);
  if (fitWindow) {
    fitted.set(el, margin);
    hookResize();
  }
  el.__ggScrollable = { refit };
  return el.__ggScrollable;
};
