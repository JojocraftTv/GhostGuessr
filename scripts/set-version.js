#!/usr/bin/env node
/*
 * Sets the version of the patcher (Cargo.toml, tauri.conf.json, package.json)
 * for a CI build, e.g. `node scripts/set-version.js 3.1.0-beta.42`.
 * The userscript version is passed to webpack via GG_VERSION instead.
 */
const fs = require("fs");
const path = require("path");

const version = process.argv[2];
if (!/^\d+\.\d+\.\d+(-[0-9A-Za-z.]+)?$/.test(version || "")) {
  console.error(`invalid version "${version}" (expected semver like 3.1.0 or 3.1.0-beta.42)`);
  process.exit(1);
}

const root = path.resolve(__dirname, "..");
const patcher = path.join(root, "src", "patcher");

const cargo = path.join(patcher, "src-tauri", "Cargo.toml");
fs.writeFileSync(cargo, fs.readFileSync(cargo, "utf8").replace(/^version\s*=\s*".*"$/m, `version = "${version}"`));

for (const file of [path.join(patcher, "src-tauri", "tauri.conf.json"), path.join(patcher, "package.json")]) {
  const json = JSON.parse(fs.readFileSync(file, "utf8"));
  json.version = version;
  fs.writeFileSync(file, `${JSON.stringify(json, null, 2)}\n`);
}
console.log(`patcher version -> ${version}`);
