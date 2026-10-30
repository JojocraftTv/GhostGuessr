import { settings, set, update, watch } from "../core/settings.js";
import { isSteam } from "../core/env.js";
import { nativeFetch } from "../net/interceptor.js";
import { createLogger } from "../core/logger.js";

/**
 * Auto-claims the daily shop reward and unclaimed level rewards (web only).
 */

const log = createLogger("Rewards");
const API = "https://www.geoguessr.com/api";
let ranThisSession = false;

const request = (path, method = "GET") => {
  const doFetch = nativeFetch || window.fetch.bind(window);
  return doFetch(`${API}${path}`, {
    method,
    credentials: "include",
    headers: method === "GET" ? undefined : { "Content-Type": "application/json" },
    body: method === "GET" ? undefined : "{}",
  });
};

const claimDailyShop = async () => {
  const next = Date.parse(settings.dailyShopNextClaimAt || "");
  if (!Number.isNaN(next) && Date.now() < next) return;
  const response = await request("/v4/webshop/daily-shop-claim", "POST");
  const data = await response.json().catch(() => null);
  if (data && data.nextPossibleClaim) set("dailyShopNextClaimAt", data.nextPossibleClaim);
};

const claimLevels = async () => {
  const data = await (await request("/v3/profiles/")).json().catch(() => null);
  const user = data && data.user;
  if (!user || !user.progress) return;
  const lastClaimed = Number(user.lastClaimedLevel);
  const level = Number(user.progress.level);
  if (!Number.isFinite(lastClaimed) || !Number.isFinite(level) || level <= lastClaimed) return;
  for (let next = lastClaimed + 1; next <= level; next += 1) {
    const response = await request(`/v4/level/claim/${next}`, "POST").catch(() => null);
    if (response && response.ok) update({ lastClaimedLevel: next });
  }
};

export const claimRewards = async () => {
  if (isSteam || !settings.autoClaimRewards || ranThisSession) return;
  ranThisSession = true;
  await Promise.allSettled([claimDailyShop(), claimLevels()]).then((results) => {
    for (const result of results) if (result.status === "rejected") log.debug(result.reason);
  });
};

export const initRewards = () => {
  if (isSteam) return;
  watch("autoClaimRewards", ({ value }) => value && claimRewards());
  setTimeout(claimRewards, 3000);
};
