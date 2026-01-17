# GhostGuessr

Marks your current street view location on the GeoGuessr map with a red dot. Toggled with a Hotkey.

## Preview

### Map

![Map with marker](preview/Map%20With.png)
![Map without marker](preview/Map%20Without.png)

### Toggle Button

![Toggle on](preview/Toggle%20With.png)
![Toggle off](preview/Toggle%20Without.png)

### Settings

![Settings panel](preview/Settings.png)

## Steam Patcher

Patches the Steam GeoGuessr app.asar to inject the GhostGuessr script and optional DevTools.

### Features

- One-click patch/uninstall (restores from `app.asar.bak`)
- Auto-detects Steam install location
- Optional GeoGuessr DevTools toggle

### Screenshots

![Patcher main](preview/Patcher%20Main.png)
![Patcher settings](preview/Patcher%20Settings.png)
![Steam settings](preview/Settings%20Steam.png)

### Build

From the repo root:

```
cd steam/patcher/src-tauri
cargo tauri build
```

### Run (dev)

```
cd steam/patcher/src-tauri
cargo tauri dev
```

### Usage

1. Launch the patcher.
2. If needed, set the GeoGuessr game folder.
3. Click `Patch`.
4. Use `Uninstall` to restore from backup.

### Troubleshooting (Steam Patcher)

- `Tauri runtime missing`: start the EXE or `cargo tauri dev`, not the HTML file.
- `Resources path not found`: select the game folder (e.g. `...\GeoGuessr Duels`), not `resources`.
- `app.asar not found`: verify the game is installed and the path is correct.
- `Patch failed` after updates: click `Uninstall` (restores backup), then patch again.
- DevTools not opening: enable the DevTools toggle and re-patch.
- Build errors after moving folders: delete `steam/patcher/src-tauri/target` and rebuild.
- Blank window: install/update Microsoft Edge WebView2 Runtime.

## Installation (Chrome + Tampermonkey)

### Step 1: Enable Developer Mode in Chrome

1. Open Chrome and go to `chrome://extensions/`
2. Toggle "Developer mode" ON (top right corner)
3. Keep this tab open for the next steps

### Step 2: Install Tampermonkey

1. Go to the Chrome Web Store: [Here](https://chrome.google.com/webstore/detail/tampermonkey/dhdgffkkebhmkfjojejmpbldmpobfkfo)
2. Click "Add to Chrome"
3. Click "Add extension" when prompted
4. Tampermonkey icon will appear in your toolbar

### Step 3: Install GhostGuessr Script

1. Click this install link: [Script](https://raw.githubusercontent.com/JojocraftTv/GhostGuessr/refs/heads/main/script.user.js)
2. Tampermonkey will open - click "Install"
3. The script is now installed and active

## Usage

1. Play GeoGuessr (any game mode)
2. Press '1' to toggle red marker on/off
3. The Red Dot will apear on the Map. :)

## How It Works

Intercepts coordinate data from GeoGuessr's Google Maps API calls and places a marker at those coordinates.

## Requirements

- Chrome browser
- Tampermonkey extension

## Troubleshooting

Marker not showing? Ensure you're on map view and location is loaded. Press '1' again.
No Tampermonkey icon? Check `chrome://extensions/` and ensure Tampermonkey is enabled.

## Disclaimer

This script is provided for educational and personal use only. The author is not responsible for any consequences resulting from the use of this script. Users assume all risks associated with installation and usage.

Use of this script may violate GeoGuessr's Terms of Service. It is the user's responsibility to review and comply with all applicable terms and conditions. The author does not endorse or encourage cheating, and this tool should only be used in accordance with GeoGuessr's rules and policies.

The script intercepts network data to function. No personal data is collected, stored, or transmitted by this script. All processing occurs locally in your browser.

By installing and using this script, you acknowledge that you understand these risks and agree to use it at your own discretion.
