param(
  [string]$OutFile = "dist/ghostguessr-core.user.js"
)

$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$scripts = @(
  "scripts/ghostguessr-state.js",
  "scripts/ghostguessr-utils.js",
  "scripts/ghostguessr-map.js",
  "scripts/ghostguessr-ui.js",
  "scripts/ghostguessr-settings.js",
  "scripts/ghostguessr-main.js"
)

$outPath = Join-Path $root $OutFile
$outDir = Split-Path -Parent $outPath
if (!(Test-Path $outDir)) {
  New-Item -ItemType Directory -Force -Path $outDir | Out-Null
}

$header = @(
  "// ==UserScript==",
  "// @name         GhostGuessr (Local Build)",
  "// @namespace    http://tampermonkey.net/",
  "// @version      TestBuild",
  "// @description  Marks your Current Streetview Location on the GeoGuessr Map with a Red Dot. Toggle with hotkey.",
  "// @author       VellusFox, Niceas",
  "// @match        https://www.geoguessr.com/*",
  "// @icon         https://raw.githubusercontent.com/JojocraftTv/GhostGuessr/refs/heads/main/icons/GhostGuessr.png",
  "// @grant        GM_setValue",
  "// @grant        GM_getValue",
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
