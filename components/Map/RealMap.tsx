
import React, { useEffect, useRef } from 'react';
import L from 'leaflet';
import { useAppStore } from '../../store';
import { RouteData, Hotel, Location } from '../../types';

// Icons
const createIcon = (color: string, type: 'car' | 'pin' | 'hotel' | 'user', rotation: number = 0) => {
    let svg = '';
    let iconSize: L.PointExpression = [40, 40];
    let iconAnchor: L.PointExpression = [20, 40];
    
    // Using style transform for rotation in SVG wrapper div
    const style = `transform: rotate(${rotation}deg); transition: transform 0.3s ease;`;

    if (type === 'car') {
        iconSize = [32, 32];
        iconAnchor = [16, 16];
        svg = `<div style="${style}"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="${color}" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="w-8 h-8 drop-shadow-lg"><path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2"/><circle cx="7" cy="17" r="2"/><circle cx="17" cy="17" r="2"/><path d="M5 17h12"/></svg></div>`;
    } else if (type === 'hotel') {
        svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="${color}" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="w-10 h-10 drop-shadow-xl"><path d="M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18Z"/><path d="M6 12H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2"/><path d="M18 9h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-2"/><path d="M10 6h4"/><path d="M10 10h4"/><path d="M10 14h4"/><path d="M10 18h4"/></svg>`;
    } else if (type === 'user') {
        iconSize = [24, 24];
        iconAnchor = [12, 12];
        svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="${color}" stroke="white" stroke-width="2.5" class="w-8 h-8 drop-shadow-lg"><circle cx="12" cy="12" r="10"></circle><circle cx="12" cy="12" r="4" fill="white"></circle></svg>`;
    } else {
        svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="${color}" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="w-10 h-10 drop-shadow-xl"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>`;
    }

    return L.divIcon({
        className: 'custom-icon', 
        html: svg,
        iconSize: iconSize,
        iconAnchor: iconAnchor,
        popupAnchor: [0, -40]
    });
};

const PickupIcon = createIcon('#22c55e', 'pin');
const DestIcon = createIcon('#ef4444', 'pin');
const HotelIcon = createIcon('#f97316', 'hotel');
const UserIcon = createIcon('#3b82f6', 'user');

interface RealMapProps {
    drivers?: Array<{ id: string; location: { lat: number; lng: number; bearing?: number }; status: string }>;
    hotels?: Hotel[];
    pickup?: { lat: number; lng: number } | null;
    destination?: { lat: number; lng: number } | null;
    center?: { lat: number; lng: number };
    zoom?: number;
    showUserLocation?: boolean;
    isDriverView?: boolean;
    route?: RouteData | null;
    showHotels?: boolean;
    onCameraChange?: (center: Location) => void;
    isInteractive?: boolean;
}

export const RealMap: React.FC<RealMapProps> = ({ 
    drivers = [], 
    hotels = [],
    pickup, 
    destination, 
    center, 
    zoom = 15,
    showUserLocation = true,
    isDriverView = false,
    route,
    showHotels = false,
    onCameraChange
}) => {
    const mapContainerRef = useRef<HTMLDivElement>(null);
    const mapInstanceRef = useRef<L.Map | null>(null);
    const tileLayerRef = useRef<L.TileLayer | null>(null);
    const markersRef = useRef<L.LayerGroup | null>(null);
    const driverMarkersRef = useRef<Record<string, L.Marker>>({});
    const routeLayerRef = useRef<L.LayerGroup | null>(null);
    
    const { isDarkMode, userLocation, adminSettings } = useAppStore();

    // Initialize Map
    useEffect(() => {
        if (!mapContainerRef.current) return;
        if (mapInstanceRef.current) return;

        const map = L.map(mapContainerRef.current, {
            zoomControl: false,
            attributionControl: false,
            inertia: true,
            zoomAnimation: true,
        }).setView([userLocation.lat, userLocation.lng], zoom);

        markersRef.current = L.layerGroup().addTo(map);
        routeLayerRef.current = L.layerGroup().addTo(map);
        mapInstanceRef.current = map;

        // Events - only if callback provided
        if (onCameraChange) {
            map.on('moveend', () => {
                const c = map.getCenter();
                onCameraChange({ lat: c.lat, lng: c.lng });
            });
        }

        return () => {
            map.remove();
            mapInstanceRef.current = null;
        };
    }, []);

    // Tile Layer Updates (Provider + Theme)
    useEffect(() => {
        const map = mapInstanceRef.current;
        if (!map) return;

        // Remove old layer
        if (tileLayerRef.current) {
            map.removeLayer(tileLayerRef.current);
        }

        let tileUrl = '';
        const provider = adminSettings.mapProvider;
        const apiKey = adminSettings.apiKeys.mapbox;

        if (provider === 'mapbox' && apiKey) {
            const styleId = isDarkMode ? 'navigation-night-v1' : 'navigation-day-v1';
            tileUrl = `https://api.mapbox.com/styles/v1/mapbox/${styleId}/tiles/{z}/{x}/{y}?access_token=${apiKey}`;
        } else if (provider === 'google') {
            // Unofficial Google Hybrid for demo purposes
            tileUrl = 'https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}';
        } else {
            // Default: OSM / CartoDB
            tileUrl = isDarkMode 
                ? 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png' 
                : 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png';
        }

        const layer = L.tileLayer(tileUrl, { 
            maxZoom: 20, 
            subdomains: provider === 'google' ? '' : 'abcd', // Google uses mt1, mt2...
            tileSize: 512,
            zoomOffset: -1 // often needed for 512px tiles like Mapbox
        }).addTo(map);

        tileLayerRef.current = layer;

    }, [isDarkMode, adminSettings.mapProvider, adminSettings.apiKeys.mapbox]);

    // Drivers Update
    useEffect(() => {
        const map = mapInstanceRef.current;
        if (!map) return;

        const currentIds = new Set<string>();
        
        drivers.forEach(driver => {
            currentIds.add(driver.id);
            const pos = new L.LatLng(driver.location.lat, driver.location.lng);
            const rotation = driver.location.bearing || 0;
            const icon = createIcon('#3b82f6', 'car', rotation);

            if (driverMarkersRef.current[driver.id]) {
                const marker = driverMarkersRef.current[driver.id];
                marker.setLatLng(pos);
                marker.setIcon(icon); 
            } else {
                const marker = L.marker(pos, { icon: icon });
                marker.addTo(map);
                driverMarkersRef.current[driver.id] = marker;
            }
        });

        Object.keys(driverMarkersRef.current).forEach(id => {
            if (!currentIds.has(id)) {
                driverMarkersRef.current[id].remove();
                delete driverMarkersRef.current[id];
            }
        });

    }, [drivers]);

    // Static Markers & Route Update
    useEffect(() => {
        const map = mapInstanceRef.current;
        const markersLayer = markersRef.current;
        const routeLayer = routeLayerRef.current;
        
        if (!map || !markersLayer || !routeLayer) return;

        markersLayer.clearLayers();
        routeLayer.clearLayers();

        // Pickup
        if (pickup) {
            L.marker([pickup.lat, pickup.lng], { icon: PickupIcon }).addTo(markersLayer);
        }

        // Destination
        if (destination) {
            L.marker([destination.lat, destination.lng], { icon: DestIcon }).addTo(markersLayer);
        }

        // User Location
        if (showUserLocation && !isDriverView) {
             L.marker([userLocation.lat, userLocation.lng], { icon: UserIcon }).addTo(markersLayer);
        }

        // Hotels Logic
        if (showHotels && hotels && hotels.length > 0) {
            const bounds = L.latLngBounds([]);
            hotels.forEach(hotel => {
                const latLng = [hotel.location.lat, hotel.location.lng] as [number, number];
                bounds.extend(latLng);
                const marker = L.marker(latLng, { icon: HotelIcon });
                const container = document.createElement('div');
                container.innerHTML = `
                    <div style="text-align:center; font-family:sans-serif; min-width: 120px;">
                        <h3 style="margin:0; font-weight:bold; font-size:14px;">${hotel.name}</h3>
                        <p style="margin:2px 0; color:#666; font-size:12px;">${hotel.priceRange}</p>
                        <button id="btn-${hotel.id}" style="margin-top:6px; background:#f97316; color:white; border:none; padding:6px 12px; border-radius:6px; cursor:pointer; font-weight:bold; width:100%;">Select</button>
                    </div>
                `;
                marker.bindPopup(container).addTo(markersLayer);
                
                // Dispatch event for parent to handle selection
                setTimeout(() => {
                    const btn = document.getElementById(`btn-${hotel.id}`);
                    if(btn) {
                         btn.onclick = (e) => {
                             e.stopPropagation(); // prevent map click
                             window.dispatchEvent(new CustomEvent('select-hotel', {detail: hotel}));
                         }
                    }
                }, 100); 
            });
            
            if (!route) {
                map.fitBounds(bounds, { padding: [50, 50], maxZoom: 14 });
            }
        }

        // Route
        if (route) {
            const routeColor = isDarkMode ? '#60a5fa' : '#2563eb';
            // Background blur/shadow path
            L.polyline(route.coordinates, {
                color: isDarkMode ? '#000' : '#ccc',
                weight: 8,
                opacity: 0.3,
                className: 'blur-[2px]' 
            }).addTo(routeLayer);

            // Main path
            L.polyline(route.coordinates, {
                color: routeColor,
                weight: 5,
                opacity: 0.9,
                lineCap: 'round',
                lineJoin: 'round',
            }).addTo(routeLayer);

            if (route.bbox) {
                 map.fitBounds([
                    [route.bbox[0], route.bbox[1]],
                    [route.bbox[2], route.bbox[3]]
                ], { padding: [80, 80] });
            }
        } else if (!showHotels) {
            if (center) {
                map.flyTo([center.lat, center.lng], zoom, { duration: 1.5, easeLinearity: 0.25 });
            }
        }

    }, [pickup, destination, showUserLocation, isDriverView, route, userLocation.lat, userLocation.lng, isDarkMode, showHotels, hotels.length]);

    return <div ref={mapContainerRef} className="w-full h-full absolute inset-0 z-0 bg-slate-100 dark:bg-slate-900 outline-none" />;
};
