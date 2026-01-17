(function () {
  "use strict";

  const GG = window.GhostGuessr;

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
            GG.coords.lat = Number.parseFloat(split[0]);
            GG.coords.lng = Number.parseFloat(split[1]);
            if (GG.settings.enabled && GG.gmap) GG.placeMarker();
          }
        } catch (e) {}
      });
    }
    return originalOpen.apply(this, arguments);
  };

  GG.getGoogleMap = function () {
    let container =
      document.querySelector(".guess-map_canvas__cvpqv") ||
      document.querySelector('[data-qa="guess-map-canvas"]');
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
          if (current.memoizedProps && current.memoizedProps.map) {
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
    if (!GG.coords.lat || !GG.coords.lng) return;
    GG.gmap = GG.getGoogleMap();
    if (!GG.gmap) return;
    if (GG.marker) {
      GG.marker.setMap(null);
      GG.marker = null;
    }
    try {
      if (typeof google !== "undefined" && google.maps) {
        let position = new google.maps.LatLng(GG.coords.lat, GG.coords.lng);
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
  };

  GG.createDivMarker = function () {
    let container =
      document.querySelector(".guess-map_canvas__cvpqv") ||
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
    if (!GG.coords.lat || !GG.coords.lng) return;
    if (!GG.marker) {
      GG.createMarker();
    } else {
      try {
        if (
          typeof google !== "undefined" &&
          google.maps &&
          GG.marker.setPosition
        ) {
          let position = new google.maps.LatLng(GG.coords.lat, GG.coords.lng);
          GG.marker.setPosition(position);
        }
      } catch (e) {}
    }
  };

  GG.toggleMarker = function () {
    if (!GG.coords.lat || !GG.coords.lng) return;

    let isOnMapView =
      document.querySelector(".coordinate-guess_mapContainer__Y3bUt") ||
      document.querySelector(".guess-map_canvas__cvpqv");
    if (!isOnMapView) return;

    GG.settings.enabled = !GG.settings.enabled;
    GG.saveSettings();

    if (GG.settings.enabled) {
      GG.placeMarker();
    } else {
      if (GG.marker && GG.marker.setMap) GG.marker.setMap(null);
      let divMarker = document.getElementById("geo-div-marker");
      if (divMarker) divMarker.style.display = "none";
      GG.marker = null;
    }
  };
})();