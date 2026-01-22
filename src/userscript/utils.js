(function () {
  "use strict";

  const GG = window.GhostGuessr;

  GG.hexToRgba = function (hex, alpha) {
    let r = parseInt(hex.slice(1, 3), 16);
    let g = parseInt(hex.slice(3, 5), 16);
    let b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  };

  GG.isGoogleMapsAvailable = function() {
    return typeof google !== 'undefined' && google.maps;
  };

  GG.calculateDistance = function(lat1, lng1, lat2, lng2) {
    if (!lat1 || !lng1 || !lat2 || !lng2) return 0;
    
    try {
      if (GG.isGoogleMapsAvailable() && google.maps.geometry) {
        const point1 = new google.maps.LatLng(lat1, lng1);
        const point2 = new google.maps.LatLng(lat2, lng2);
        return google.maps.geometry.spherical.computeDistanceBetween(point1, point2);
      }
    } catch (e) {
      console.warn('[GG Utils] Google Maps geometry not available, using fallback');
    }
    
    const R = 6371000;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLng / 2) * Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  GG.formatDistance = function(meters) {
    const km = meters / 1000;
    if (km < 1) {
      return `${Math.round(meters)} m`;
    } else if (km < 10) {
      return `${km.toFixed(2)} km`;
    } else {
      return `${Math.round(km)} km`;
    }
  };

  GG.getMapContainer = function() {
    const selectors = [
      '[class*="guess-map_canvas__"]',
      '[class*="run-game-guess-map-contents_canvas__"]',
      '[class*="coordinate-map_canvasContainer__"]',
      '[class*="guess-map-container_map__"]',
      '[data-qa="guess-map-canvas"]',
      '[class*="game-layout_map__"]',
      '[class*="coordinate-guess_mapContainer__"]',
      '.gm-style' 
    ];

    let container = null;
    for (const selector of selectors) {
      container = document.querySelector(selector);
      if (container) break;
    }

    if (container && container.classList.contains('gm-style') && container.parentElement) {
       container = container.parentElement;
    }

    return container;
  };

  GG.findReactFiber = function(dom) {
    if (!dom) return null;
    const key = Object.keys(dom).find(k => k.startsWith('__reactFiber$'));
    return key ? dom[key] : null;
  };

  GG.resetRoundState = function(newCoords) {
    console.log('[GG Utils] Resetting round state');
    
    if (GG.marker) {
      if (typeof GG.marker.setMap === 'function') GG.marker.setMap(null);
      GG.marker = null;
    }
    if (GG.streetviewMarker) {
       if (typeof GG.streetviewMarker.setMap === 'function') GG.streetviewMarker.setMap(null);
       GG.streetviewMarker = null;
    }
    if (GG.connectionLine) {
       if (typeof GG.connectionLine.setMap === 'function') GG.connectionLine.setMap(null);
       GG.connectionLine = null;
    }
    
    const divMarker = document.getElementById("geo-div-marker");
    if (divMarker) divMarker.remove();
    GG.divMarkerActive = false;

    if (newCoords && typeof newCoords.lat === 'number' && typeof newCoords.lng === 'number') {
        GG.initialCoords = { lat: newCoords.lat, lng: newCoords.lng };
        GG.coords = { lat: newCoords.lat, lng: newCoords.lng };
    } else {
        GG.initialCoords = { lat: 0, lng: 0 };
        GG.coords = { lat: 0, lng: 0 };
    }
  };

})();
