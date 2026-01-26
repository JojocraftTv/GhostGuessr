(function () {
  "use strict";

  const GG = window.GhostGuessr;

  function detectRoundId() {
    const url = window.location.href;
    const match = url.match(/\/game\/([^\/]+)/);
    return match ? match[1] : null;
  }
  
  const globalTarget = typeof unsafeWindow !== 'undefined' ? unsafeWindow : window;

  const newRoundFetch = globalTarget.fetch;
  globalTarget.fetch = async function(...args) {
    let url = args[0];
    if (typeof url !== 'string' && url && url.url) {
        url = url.url;
    }
    url = url ? url.toString() : '';
    const isGameApi = url.includes('/api/v3/games/');
    
    const response = await newRoundFetch.apply(this, args);

    if (isGameApi && response.ok) {
        try {
            const clone = response.clone();
            clone.json().then(data => {
                if (!data) return;
                
                const newToken = data.token;
                const newRoundNumber = data.round;
                
                let shouldReset = false;
                let newCoords = null;

                if (data.rounds && Array.isArray(data.rounds) && data.rounds.length > 0) {
                     const currentRound = data.rounds[data.rounds.length - 1];
                     if (currentRound && typeof currentRound.lat === 'number' && typeof currentRound.lng === 'number') {
                         newCoords = { lat: currentRound.lat, lng: currentRound.lng };
                     }
                }
                
                if (newToken && newToken !== GG.currentRoundId) {
                    GG.currentRoundId = newToken;
                    GG.currentRoundNumber = newRoundNumber || 1;
                    shouldReset = true;
                } 
                else if (newRoundNumber && newRoundNumber !== GG.currentRoundNumber) {
                    GG.currentRoundNumber = newRoundNumber;
                    shouldReset = true;
                }
                
                if (shouldReset) {
                    const TIME_THRESHOLD = 3000;
                    const recentUpdate = (Date.now() - (GG.lastMapUpdate || 0)) < TIME_THRESHOLD;
                    
                    if (newCoords) {
                         GG.resetRoundState(newCoords);
                    } else if (recentUpdate) {
                         GG.resetRoundState(GG.initialCoords);
                    } else {
                         GG.resetRoundState();
                    }

                    if ((newCoords || recentUpdate) && GG.settings.enabled) {
                         GG.placeMarker();
                    }
                }
            }).catch(e => console.warn('[GG Round Detection] Failed to parse JSON:', e));
        } catch (e) {
            console.warn('[GG Round Detection] Error processing fetch:', e);
        }
    }
    
    return response;
  }

  const originalOpen = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function (method, url) {
    if (
      method.toUpperCase() === "POST" &&
      url.includes("maps.googleapis.com") &&
      (url.includes("GetMetadata") || url.includes("SingleImageSearch"))
    ) {
      this.addEventListener("load", function () {
        try {
          let result = this.responseText;
          let pattern = /-?\d+\.\d+,-?\d+\.\d+/g;
          let matches = result.match(pattern);
          if (matches && matches.length > 0) {
            let match = matches[0];
            let split = match.split(",");
            const newLat = Number.parseFloat(split[0]);
            const newLng = Number.parseFloat(split[1]);

            const isFirstCoords = !GG.initialCoords.lat || !GG.initialCoords.lng;

            let distanceKm = 0;
            if (GG.coords.lat && GG.coords.lng) {
                 distanceKm = GG.calculateDistance(GG.coords.lat, GG.coords.lng, newLat, newLng) / 1000;
            }
            
            if (newLat === 0 && newLng === 0) return;

            const currentUrlId = detectRoundId();
            const isUrlChanged = currentUrlId && currentUrlId !== GG.currentRoundId;
            const isSignificantJump = distanceKm > 20; 

            if (isUrlChanged || isSignificantJump) {
                 
                 GG.resetRoundState({ lat: newLat, lng: newLng });
                 if (currentUrlId) GG.currentRoundId = currentUrlId;
                 
                 GG.lastMapUpdate = Date.now();
            } else if (isFirstCoords) {
              GG.initialCoords.lat = newLat;
              GG.initialCoords.lng = newLng;
              GG.lastMapUpdate = Date.now();
            }

            GG.coords.lat = newLat;
            GG.coords.lng = newLng;
            
            if (GG.settings.enabled) {
                if (!GG.gmap) GG.gmap = GG.getGoogleMap();
                GG.placeMarker();
            }
          }
        } catch (e) {}
      });
    }
    return originalOpen.apply(this, arguments);
  };

  GG.getGoogleMap = function () {
    let container = GG.getMapContainer();

    if (!container) return null;

    if (GG.gmap && GG.gmap.getDiv && GG.gmap.getDiv() === container) {
      return GG.gmap;
    }
    
    GG.gmap = null;
    try {
      let fiber = GG.findReactFiber(container);
      if (fiber) {
        let current = fiber;
        while (current) {
          if (
            current.memoizedProps &&
            current.memoizedProps.map &&
            typeof current.memoizedProps.map.setCenter === "function" &&
            typeof current.memoizedProps.map.getDiv === "function"
          ) {
            GG.gmap = current.memoizedProps.map;
            return GG.gmap;
          }
          current = current.return;
        }
      }
    } catch (e) {}
    return null;
  };

  GG.createMarker = function () {
    if (!GG.initialCoords.lat || !GG.initialCoords.lng) return;
    GG.gmap = GG.getGoogleMap();
    if (!GG.gmap) return;
    if (GG.marker) {
      GG.marker.setMap(null);
      GG.marker = null;
    }
    try {
      if (GG.isGoogleMapsAvailable()) {
        let position = new google.maps.LatLng(GG.initialCoords.lat, GG.initialCoords.lng);
        let icon = {
          path: google.maps.SymbolPath.CIRCLE,
          fillColor: GG.hexToRgba(GG.settings.markerColor, GG.settings.opacity),
          fillOpacity: 1,
          strokeColor: GG.settings.outlineColor,
          strokeWeight: GG.settings.outlineWidth,
          scale: GG.settings.size,
        };
        GG.marker = new google.maps.Marker({
          position: position,
          map: GG.gmap,
          icon: icon,
          opacity: GG.settings.opacity,
          zIndex: 999,
          optimized: false,
          clickable: false,
          draggable: false,
        });

        if (GG.marker) {
          google.maps.event.clearListeners(GG.marker, "click");
          google.maps.event.clearListeners(GG.marker, "mousedown");
          google.maps.event.clearListeners(GG.marker, "mouseup");
        }
      }
    } catch (e) {
      GG.createDivMarker();
    }
  };

  GG.updateMarkerStyle = function () {
    if (!GG.marker || !GG.marker.setIcon) return;

    try {
      if (GG.isGoogleMapsAvailable()) {
        let icon = {
          path: google.maps.SymbolPath.CIRCLE,
          fillColor: GG.hexToRgba(GG.settings.markerColor, GG.settings.opacity),
          fillOpacity: 1,
          strokeColor: GG.settings.outlineColor,
          strokeWeight: GG.settings.outlineWidth,
          scale: GG.settings.size,
        };
        GG.marker.setIcon(icon);
        GG.marker.setOpacity(GG.settings.opacity);
      }
    } catch (e) {}

    GG.updateStreetviewMarkerStyle();
  };

  GG.createStreetviewMarker = function () {
    if (!GG.coords.lat || !GG.coords.lng) return;
    GG.gmap = GG.getGoogleMap();
    if (!GG.gmap) return;
    if (GG.streetviewMarker) {
      GG.streetviewMarker.setMap(null);
      GG.streetviewMarker = null;
    }
    try {
      if (GG.isGoogleMapsAvailable()) {
        const opacity = GG.settings.streetviewMarkerOpacity ?? GG.settings.opacity;
        let position = new google.maps.LatLng(GG.coords.lat, GG.coords.lng);
        let icon = {
          path: google.maps.SymbolPath.CIRCLE,
          fillColor: GG.hexToRgba(GG.settings.streetviewMarkerColor, opacity),
          fillOpacity: 1,
          strokeColor: GG.settings.streetviewMarkerOutline,
          strokeWeight: GG.settings.streetviewMarkerOutlineWidth ?? GG.settings.outlineWidth,
          scale: GG.settings.streetviewMarkerSize,
        };
        GG.streetviewMarker = new google.maps.Marker({
          position: position,
          map: GG.gmap,
          icon: icon,
          opacity: opacity,
          zIndex: 997,
          optimized: false,
          clickable: false,
          draggable: false,
        });
      }
    } catch (e) {}
  };

  GG.updateStreetviewMarkerStyle = function () {
    if (!GG.streetviewMarker || !GG.streetviewMarker.setIcon) return;

    try {
      if (GG.isGoogleMapsAvailable()) {
        const opacity = GG.settings.streetviewMarkerOpacity ?? GG.settings.opacity;
        let icon = {
          path: google.maps.SymbolPath.CIRCLE,
          fillColor: GG.hexToRgba(GG.settings.streetviewMarkerColor, opacity),
          fillOpacity: 1,
          strokeColor: GG.settings.streetviewMarkerOutline,
          strokeWeight: GG.settings.streetviewMarkerOutlineWidth ?? GG.settings.outlineWidth,
          scale: GG.settings.streetviewMarkerSize,
        };
        GG.streetviewMarker.setIcon(icon);
        GG.streetviewMarker.setOpacity(opacity);
      }
    } catch (e) {}
  };

  GG.updateStreetviewMarkerPosition = function () {
    if (!GG.streetviewMarker) return;
    if (!GG.coords.lat || !GG.coords.lng) return;
    try {
      if (GG.isGoogleMapsAvailable() && GG.streetviewMarker.setPosition) {
        let position = new google.maps.LatLng(GG.coords.lat, GG.coords.lng);
        GG.streetviewMarker.setPosition(position);
      }
    } catch (e) {}
  };

  GG.updateConnectionLine = function (guessLat, guessLng) {
    if (!GG.settings.showConnectionLine) {
      if (GG.connectionLine) {
        GG.connectionLine.setMap(null);
        GG.connectionLine = null;
      }
      return;
    }

    if (!GG.initialCoords.lat || !GG.initialCoords.lng) return;
    if (!guessLat || !guessLng) return;
    GG.gmap = GG.getGoogleMap();
    if (!GG.gmap) return;

    try {
      if (GG.isGoogleMapsAvailable()) {
        const path = [
          new google.maps.LatLng(guessLat, guessLng),
          new google.maps.LatLng(GG.initialCoords.lat, GG.initialCoords.lng),
        ];

        if (GG.connectionLine) {
          GG.connectionLine.setPath(path);
        } else {
          GG.connectionLine = new google.maps.Polyline({
            path: path,
            geodesic: false,
            strokeColor: GG.settings.markerColor,
            strokeOpacity: 0.7,
            strokeWeight: 2,
            map: GG.gmap,
            zIndex: 996,
            clickable: false,
          });
        }
      }
    } catch (e) {}
  };

  GG.createDivMarker = function () {
    let container = GG.getMapContainer();
    if (!container) return;
    let existing = document.getElementById("geo-div-marker");
    if (existing) existing.remove();
    let markerDiv = document.createElement("div");
    markerDiv.id = "geo-div-marker";
    markerDiv.style.cssText = `
            position: absolute !important;
            top: 50% !important;
            left: 50% !important;
            transform: translate(-50%, -50%) !important;
            width: ${GG.settings.size * 2.5}px !important;
            height: ${GG.settings.size * 2.5}px !important;
            background: ${GG.hexToRgba(
              GG.settings.markerColor,
              GG.settings.opacity,
            )} !important;
            border: ${GG.settings.outlineWidth}px solid ${
              GG.settings.outlineColor
            } !important;
            border-radius: 50% !important;
            pointer-events: none !important;
            z-index: 9999 !important;
            box-shadow: 0 0 10px ${GG.hexToRgba(
              GG.settings.markerColor,
              GG.settings.opacity * 0.5,
            )} !important;
            cursor: default !important;
        `;
    container.appendChild(markerDiv);
  };

  GG.placeMarker = function () {
    if (GG.settings.gameMode === "safety") {
        if (GG.marker) GG.marker.setMap(null);
        if (GG.streetviewMarker) GG.streetviewMarker.setMap(null);
        if (GG.connectionLine) GG.connectionLine.setMap(null);
        
        GG.showSafetyModeCountryOutline();
        return;
    }
    
    if (GG.initialCoords.lat && GG.initialCoords.lng) {
        if (!GG.marker) {
          GG.createMarker();
        } else {
          try {
            if (
              GG.isGoogleMapsAvailable() &&
              GG.marker.setPosition
            ) {
              let position = new google.maps.LatLng(GG.initialCoords.lat, GG.initialCoords.lng);
              GG.marker.setPosition(position);
            }
          } catch (e) {}
        }
    }

    if (GG.settings.showStreetviewMarker && GG.coords.lat && GG.coords.lng) {
      if (!GG.streetviewMarker) {
        GG.createStreetviewMarker();
      } else {
        GG.updateStreetviewMarkerPosition();
      }
    }
  };

  GG.countryCodeCache = {};
  GG.geoJsonCache = {};
  GG.safetyDataLayer = null;

  async function getCountryCode3(alpha2) {
      if (GG.countryCodeCache[alpha2]) return GG.countryCodeCache[alpha2];
      try {
          const resp = await fetch(`https://restcountries.com/v3.1/alpha/${alpha2}?fields=cca3`);
          if (!resp.ok) return null;
          const data = await resp.json();
          if (data && data.cca3) {
              GG.countryCodeCache[alpha2] = data.cca3;
              return data.cca3;
          }
      } catch (e) {
          console.warn("[GG] Failed to fetch alpha3 code:", e);
      }
      return null;
  }

  async function fetchCountryGeoJSON(cca3) {
      if (GG.geoJsonCache[cca3]) return GG.geoJsonCache[cca3];
      try {
          const resp = await fetch(`https://raw.githubusercontent.com/johan/world.geo.json/master/countries/${cca3}.geo.json`);
          if (!resp.ok) return null;
          const data = await resp.json();
          GG.geoJsonCache[cca3] = data;
          return data;
      } catch (e) {
          console.warn("[GG] Failed to fetch GeoJSON:", e);
      }
      return null;
  }

  GG.clearSafetyEffects = function() {
      if (GG.safetyOutline) {
          GG.safetyOutline.setMap(null);
          GG.safetyOutline = null;
      }
      if (GG.safetyDataLayer) {
          GG.safetyDataLayer.setMap(null);
          GG.safetyDataLayer = null;
      }
  };

  GG.showSafetyModeCountryOutline = function() {
      if (!GG.initialCoords.lat || !GG.initialCoords.lng) return;

      const modeRegion = GG.settings.safetyModeRegion || 'country';
      const coordKey = `${GG.initialCoords.lat},${GG.initialCoords.lng}-${modeRegion}-${GG.settings.safetyDetailed}`;
      
      if (GG.currentOutlineParams === coordKey && GG.isOutlineLoading) {
          return;
      }
      
      if (GG.lastAppliedOutlineParams === coordKey) {
          const isSafetyLayerValid = GG.safetyDataLayer && GG.safetyDataLayer.getMap();
          const isSafetyOutlineValid = GG.safetyOutline && GG.safetyOutline.getMap();
          
          if (isSafetyLayerValid || isSafetyOutlineValid) {
               return; 
          }
      }

      GG.gmap = GG.getGoogleMap();
      if (!GG.gmap || !google.maps.Geocoder) return;

      const requestId = Date.now();
      GG.currentOutlineRequestId = requestId;
      GG.currentOutlineParams = coordKey;
      GG.isOutlineLoading = true;

      const geocoder = new google.maps.Geocoder();
      geocoder.geocode({ location: GG.initialCoords }, async (results, status) => {
          if (GG.currentOutlineRequestId !== requestId) return;

          try {
              if (status === "OK" && results && results.length > 0) {
                  
                  let targetResult = null;

                  if (modeRegion === 'state') {
                      targetResult = results.find(r => r.types.includes("administrative_area_level_1"));
                      if (!targetResult) {
                          targetResult = results.find(r => r.types.includes("country"));
                      }
                  } else {
                      targetResult = results.find(r => r.types.includes("country"));
                  }

                  if (targetResult) {
                      if (GG.currentOutlineRequestId !== requestId) return;
                      
                      GG.clearSafetyEffects();

                      let polySuccess = false;
                      const useDetailed = GG.settings.safetyDetailed !== false;

                      if (useDetailed && targetResult.types.includes("country")) {
                          const shortName = targetResult.address_components?.find(c => c.types.includes("country"))?.short_name;
                          if (shortName) {
                              const cca3 = await getCountryCode3(shortName);
                              if (GG.currentOutlineRequestId !== requestId) return;
                              
                              if (cca3) {
                                  const geojson = await fetchCountryGeoJSON(cca3);
                                  if (GG.currentOutlineRequestId !== requestId) return;
                                  
                                  if (!GG.settings.enabled || GG.settings.gameMode !== 'safety') return;

                                  if (geojson) {
                                      console.log('[GG] Applying GeoJSON');
                                      GG.safetyDataLayer = new google.maps.Data({ map: GG.gmap });
                                      GG.safetyDataLayer.addGeoJson(geojson);
                                      GG.safetyDataLayer.setStyle({
                                          fillColor: GG.settings.safetyOutlineColor || "#10b981",
                                          fillOpacity: (GG.settings.safetyOutlineOpacity || 0.8) * 0.2,
                                          strokeColor: GG.settings.safetyOutlineColor || "#10b981",
                                          strokeWeight: GG.settings.safetyOutlineWidth || 2,
                                          strokeOpacity: GG.settings.safetyOutlineOpacity || 0.8,
                                          clickable: false
                                      });
                                      polySuccess = true;
                                      GG.lastAppliedOutlineParams = coordKey;
                                  }
                              }
                          }
                      }

                      if (!polySuccess && targetResult.geometry && targetResult.geometry.bounds) {
                          if (!GG.settings.enabled || GG.settings.gameMode !== 'safety') return;
                          
                          console.log('[GG] Applying Bounds');
                          if (GG.safetyOutline) { GG.safetyOutline.setMap(null); GG.safetyOutline = null; }

                          GG.safetyOutline = new google.maps.Rectangle({
                              strokeColor: GG.settings.safetyOutlineColor || "#10b981",
                              strokeOpacity: GG.settings.safetyOutlineOpacity || 0.8,
                              strokeWeight: GG.settings.safetyOutlineWidth || 2,
                              fillColor: GG.settings.safetyOutlineColor || "#10b981",
                              fillOpacity: (GG.settings.safetyOutlineOpacity || 0.8) * 0.2,
                              map: GG.gmap,
                              bounds: targetResult.geometry.bounds,
                              clickable: false
                          });
                          GG.lastAppliedOutlineParams = coordKey;
                      }
                  } else {
                      console.log('[GG] No target result found');
                  }
              } else {
                  console.log('[GG] Geocode failed:', status);
              }
          } catch (e) {
              console.error('[GG] Outline Error:', e);
          } finally {
              if (GG.currentOutlineRequestId === requestId) {
                  GG.isOutlineLoading = false;
              }
          }
      });
  };

  GG.updateSafetyOutlineStyle = function() {
      const styleOptions = {
          fillColor: GG.settings.safetyOutlineColor || "#10b981",
          fillOpacity: (GG.settings.safetyOutlineOpacity || 0.8) * 0.2,
          strokeColor: GG.settings.safetyOutlineColor || "#10b981",
          strokeWeight: GG.settings.safetyOutlineWidth || 2,
          strokeOpacity: GG.settings.safetyOutlineOpacity || 0.8,
          clickable: false
      };

      if (GG.safetyDataLayer) {
          GG.safetyDataLayer.setStyle(styleOptions);
      }
      
      if (GG.safetyOutline) {
          GG.safetyOutline.setOptions(styleOptions);
      }
  };

  GG.ensureMarkerVisible = function (attempt) {
    if (!GG.settings) {
      setTimeout(() => GG.ensureMarkerVisible(attempt), 100);
      return;
    }

    if (!GG.settings.enabled) return;
    if (!GG.coords.lat || !GG.coords.lng) return;
    
    if (GG.divMarkerActive && GG.settings.gameMode !== 'safety') {
      const mapNow = GG.getGoogleMap();
      if (!mapNow || typeof mapNow.getDiv !== "function") return;
      const divMarker = document.getElementById("geo-div-marker");
      if (divMarker) divMarker.remove();
      GG.divMarkerActive = false;
    }

    if (!GG.getMapContainer()) return;

    GG.placeMarker();

    const mapReady = !!GG.getGoogleMap();
    let shouldRetry = !mapReady;

    if (mapReady) {
        let isMissing = false;
        if (GG.settings.gameMode === 'safety') {
            if (!GG.safetyDataLayer && !GG.safetyOutline) isMissing = true;
        } else {
            if (!GG.marker) isMissing = true;
        }

        if (isMissing) shouldRetry = true;
    }

    if (shouldRetry) {
      const nextAttempt = (attempt || 0) + 1;
      if (nextAttempt <= 30) {
        if (GG.markerRetryId) {
          clearTimeout(GG.markerRetryId);
        }
        GG.markerRetryId = setTimeout(
          () => GG.ensureMarkerVisible(nextAttempt),
          500,
        );
      }
    }
  };

  GG.toggleMarker = function () {
    if (!GG.coords.lat || !GG.coords.lng) return;

    if (!GG.getMapContainer()) return;

    GG.settings.enabled = !GG.settings.enabled;
    GG.saveSettings();

    if (GG.settings.enabled) {
      GG.placeMarker();
      if (GG.settings.gameMode !== 'safety') {
          if (GG.connectionLine) GG.connectionLine.setMap(GG.gmap);
          if (GG.streetviewMarker && GG.settings.showStreetviewMarker) GG.streetviewMarker.setMap(GG.gmap);
      }
    } else {
      if (GG.marker && GG.marker.setMap) GG.marker.setMap(null);
      if (GG.streetviewMarker && GG.streetviewMarker.setMap) GG.streetviewMarker.setMap(null);
      if (GG.connectionLine && GG.connectionLine.setMap) GG.connectionLine.setMap(null);
      
      GG.clearSafetyEffects();

      let divMarker = document.getElementById("geo-div-marker");
      if (divMarker) divMarker.style.display = "none";
      
      GG.marker = null;
    }
  };
})();
