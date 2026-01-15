// ==UserScript==
// @name         GhostGuessr
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  Marks your Current Streeview Location on the GeoGuessr Map with a Red Dot. Toggled with the Key '1'
// @author       VellusFox
// @match        https://www.geoguessr.com/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=geoguessr.com
// @grant        none
// @license      MIT
// ==/UserScript==

(function() {
    'use strict';

    let coords = { lat: 0, lng: 0 };
    let marker = null;
    let visible = false;
    let gmap = null;

    var originalOpen = XMLHttpRequest.prototype.open;
    XMLHttpRequest.prototype.open = function(method, url) {
        if (method.toUpperCase() === 'POST' && url.includes('maps.googleapis.com') &&
            (url.includes('GetMetadata') || url.includes('SingleImageSearch'))) {
            this.addEventListener('load', function() {
                try {
                    let result = this.responseText;
                    let pattern = /-?\d+\.\d+,-?\d+\.\d+/g;
                    let matches = result.match(pattern);
                    if (matches && matches.length > 0) {
                        let match = matches[0];
                        let split = match.split(",");
                        coords.lat = Number.parseFloat(split[0]);
                        coords.lng = Number.parseFloat(split[1]);
                        if (visible && gmap) placeMarker();
                    }
                } catch(e) {}
            });
        }
        return originalOpen.apply(this, arguments);
    };

    function getGoogleMap() {
        if (gmap) return gmap;
        let container = document.querySelector('.guess-map_canvas__cvpqv') ||
                       document.querySelector('[data-qa="guess-map-canvas"]');
        if (!container) return null;
        try {
            let reactKey = Object.keys(container).find(key => key.startsWith('__reactFiber$'));
            if (reactKey) {
                let fiber = container[reactKey];
                let current = fiber;
                while (current) {
                    if (current.memoizedProps && current.memoizedProps.map) {
                        gmap = current.memoizedProps.map;
                        return gmap;
                    }
                    current = current.return;
                }
            }
        } catch(e) {}
        return null;
    }

    function createMarker() {
        if (!coords.lat || !coords.lng) return;
        gmap = getGoogleMap();
        if (!gmap) return;
        if (marker) {
            marker.setMap(null);
            marker = null;
        }
        try {
            if (typeof google !== 'undefined' && google.maps) {
                let position = new google.maps.LatLng(coords.lat, coords.lng);
                let icon = {
                    path: google.maps.SymbolPath.CIRCLE,
                    fillColor: 'rgba(255, 0, 0, 0.7)',
                    fillOpacity: 0.7,
                    strokeColor: 'rgba(255, 255, 255, 0.9)',
                    strokeWeight: 2,
                    scale: 10
                };
                marker = new google.maps.Marker({
                    position: position,
                    map: gmap,
                    icon: icon,
                    opacity: 0.8,
                    zIndex: 999,
                    optimized: false
                });
            }
        } catch(e) {
            createDivMarker();
        }
    }

    function createDivMarker() {
        let container = document.querySelector('.guess-map_canvas__cvpqv') ||
                       document.querySelector('[data-qa="guess-map-canvas"]');
        if (!container) return;
        let existing = document.getElementById('geo-div-marker');
        if (existing) existing.remove();
        let markerDiv = document.createElement('div');
        markerDiv.id = 'geo-div-marker';
        markerDiv.style.cssText = `
            position: absolute !important;
            top: 50% !important;
            left: 50% !important;
            transform: translate(-50%, -50%) !important;
            width: 25px !important;
            height: 25px !important;
            background: rgba(255, 0, 0, 0.7) !important;
            border: 2px solid rgba(255, 255, 255, 0.9) !important;
            border-radius: 50% !important;
            pointer-events: none !important;
            z-index: 9999 !important;
            box-shadow: 0 0 10px rgba(255, 0, 0, 0.5) !important;
        `;
        container.appendChild(markerDiv);
    }

    function placeMarker() {
        if (!coords.lat || !coords.lng) return;
        if (!marker) {
            createMarker();
        } else {
            try {
                if (typeof google !== 'undefined' && google.maps && marker.setPosition) {
                    let position = new google.maps.LatLng(coords.lat, coords.lng);
                    marker.setPosition(position);
                }
            } catch(e) {}
        }
    }

    function toggleMarker() {
        if (!coords.lat || !coords.lng) return;
        let isOnMapView = document.querySelector('.coordinate-guess_mapContainer__Y3bUt') ||
                         document.querySelector('.guess-map_canvas__cvpqv');
        if (!isOnMapView) return;
        if (!visible) {
            visible = true;
            placeMarker();
        } else {
            visible = false;
            if (marker && marker.setMap) marker.setMap(null);
            let divMarker = document.getElementById('geo-div-marker');
            if (divMarker) divMarker.style.display = 'none';
            marker = null;
        }
    }

    document.addEventListener('keydown', function(event) {
        if (event.key === '1') {
            event.stopPropagation();
            event.preventDefault();
            toggleMarker();
        }
    }, true);

    setTimeout(() => {
        setTimeout(() => {
            gmap = getGoogleMap();
        }, 2000);
    }, 1000);
})();
