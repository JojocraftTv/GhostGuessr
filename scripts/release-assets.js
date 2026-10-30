#!/usr/bin/env node
/*
 * Turns the webpack output into release assets.
 *
 *   GG_CHANNEL=beta GG_VERSION=3.1.0-beta.42 pnpm build
 *   node scripts/release-assets.js <stable|beta> <version> [outDir=release]
 *
 * Writes:
 *   ghostguessr-core.user.js   the script (@require'd by the installer, downloaded by the Steam loader)
 *   GhostGuessr.user.js        installable userscript (stable)   -> self-updates from releases/latest
 *   GhostGuessr.beta.user.js   installable userscript (beta)     -> self-updates from the rolling "beta" release
 *   version.json               { version, channel } for update checks
 */
const fs = require("fs");
const path = require("path");

const [channel, version, outDir = "release"] = process.argv.slice(2);
if (!["stable", "beta"].includes(channel) || !version) {
  console.error("usage: release-assets.js <stable|beta> <version> [outDir]");
  process.exit(1);
}

const ROOT = path.resolve(__dirname, "..");
const RELEASES = "https://github.com/JojocraftTv/GhostGuessr/releases";
const installer = channel === "stable" ? "GhostGuessr.user.js" : "GhostGuessr.beta.user.js";
const installerUrl = channel === "stable" ? `${RELEASES}/latest/download/${installer}` : `${RELEASES}/download/beta/${installer}`;

const read = (file) => fs.readFileSync(path.join(ROOT, "dist", file), "utf8");
const core = read("ghostguessr-core.user.js");
let proxy = read("ghostguessr-core.proxy.user.js");

if (!core.includes(`@version ${version}`)) {
  console.error(`dist/ghostguessr-core.user.js is not version ${version} (build with GG_VERSION=${version})`);
  process.exit(1);
}

// Tampermonkey re-downloads @require'd files when the installer's @version changes,
// so the installer must self-update from the release it belongs to.
proxy = proxy.replace(
  "// ==/UserScript==",
  `// @updateURL ${installerUrl}\n// @downloadURL ${installerUrl}\n// ==/UserScript==`,
);

const out = path.resolve(ROOT, outDir);
fs.mkdirSync(out, { recursive: true });
fs.writeFileSync(path.join(out, "ghostguessr-core.user.js"), core);
fs.writeFileSync(path.join(out, installer), proxy);
fs.writeFileSync(path.join(out, "version.json"), JSON.stringify({ version, channel }, null, 2));
console.log(`release assets (${channel} ${version}) -> ${path.relative(ROOT, out)}: ghostguessr-core.user.js, ${installer}, version.json`);
