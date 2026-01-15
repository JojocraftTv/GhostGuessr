# GhostGuessr

Marks your current street view location on the GeoGuessr map with a red dot. Toggled with the key '1'.

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
