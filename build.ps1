param(
  [string]$OutFile = "dist/ghostguessr-core.user.js"
)

$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$scripts = @(
  "scripts/ghostguessr-state.js",
  "scripts/ghostguessr-utils.js",
  "scripts/ghostguessr-skinchanger.js",
  "scripts/ghostguessr-streamer.js",
  "scripts/ghostguessr-map.js",
  "scripts/ghostguessr-score-predictor.js",
  "scripts/ghostguessr-ui.js",
  "scripts/ghostguessr-settings.js",
  "scripts/ghostguessr-updater.js",
  "scripts/ghostguessr-main.js"
)

$outPath = Join-Path $root $OutFile
$outDir = Split-Path -Parent $outPath
if (!(Test-Path $outDir)) {
  New-Item -ItemType Directory -Force -Path $outDir | Out-Null
}

$header = @(
  "// ==UserScript==",
  "// @name         GhostGuessr (Auto-Build Version)",
  "// @namespace    https://github.com/JojocraftTv/GhostGuessr",
  "// @version      Auto-Build Version",
  "// @description  Marks your Current Streetview Location on the GeoGuessr Map with a Red Dot. Toggle with hotkey.",
  "// @author       VellusFox, Niceas",
  "// @match        https://www.geoguessr.com/*",
  "// @run-at       document-start",
  "// @inject-into  page",
  "// @icon         https://raw.githubusercontent.com/JojocraftTv/GhostGuessr/refs/heads/main/icons/GhostGuessr.png",
  "// @grant        GM_setValue",
  "// @grant        GM_getValue",
  "// @downloadURL  https://raw.githubusercontent.com/JojocraftTv/GhostGuessr/refs/heads/main/dist/ghostguessr-core.user.js",
  "// @updateURL    https://raw.githubusercontent.com/JojocraftTv/GhostGuessr/refs/heads/main/dist/ghostguessr-core.user.js",
  "// @license      MIT",
  "// ==/UserScript==",
  ""
)

$content = @()
$content += ($header -join "`n")
foreach ($rel in $scripts) {
  $path = Join-Path $root $rel
  if (!(Test-Path $path)) {
    throw "Missing input file: $rel"
  }
  $content += (Get-Content -Path $path -Raw)
  $content += "`n"
}

Set-Content -Path $outPath -Value ($content -join "`n") -NoNewline
Write-Output "Built $OutFile"
