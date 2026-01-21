(function () {
  "use strict";

  const GG = window.GhostGuessr;

  let scorePredictorElement = null;

  function calculateDistance(lat1, lng1, lat2, lng2) {
    try {
      if (typeof google !== 'undefined' && google.maps && google.maps.geometry) {
        const point1 = new google.maps.LatLng(lat1, lng1);
        const point2 = new google.maps.LatLng(lat2, lng2);
        return google.maps.geometry.spherical.computeDistanceBetween(point1, point2);
      }
    } catch (e) {
      console.warn('[GG Score Predictor] Google Maps geometry not available, using fallback');
    }
    
    const R = 6371000;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLng / 2) * Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }


  let lastFetchedGameToken = null;
  const DEFAULT_MAP_SIZE = 14916862;
  GG.currentMapData = { maxErrorDistance: DEFAULT_MAP_SIZE };

  async function fetchMapDetails(token) {
    if (!token) return;
    try {
      const gameResp = await fetch(`https://www.geoguessr.com/api/v3/games/${token}`);
      if (!gameResp.ok) throw new Error(`Game fetch failed: ${gameResp.status}`);
      const gameData = await gameResp.json();
      
      const mapSlug = gameData.map;
      if (mapSlug) {
        const mapResp = await fetch(`https://www.geoguessr.com/api/maps/${mapSlug}`);
        if (!mapResp.ok) throw new Error(`Map fetch failed: ${mapResp.status}`);
        const mapData = await mapResp.json();
        
        if (mapData && typeof mapData.maxErrorDistance === 'number') {
          GG.currentMapData.maxErrorDistance = mapData.maxErrorDistance;
          console.log(`[GG Score Predictor] Map updated: ${mapData.name}, Size: ${mapData.maxErrorDistance}`);
        }
      }
    } catch (e) {
      console.warn('[GG Score Predictor] Failed to fetch map details:', e);
      GG.currentMapData.maxErrorDistance = 14916862;
    }
  }

  function calculateScore(distanceMeters) {
    if (distanceMeters === 0) return 5000;
    
    const mapSize = GG.currentMapData?.maxErrorDistance || DEFAULT_MAP_SIZE;
    const score = Math.round(5000 * Math.exp(-10 * distanceMeters / mapSize));
    
    return Math.max(0, Math.min(5000, score));
  }

  function formatDistance(meters) {
    const km = meters / 1000;
    
    if (km < 1) {
      return `${Math.round(meters)} m`;
    } else if (km < 10) {
      return `${km.toFixed(2)} km`;
    } else {
      return `${Math.round(km)} km`;
    }
  }

  function createScorePredictorUI() {
    if (scorePredictorElement) return;

    scorePredictorElement = document.createElement('div');
    scorePredictorElement.id = 'gg-score-predictor';
    scorePredictorElement.style.cssText = `
      position: absolute;
      bottom: 20px;
      left: 20px;
      width: auto;
      max-height: 20px;
      background: rgba(0, 0, 0, 0.7);
      color: white;
      border-radius: 8px;
      font-family: 'Arial', sans-serif;
      font-size: 12px;
      font-weight: 600;
      z-index: 1000;
      display: none;
      pointer-events: none;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.4);
      border: 2px solid rgba(255, 255, 255, 0.2);
      backdrop-filter: blur(10px);
      padding: 6px 12px;
      align-items: center;
      gap: 8px;
    `;

    const scoreText = document.createElement('span');
    scoreText.id = 'gg-score-text';
    scoreText.style.cssText = `
      font-size: 15px;
      font-weight: 700;
      background: linear-gradient(135deg, #FFD700, #FFA500);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
      white-space: nowrap;
    `;

    const distanceText = document.createElement('span');
    distanceText.id = 'gg-distance-text';
    distanceText.style.cssText = `
      font-size: 15px;
      color: #ffffff;
      font-weight: 700;
      white-space: nowrap;
    `;

    const separator = document.createElement('span');
    separator.id = 'gg-score-separator';
    separator.textContent = '|';
    separator.style.cssText = `
      color: rgba(255, 255, 255, 0.4);
      font-weight: 400;
      font-size: 14px;
      display: none;
    `;

    scorePredictorElement.appendChild(scoreText);
    scorePredictorElement.appendChild(separator);
    scorePredictorElement.appendChild(distanceText);
  }

  function updateScorePredictor(guessLat, guessLng, isUserMarker) {
    if (GG.currentRoundId && GG.currentRoundId !== lastFetchedGameToken) {
      lastFetchedGameToken = GG.currentRoundId;
      fetchMapDetails(lastFetchedGameToken);
    }

    const refLat = GG.initialCoords.lat || GG.coords.lat;
    const refLng = GG.initialCoords.lng || GG.coords.lng;
    if (!refLat || !refLng) return;

    if (GG.settings.showScorePredictor) {
      createScorePredictorUI();

      const distance = calculateDistance(refLat, refLng, guessLat, guessLng);
      const score = calculateScore(distance);

      const scoreTextEl = document.getElementById('gg-score-text');
      const distanceTextEl = document.getElementById('gg-distance-text');
      const separatorEl = document.getElementById('gg-score-separator');
      const displayMode = GG.settings.scorePredictorDisplay || 'both';

      if (scoreTextEl && distanceTextEl && separatorEl) {
        if (displayMode === 'score') {
          scoreTextEl.textContent = `~${score.toLocaleString()}`;
          distanceTextEl.style.display = 'none';
          separatorEl.style.display = 'none';
        } else if (displayMode === 'distance') {
          scoreTextEl.style.display = 'none';
          distanceTextEl.textContent = formatDistance(distance);
          distanceTextEl.style.display = 'block';
          separatorEl.style.display = 'none';
        } else {
          scoreTextEl.style.display = 'block';
          scoreTextEl.textContent = `~${score.toLocaleString()}`;
          distanceTextEl.textContent = formatDistance(distance);
          distanceTextEl.style.display = 'block';
          separatorEl.style.display = 'block';
        }

        if (score >= 4500) {
          scoreTextEl.style.background = 'linear-gradient(135deg, #00FF00, #32CD32)';
        } else if (score >= 3000) {
          scoreTextEl.style.background = 'linear-gradient(135deg, #FFD700, #FFA500)';
        } else if (score >= 1500) {
          scoreTextEl.style.background = 'linear-gradient(135deg, #FFA500, #FF6347)';
        } else {
          scoreTextEl.style.background = 'linear-gradient(135deg, #FF6347, #DC143C)';
        }
        scoreTextEl.style.webkitBackgroundClip = 'text';
        scoreTextEl.style.webkitTextFillColor = 'transparent';
        scoreTextEl.style.backgroundClip = 'text';
      }

      scorePredictorElement.style.display = 'flex';
    }

    if (typeof GG.updateConnectionLine === 'function') {
      GG.updateConnectionLine(guessLat, guessLng);
    }
  }

  function hideScorePredictor() {
    if (scorePredictorElement) {
      scorePredictorElement.style.display = 'none';
    }
  }

  GG.setupScorePredictorListeners = function() {
    const mapContainer = document.querySelector('[class*="guess-map_canvas__"]') ||
                        document.querySelector('[class*="run-game-guess-map-contents_canvas__"]') ||
                        document.querySelector('[data-qa="guess-map-canvas"]') ||
                        document.querySelector('.gm-style');
    
    if (!mapContainer) return;

    if (!scorePredictorElement || !mapContainer.contains(scorePredictorElement)) {
      createScorePredictorUI();
      if (scorePredictorElement) {
        mapContainer.appendChild(scorePredictorElement);
      }
    }

    if (GG._isMapClickHandlerInstalled) return;

    let lastUpdateTime = 0;
    const UPDATE_THROTTLE = 50;

    function updateFromMarkerPosition() {
      const now = performance.now();
      if (now - lastUpdateTime < UPDATE_THROTTLE) {
        return;
      }
      lastUpdateTime = now;

      const guessMarkers = Array.from(document.querySelectorAll('[data-qa="guess-marker"], [class*="map-pin_mapPin__"]'));
      
      if (guessMarkers.length === 0) {
        hideScorePredictor();
        return;
      }

      if (!GG.settings.showScorePredictor && !GG.settings.showConnectionLine) {
        hideScorePredictor();
        return;
      }

      const gmap = GG.getGoogleMap();
      if (!gmap) return;

      const refLat = GG.initialCoords.lat || GG.coords.lat;
      const refLng = GG.initialCoords.lng || GG.coords.lng;
      if (!refLat || !refLng) return;

      try {
        const bounds = gmap.getBounds();
        if (!bounds) return;

        const findReactProps = (dom) => {
          const key = Object.keys(dom).find(k => k.startsWith('__reactFiber$'));
          return key ? dom[key] : null;
        };

        let nearestMarker = null;
        let nearestDistance = Infinity;

        for (const guessMarker of guessMarkers) {
          const fiber = findReactProps(guessMarker);
          let current = fiber;
          let guessLat = null;
          let guessLng = null;
          
          while (current) {
            const props = current.memoizedProps;
            if (props) {
              if (props.lat && props.lng) {
                guessLat = props.lat;
                guessLng = props.lng;
                break;
              }
              if (props.position && (props.position.lat || props.position.lng)) {
                guessLat = typeof props.position.lat === 'function' ? props.position.lat() : props.position.lat;
                guessLng = typeof props.position.lng === 'function' ? props.position.lng() : props.position.lng;
                break;
              }
            }
            current = current.return;
          }

          if (guessLat === null || guessLng === null) {
            const markerRect = guessMarker.getBoundingClientRect();
            const mapRect = mapContainer.getBoundingClientRect();
            
            if (markerRect.width > 0 && mapRect.width > 0) {
              const relX = (markerRect.left + markerRect.width / 2 - mapRect.left) / mapRect.width;
              const relY = (markerRect.top + markerRect.height / 2 - mapRect.top) / mapRect.height;
              
              const ne = bounds.getNorthEast();
              const sw = bounds.getSouthWest();
              
              guessLng = sw.lng() + (ne.lng() - sw.lng()) * relX;
              guessLat = ne.lat() - (ne.lat() - sw.lat()) * relY;
            }
          }

          if (guessLat !== null && guessLng !== null) {
            const distance = calculateDistance(refLat, refLng, guessLat, guessLng);
            if (distance < nearestDistance) {
              nearestDistance = distance;
              nearestMarker = { lat: guessLat, lng: guessLng };
            }
          }
        }

        if (nearestMarker) {
          updateScorePredictor(nearestMarker.lat, nearestMarker.lng, true);
        }
      } catch (e) {
        console.warn('[GG Score Predictor] Error updating from marker position:', e);
      }
    }

    function installMapClickHandler() {
      const guessMapElement = document.querySelector('[class*="guess-map_canvas__"]') ||
                             document.querySelector('[class*="run-game-guess-map-contents_canvas__"]');
      
      if (!guessMapElement) {
        setTimeout(installMapClickHandler, 500);
        return;
      }

      try {
        const reactKeys = Object.keys(guessMapElement);
        const reactKey = reactKeys.find(key => key.startsWith("__reactFiber$"));
        
        if (!reactKey) {
          setTimeout(installMapClickHandler, 500);
          return;
        }

        const elementProps = guessMapElement[reactKey];
        
        if (!elementProps?.return?.return?.memoizedProps?.map?.__e3_?.click) {
          setTimeout(installMapClickHandler, 500);
          return;
        }

        const mapElementClick = elementProps.return.return.memoizedProps.map.__e3_.click;
        const mapElementPropKey = Object.keys(mapElementClick)[0];
        const mapClickProps = mapElementClick[mapElementPropKey];
        const mapClickPropKeys = Object.keys(mapClickProps);

        for (let i = 0; i < mapClickPropKeys.length; i++) {
          const originalHandler = mapClickProps[mapClickPropKeys[i]];
          
          if (typeof originalHandler === "function") {
            mapClickProps[mapClickPropKeys[i]] = function(latLngWrapper) {
              const result = originalHandler.call(this, latLngWrapper);
              return result;
            };
            
            console.log('[GG Score Predictor] Successfully installed map click handler');
            GG._isMapClickHandlerInstalled = true;
          }
        }
      } catch (e) {
        console.error('[GG Score Predictor] Error installing map click handler:', e);
        setTimeout(installMapClickHandler, 1000);
      }
    }

    installMapClickHandler();

    const gmap = GG.getGoogleMap();
    if (gmap && !GG._areGoogleMapListenersInstalled) {
      GG._areGoogleMapListenersInstalled = true;
      
      const triggerUpdate = () => {
        setTimeout(() => {
          lastUpdateTime = 0;
          updateFromMarkerPosition();
        }, 10);
      };
      
      ['click', 'mouseup', 'mouseover', 'mouseout', 'mousemove'].forEach(eventName => {
        gmap.addListener(eventName, triggerUpdate);
      });
    }
  };

  GG.toggleScorePredictor = function() {
    GG.settings.showScorePredictor = !GG.settings.showScorePredictor;
    GG.saveSettings();
    
    if (!GG.settings.showScorePredictor) {
      hideScorePredictor();
    }
  };

  console.log("[GG Score Predictor] Initialized");
})();
