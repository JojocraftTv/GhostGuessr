(function () {
  "use strict";

  const GG = window.GhostGuessr;

  let scorePredictorElement = null;

  function calculateDistance(lat1, lng1, lat2, lng2) {
    try {
      if (typeof google !== 'undefined' && google.maps && google.maps.geometry) {
        const point1 = new google.maps.LatLng(lat1, lng1);
        const point2 = new google.maps.LatLng(lat2, lng2);
        const distanceInMeters = google.maps.geometry.spherical.computeDistanceBetween(point1, point2);
        return distanceInMeters / 1000;
      }
    } catch (e) {
      console.warn('[GG Score Predictor] Google Maps geometry not available, using fallback');
    }
    
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLng / 2) * Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }


  let lastGameToken = null;
  GG.currentMapData = { maxErrorDistance: 14916862 };

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

  function calculateScore(distanceKm) {
    if (distanceKm === 0) return 5000;
    
    // GeoGuessr Formula: 5000 * e^(-10 * distance / mapSize)
    const mapSize = (GG.currentMapData?.maxErrorDistance || 14916862) / 1000;
    
    const score = Math.round(5000 * Math.exp(-10 * distanceKm / mapSize));
    return Math.max(0, Math.min(5000, score)); // score can be slightly off
  }

  function formatDistance(km) {
    if (km < 1) {
      return `${Math.round(km * 1000)} m`;
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

  function updateScorePredictor(guessLat, guessLng) {
    if (!GG.settings.showScorePredictor) return;

    if (GG.currentRoundId && GG.currentRoundId !== lastGameToken) {
      lastGameToken = GG.currentRoundId;
      fetchMapDetails(lastGameToken);
    }

    const refLat = GG.initialCoords.lat || GG.coords.lat;
    const refLng = GG.initialCoords.lng || GG.coords.lng;
    if (!refLat || !refLng) return;

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

    if (GG._scorePredictorObserver) return;

    function updateFromMarker() {
      const guessMarker = document.querySelector('[data-qa="guess-marker"]') || 
                          document.querySelector('[class*="map-pin_mapPin__"]');
      
      if (guessMarker && GG.settings.showScorePredictor && GG.coords.lat && GG.coords.lng) {
        const gmap = GG.getGoogleMap();
        if (!gmap) {
             return;
        }

        try {
          const bounds = gmap.getBounds();
          if (!bounds) return;

          let guessLat = null;
          let guessLng = null;

          const findReactProps = (dom) => {
            const key = Object.keys(dom).find(k => k.startsWith('__reactFiber$'));
            return key ? dom[key] : null;
          };

          const fiber = findReactProps(guessMarker);
          let current = fiber;
          
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
              updateScorePredictor(guessLat, guessLng);
          }
        } catch (e) {
          console.error('[GG Score Predictor] Error calculating position:', e);
          hideScorePredictor();
        }
      } else {
        hideScorePredictor();
      }
    }

    const debouncedUpdate = () => {
      requestAnimationFrame(updateFromMarker);
    };

    const observer = new MutationObserver(debouncedUpdate);

    const guessMapContainer = document.querySelector('[class*="guess-map_"]') || mapContainer;
    
    observer.observe(guessMapContainer, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['style', 'class']
    });

    GG._scorePredictorObserver = observer;
    GG.checkScorePredictor = updateFromMarker;

    const gmap = GG.getGoogleMap();
    if (gmap && !GG._scorePredictorMapListeners) {
      GG._scorePredictorMapListeners = true;
      
      gmap.addListener('idle', debouncedUpdate);
      gmap.addListener('click', debouncedUpdate);
      gmap.addListener('drag', debouncedUpdate);
    }

    function setupMarkerObserver() {
      if (GG._markerPositionObserver) return;
      
      const guessMarker = document.querySelector('[data-qa="guess-marker"]') || 
                          document.querySelector('[class*="map-pin_mapPin__"]');
      
      if (guessMarker && guessMarker.parentElement) {
        const markerParent = guessMarker.parentElement;
        
        GG._markerPositionObserver = new MutationObserver(debouncedUpdate);
        
        GG._markerPositionObserver.observe(markerParent, {
          attributes: true,
          attributeFilter: ['style']
        });
      }
    }

    const mainObserver = new MutationObserver(() => {
      if (!GG._markerPositionObserver) {
        setupMarkerObserver();
        debouncedUpdate();
      }
    });
    
    mainObserver.observe(guessMapContainer, {
      childList: true,
      subtree: true
    });
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
