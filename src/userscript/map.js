(function () {
  "use strict";

  const GG = window.GhostGuessr;

  function detectRoundId() {
    const url = window.location.href;
    const match = url.match(/\/game\/([^\/]+)/);
    return match ? match[1] : null;
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

            const roundId = detectRoundId();
            const isNewRound = roundId && roundId !== GG.currentRoundId;
            const isFirstCoords = !GG.initialCoords.lat || !GG.initialCoords.lng;

            let distanceKm = 0;
            if (GG.coords.lat && GG.coords.lng) {
                 const R = 6371; 
                 const dLat = (newLat - GG.coords.lat) * Math.PI / 180;
                 const dLng = (newLng - GG.coords.lng) * Math.PI / 180;
                 const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
                           Math.cos(GG.coords.lat * Math.PI / 180) * Math.cos(newLat * Math.PI / 180) * 
                           Math.sin(dLng/2) * Math.sin(dLng/2);
                 const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
                 distanceKm = R * c;
            }
            
            const isSignificantJump = distanceKm > 5; 
            
            if (isNewRound || isFirstCoords || isSignificantJump) {
              if (roundId) GG.currentRoundId = roundId;
              GG.initialCoords.lat = newLat;
              GG.initialCoords.lng = newLng;

              if (GG.marker) {
                GG.marker.setMap(null);
                GG.marker = null;
              }
              
              if (isNewRound || isSignificantJump) {
                  if (GG.streetviewMarker) {
                    GG.streetviewMarker.setMap(null);
                    GG.streetviewMarker = null;
                  }
                  if (GG.connectionLine) {
                    GG.connectionLine.setMap(null);
                    GG.connectionLine = null;
                  }
                  if (GG._scorePredictorObserver) {
                    GG._scorePredictorObserver.disconnect();
                    GG._scorePredictorObserver = null;
                  }
              }
            }

            if (newLat === 0 && newLng === 0) return;

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
    let container =
      document.querySelector('[class*="guess-map_canvas__"]') ||
      document.querySelector('[class*="run-game-guess-map-contents_canvas__"]') ||
      document.querySelector('[data-qa="guess-map-canvas"]') ||
      document.querySelector('[class*="game-layout_map__"]');

    if (!container) {
         const gmStyle = document.querySelector('.gm-style');
         if (gmStyle && gmStyle.parentElement) {
             container = gmStyle.parentElement;
         }
    }

    if (!container) return null;

    if (GG.gmap && GG.gmap.getDiv && GG.gmap.getDiv() === container) {
      return GG.gmap;
    }
    
    GG.gmap = null;
    try {
      let reactKey = Object.keys(container).find((key) =>
        key.startsWith("__reactFiber$"),
      );
      if (reactKey) {
        let fiber = container[reactKey];
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
      if (typeof google !== "undefined" && google.maps) {
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
      if (typeof google !== "undefined" && google.maps) {
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
      if (typeof google !== "undefined" && google.maps) {
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
      if (typeof google !== "undefined" && google.maps) {
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
      if (typeof google !== "undefined" && google.maps && GG.streetviewMarker.setPosition) {
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
      if (typeof google !== "undefined" && google.maps) {
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
    let container =
      document.querySelector('[class*="guess-map_canvas__"]') ||
      document.querySelector('[class*="run-game-guess-map-contents_canvas__"]') ||
      document.querySelector('[data-qa="guess-map-canvas"]');
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
    if (GG.initialCoords.lat && GG.initialCoords.lng) {
        if (!GG.marker) {
          GG.createMarker();
        } else {
          try {
            if (
              typeof google !== "undefined" &&
              google.maps &&
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

  GG.ensureMarkerVisible = function (attempt) {
    if (!GG.settings) {
      setTimeout(() => GG.ensureMarkerVisible(attempt), 100);
      return;
    }

    if (!GG.settings.enabled) return;
    if (!GG.coords.lat || !GG.coords.lng) return;
    if (GG.divMarkerActive) {
      const mapNow = GG.getGoogleMap();
      if (!mapNow || typeof mapNow.getDiv !== "function") return;
      const divMarker = document.getElementById("geo-div-marker");
      if (divMarker) divMarker.remove();
      GG.divMarkerActive = false;
    }

    let isOnMapView =
      document.querySelector('[class*="coordinate-guess_mapContainer__"]') ||
      document.querySelector('[class*="guess-map_canvas__"]') ||
      document.querySelector('[class*="run-game-guess-map-contents_canvas__"]') ||
      document.querySelector('[data-qa="guess-map-canvas"]') || 
      document.querySelector('.gm-style');
    if (!isOnMapView) return;

    GG.placeMarker();

    if (!GG.marker) {
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

    let isOnMapView =
      document.querySelector('[class*="coordinate-guess_mapContainer__"]') ||
      document.querySelector('[class*="guess-map_canvas__"]') ||
      document.querySelector('[class*="run-game-guess-map-contents_canvas__"]') ||
      document.querySelector('[data-qa="guess-map-canvas"]') ||
      document.querySelector('.gm-style');
    if (!isOnMapView) return;

    GG.settings.enabled = !GG.settings.enabled;
    GG.saveSettings();

    if (GG.settings.enabled) {
      GG.placeMarker();
    } else {
      if (GG.marker && GG.marker.setMap) GG.marker.setMap(null);
      if (GG.streetviewMarker && GG.streetviewMarker.setMap) GG.streetviewMarker.setMap(null);
      if (GG.connectionLine && GG.connectionLine.setMap) GG.connectionLine.setMap(null);
      let divMarker = document.getElementById("geo-div-marker");
      if (divMarker) divMarker.style.display = "none";
      GG.marker = null;
      GG.streetviewMarker = null;
      GG.connectionLine = null;
    }
  };
})();
