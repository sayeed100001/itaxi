
import React, { useEffect, useRef } from 'react';
import L from 'leaflet';
import { useAppStore } from '../../store';
import type { DriverMarker, RouteData, Hotel, Location, Poi, PoiCategory } from '../../types';
import { determineTaxiType, getDriverStatusColor, getDriverStatusText, TAXI_TYPES } from '../../services/taxiTypes';
import './MapIcons.css';

type TaxiTier = 'eco' | 'plus' | 'lux' | 'premium';

const TAXI_MARKER_SPECS: Record<TaxiTier, { size: number }> = {
    eco: { size: 40 },
    plus: { size: 45 },
    lux: { size: 50 },
    premium: { size: 55 },
};

const buildTaxiGlyphSvg = (rotation: number) => `
    <svg class="itaxi-taxi-marker__glyph" viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" style="transform: rotate(${rotation}deg);">
        <path d="M20 30 L25.5 22.5 C26.3 21.4 27.6 20.8 28.9 20.8 H35.1 C36.4 20.8 37.7 21.4 38.5 22.5 L44 30 H49 C52 30 54 32.1 54 35.1 V42.2 C54 45.1 52 47.2 49 47.2 H46.9 C45.9 50.2 43.1 52.3 40 52.3 C36.9 52.3 34.1 50.2 33.1 47.2 H30.9 C29.9 50.2 27.1 52.3 24 52.3 C20.9 52.3 18.1 50.2 17.1 47.2 H15 C12 47.2 10 45.1 10 42.2 V35.1 C10 32.1 12 30 15 30 H20 Z" fill="rgba(255,255,255,0.96)"/>
        <path d="M27.7 24.2 H36.3 C36.9 24.2 37.4 24.5 37.8 25 L41 30 H23 L26.2 25 C26.6 24.5 27.1 24.2 27.7 24.2 Z" fill="rgba(15,23,42,0.14)"/>
        <circle cx="24" cy="47.2" r="4.6" fill="rgba(15,23,42,0.20)"/>
        <circle cx="40" cy="47.2" r="4.6" fill="rgba(15,23,42,0.20)"/>
        <circle cx="24" cy="47.2" r="2.1" fill="rgba(255,255,255,0.88)"/>
        <circle cx="40" cy="47.2" r="2.1" fill="rgba(255,255,255,0.88)"/>
        <rect x="29" y="18.4" width="6" height="3.2" rx="1.2" fill="rgba(255,255,255,0.94)"/>
        <path d="M30.2 20 H33.8" stroke="rgba(15,23,42,0.22)" stroke-width="1.2" stroke-linecap="round" />
    </svg>
`;

const PREMIUM_SPARK_SVG = `
    <svg class="itaxi-taxi-marker__spark" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <path d="M12 2.8l1.6 4.7 4.9.1-3.9 2.9 1.5 4.8-4.1-2.7-4.1 2.7 1.5-4.8-3.9-2.9 4.9-.1L12 2.8z" fill="rgba(255,255,255,0.95)" />
    </svg>
`;

const createTaxiIcon = (driverType: TaxiTier, rotation: number = 0, status: string = 'available') => {
    const cfg = TAXI_MARKER_SPECS[driverType] || TAXI_MARKER_SPECS.eco;
    const size = cfg.size;
    const iconSize: L.PointExpression = [size, size];
    const iconAnchor: L.PointExpression = [size / 2, size / 2];
    const statusColor = getDriverStatusColor(status);

    const html = `
        <div class="itaxi-taxi-marker itaxi-taxi-marker--${driverType}" style="width:${size}px;height:${size}px;">
            <div class="itaxi-taxi-marker__badge">
                ${buildTaxiGlyphSvg(rotation)}
                ${driverType === 'premium' ? PREMIUM_SPARK_SVG : ''}
                <span class="itaxi-taxi-marker__status" style="background:${statusColor};"></span>
            </div>
        </div>
    `;

    return L.divIcon({
        className: 'custom-taxi-icon',
        html,
        iconSize,
        iconAnchor,
        popupAnchor: [0, -size / 2],
    });
};

// Silicon Valley Level Premium Icons with SVG
const createIcon = (color: string, type: 'car' | 'pin' | 'hotel' | 'user', rotation: number = 0) => {
    let svg = '';
    let iconSize: L.PointExpression = [48, 48];
    let iconAnchor: L.PointExpression = [24, 48];
    
    const style = `transform: rotate(${rotation}deg); transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);`;

    if (type === 'car') {
        // استفاده از تابع جدید برای تاکسی
        return createTaxiIcon('eco', rotation, 'available');
    } else if (type === 'hotel') {
        iconSize = [44, 44];
        iconAnchor = [22, 44];
        svg = `<div style="filter: drop-shadow(0 8px 16px rgba(0,0,0,0.2));">
            <svg width="44" height="44" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
                <!-- Background Circle -->
                <circle cx="50" cy="50" r="45" fill="white" stroke="#E5E7EB" stroke-width="2"/>
                
                <!-- Hotel Building -->
                <g transform="translate(50, 50)">
                    <!-- Main Building -->
                    <rect x="-16" y="-20" width="32" height="36" rx="2" fill="#F97316" stroke="#EA580C" stroke-width="1"/>
                    
                    <!-- Roof -->
                    <path d="M-18 -20 L0 -28 L18 -20 Z" fill="#DC2626"/>
                    
                    <!-- Windows -->
                    <rect x="-12" y="-16" width="6" height="6" rx="1" fill="#FEF3C7"/>
                    <rect x="-2" y="-16" width="6" height="6" rx="1" fill="#FEF3C7"/>
                    <rect x="8" y="-16" width="6" height="6" rx="1" fill="#FEF3C7"/>
                    
                    <rect x="-12" y="-6" width="6" height="6" rx="1" fill="#FEF3C7"/>
                    <rect x="-2" y="-6" width="6" height="6" rx="1" fill="#FEF3C7"/>
                    <rect x="8" y="-6" width="6" height="6" rx="1" fill="#FEF3C7"/>
                    
                    <!-- Door -->
                    <rect x="-4" y="4" width="8" height="12" rx="1" fill="#92400E"/>
                    <circle cx="2" cy="10" r="1" fill="#FCD34D"/>
                    
                    <!-- Hotel Star -->
                    <path d="M0 -24 L2 -18 L8 -18 L3 -14 L5 -8 L0 -12 L-5 -8 L-3 -14 L-8 -18 L-2 -18 Z" fill="#FBBF24"/>
                </g>
            </svg>
        </div>`;
    } else if (type === 'user') {
        iconSize = [32, 32];
        iconAnchor = [16, 16];
        svg = `<div style="filter: drop-shadow(0 4px 12px rgba(0,0,0,0.3));">
            <svg width="32" height="32" viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg">
                <!-- Outer Ring -->
                <circle cx="40" cy="40" r="36" fill="white" stroke="#3B82F6" stroke-width="4"/>
                
                <!-- Inner Dot -->
                <circle cx="40" cy="40" r="16" fill="#3B82F6"/>
                
                <!-- Pulse Ring -->
                <circle cx="40" cy="40" r="28" fill="none" stroke="#3B82F6" stroke-width="2" opacity="0.5">
                    <animate attributeName="r" values="16;32;16" dur="2s" repeatCount="indefinite"/>
                    <animate attributeName="opacity" values="0.8;0;0.8" dur="2s" repeatCount="indefinite"/>
                </circle>
            </svg>
        </div>`;
    } else {
        // Destination Pin - Premium Style
        svg = `<div style="filter: drop-shadow(0 8px 16px rgba(0,0,0,0.3));">
            <svg width="48" height="48" viewBox="0 0 100 120" fill="none" xmlns="http://www.w3.org/2000/svg">
                <!-- Pin Body -->
                <path d="M50 10 C70 10 85 25 85 45 C85 65 50 110 50 110 S15 65 15 45 C15 25 30 10 50 10 Z" fill="${color}" stroke="white" stroke-width="3"/>
                
                <!-- Inner Circle -->
                <circle cx="50" cy="45" r="18" fill="white"/>
                
                <!-- Center Dot -->
                <circle cx="50" cy="45" r="8" fill="${color}"/>
                
                <!-- Shine Effect -->
                <ellipse cx="42" cy="35" rx="8" ry="12" fill="white" opacity="0.3"/>
            </svg>
        </div>`;
    }

    return L.divIcon({
        className: 'custom-map-icon', 
        html: svg,
        iconSize: iconSize,
        iconAnchor: iconAnchor,
        popupAnchor: [0, -48]
    });
};

const PickupIcon = createIcon('#22c55e', 'pin');
const DestIcon = createIcon('#ef4444', 'pin');
const HotelIcon = createIcon('#f97316', 'hotel');
const UserIcon = createIcon('#3b82f6', 'user');

const POI_ICON_SIZE = 34;

const POI_GLYPHS: Record<PoiCategory, string> = {
    hotel: `
        <svg class="itaxi-poi-marker__glyph" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
            <path d="M4 21h16" />
            <path d="M7 21V7a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v14" />
            <path d="M10 9h1" /><path d="M13 9h1" />
            <path d="M10 12h1" /><path d="M13 12h1" />
            <path d="M12 21v-5" />
            <path d="M18.2 4.7l.6 1.3 1.4.2-1 .9.3 1.4-1.3-.7-1.3.7.3-1.4-1-.9 1.4-.2.6-1.3z" />
        </svg>
    `,
    airport: `
        <svg class="itaxi-poi-marker__glyph" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
            <path d="M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z" />
        </svg>
    `,
    mall: `
        <svg class="itaxi-poi-marker__glyph" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
            <path d="M6 8h12l-1 13H7L6 8Z" />
            <path d="M9 8a3 3 0 0 1 6 0" />
            <path d="M9 12h6" />
        </svg>
    `,
    shopping: `
        <svg class="itaxi-poi-marker__glyph" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
            <path d="M6 8h12l-1 13H7L6 8Z" />
            <path d="M9 8a3 3 0 0 1 6 0" />
            <path d="M9 12h6" />
        </svg>
    `,
    restaurant: `
        <svg class="itaxi-poi-marker__glyph" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
            <path d="M4 3v7a4 4 0 0 0 4 4v7" />
            <path d="M8 3v4" />
            <path d="M6 3v4" />
            <path d="M12 3v18" />
            <path d="M12 9h4a2 2 0 0 0 0-4h-4" />
        </svg>
    `,
    hospital: `
        <svg class="itaxi-poi-marker__glyph" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
            <path d="M7 3h10v18H7z" />
            <path d="M12 8v6" />
            <path d="M9 11h6" />
            <path d="M9 6h6" />
        </svg>
    `,
    fuel: `
        <svg class="itaxi-poi-marker__glyph" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
            <path d="M6 3h8v18H6z" />
            <path d="M8 7h4" />
            <path d="M14 6h2a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2h-2" />
            <path d="M16 10v4" />
        </svg>
    `,
    landmark: `
        <svg class="itaxi-poi-marker__glyph" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
            <path d="M5 3v18" />
            <path d="M5 4h14l-2 5 2 5H5" />
        </svg>
    `,
    poi: `
        <svg class="itaxi-poi-marker__glyph" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
            <path d="M12 21s-6-5.6-6-10a6 6 0 1 1 12 0c0 4.4-6 10-6 10Z" />
            <circle cx="12" cy="11" r="2.2" />
        </svg>
    `,
};

const POI_COLORS: Record<PoiCategory, { base: string; accent: string }> = {
    hotel: { base: '#F97316', accent: '#FB923C' },
    airport: { base: '#2563EB', accent: '#60A5FA' },
    mall: { base: '#10B981', accent: '#34D399' },
    shopping: { base: '#10B981', accent: '#34D399' },
    restaurant: { base: '#EF4444', accent: '#F87171' },
    hospital: { base: '#DC2626', accent: '#FB7185' },
    fuel: { base: '#F59E0B', accent: '#FBBF24' },
    landmark: { base: '#8B5CF6', accent: '#A78BFA' },
    poi: { base: '#64748B', accent: '#94A3B8' },
};

const poiIconCache: Partial<Record<PoiCategory, L.DivIcon>> = {};

const createPoiIcon = (category: PoiCategory) => {
    const safeCategory: PoiCategory = (category && POI_GLYPHS[category]) ? category : 'poi';
    if (poiIconCache[safeCategory]) return poiIconCache[safeCategory] as L.DivIcon;

    const colors = POI_COLORS[safeCategory] || POI_COLORS.poi;
    const html = `
        <div class="itaxi-poi-marker itaxi-poi-marker--${safeCategory}" style="width:${POI_ICON_SIZE}px;height:${POI_ICON_SIZE}px;--itaxi-poi-base:${colors.base};--itaxi-poi-accent:${colors.accent};">
            <div class="itaxi-poi-marker__badge">
                ${POI_GLYPHS[safeCategory] || POI_GLYPHS.poi}
            </div>
        </div>
    `;

    const icon = L.divIcon({
        className: 'itaxi-poi-icon',
        html,
        iconSize: [POI_ICON_SIZE, POI_ICON_SIZE],
        iconAnchor: [POI_ICON_SIZE / 2, POI_ICON_SIZE / 2],
        popupAnchor: [0, -POI_ICON_SIZE / 2],
    });

    poiIconCache[safeCategory] = icon;
    return icon;
};

interface RealMapProps {
    drivers?: Array<Pick<DriverMarker, 'id' | 'location' | 'status'> & Partial<Pick<DriverMarker, 'name' | 'vehicle' | 'rating' | 'totalRides' | 'licensePlate' | 'type'>>>;
    hotels?: Hotel[];
    pois?: Poi[];
    pickup?: { lat: number; lng: number } | null;
    destination?: { lat: number; lng: number } | null;
    center?: { lat: number; lng: number };
    zoom?: number;
    showUserLocation?: boolean;
    isDriverView?: boolean;
    route?: RouteData | null;
    showHotels?: boolean;
    showPois?: boolean;
    onCameraChange?: (center: Location) => void;
    isInteractive?: boolean;
}

export const RealMap: React.FC<RealMapProps> = ({ 
    drivers = [], 
    hotels = [],
    pois = [],
    pickup, 
    destination, 
    center, 
    zoom = 15,
    showUserLocation = true,
    isDriverView = false,
    route,
    showHotels = false,
    showPois = false,
    onCameraChange
}) => {
    const mapContainerRef = useRef<HTMLDivElement>(null);
    const mapInstanceRef = useRef<L.Map | null>(null);
    const tileLayerRef = useRef<L.TileLayer | null>(null);
    // Static markers: pickup/destination/user.
    const markersRef = useRef<L.LayerGroup | null>(null);
    // Overlay directories.
    const hotelsLayerRef = useRef<L.LayerGroup | null>(null);
    const poiLayerRef = useRef<L.LayerGroup | null>(null);
    const driverMarkersRef = useRef<Record<string, L.Marker>>({});
    const poiMarkersRef = useRef<Record<string, L.Marker>>({});
    const routeLayerRef = useRef<L.LayerGroup | null>(null);
    
    const isDarkMode = useAppStore((state) => state.isDarkMode);
    const userLocation = useAppStore((state) => state.userLocation);
    const adminSettings = useAppStore((state) => state.adminSettings);

    // Initialize Map (one-time)
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
        hotelsLayerRef.current = L.layerGroup().addTo(map);
        poiLayerRef.current = L.layerGroup().addTo(map);
        routeLayerRef.current = L.layerGroup().addTo(map);
        mapInstanceRef.current = map;

        return () => {
            map.remove();
            mapInstanceRef.current = null;
        };
    }, []);

    // Camera change callback (used by the rider "pin" destination selector).
    // Attach/detach without recreating the Leaflet map instance.
    useEffect(() => {
        const map = mapInstanceRef.current;
        if (!map || !onCameraChange) return;

        const handler = () => {
            const c = map.getCenter();
            onCameraChange({ lat: c.lat, lng: c.lng });
        };

        // Sync once on attach so UI always has the real map center.
        handler();
        map.on('moveend', handler);
        return () => {
            map.off('moveend', handler);
        };
    }, [onCameraChange]);

    // Tile Layer Updates (Provider + Theme)
    useEffect(() => {
        const map = mapInstanceRef.current;
        if (!map) return;

        // Remove old layer
        if (tileLayerRef.current) {
            map.removeLayer(tileLayerRef.current);
        }

        let tileUrl = '';
        const provider = adminSettings?.mapProvider || 'osm';
        const apiKey = adminSettings?.apiKeys?.mapbox || '';

        if (provider === 'mapbox' && apiKey) {
            const styleId = isDarkMode ? 'navigation-night-v1' : 'navigation-day-v1';
            tileUrl = `https://api.mapbox.com/styles/v1/mapbox/${styleId}/tiles/{z}/{x}/{y}?access_token=${apiKey}`;
        } else if (provider === 'google') {
            // Unofficial Google Hybrid for demo purposes
            tileUrl = 'https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}';
        } else {
            // Default: OSM / CartoDB
            tileUrl = isDarkMode 
                ? 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png' 
                : 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png';
        }

        const isMapbox = provider === 'mapbox' && apiKey;
        const layer = L.tileLayer(tileUrl, { 
            maxZoom: 20, 
            subdomains: provider === 'google' ? '' : 'abcd',
            tileSize: isMapbox ? 512 : 256,
            zoomOffset: isMapbox ? -1 : 0
        }).addTo(map);

        tileLayerRef.current = layer;

    }, [isDarkMode, adminSettings?.mapProvider, adminSettings?.apiKeys?.mapbox]);

    // Drivers Update with Smooth Animation
    useEffect(() => {
        const map = mapInstanceRef.current;
        if (!map) return;

        const currentIds = new Set<string>();
        
        drivers.forEach(driver => {
            currentIds.add(driver.id);
            const pos = new L.LatLng(driver.location.lat, driver.location.lng);
            const rotation = driver.location.bearing || 0;
            
            // تعیین نوع تاکسی بر اساس اطلاعات راننده
            const taxiTypesConfig = (adminSettings as any)?.taxiTypes || TAXI_TYPES;
            const taxiType = determineTaxiType(driver, taxiTypesConfig);
            const statusColor = getDriverStatusColor(driver.status);
            
            // ایجاد آیکون تاکسی با تصویر واقعی
            const taxiTypeId = (['eco', 'plus', 'lux', 'premium'] as const).includes(taxiType.id as any)
                ? (taxiType.id as 'eco' | 'plus' | 'lux' | 'premium')
                : 'eco';
            const icon = createTaxiIcon(taxiTypeId, rotation, driver.status);

            if (driverMarkersRef.current[driver.id]) {
                const marker = driverMarkersRef.current[driver.id];
                
                // Smooth animation for realistic GPS movement
                const currentPos = marker.getLatLng();
                const distance = currentPos.distanceTo(pos);
                
                // Only animate if movement is significant (>5 meters) to avoid jitter
                if (distance > 0.00005) {
                    // Animate movement over 2 seconds for smooth GPS tracking
                    const steps = 20;
                    const latStep = (pos.lat - currentPos.lat) / steps;
                    const lngStep = (pos.lng - currentPos.lng) / steps;
                    
                    let currentStep = 0;
                    const animateMovement = () => {
                        if (currentStep < steps && driverMarkersRef.current[driver.id]) {
                            const newLat = currentPos.lat + (latStep * currentStep);
                            const newLng = currentPos.lng + (lngStep * currentStep);
                            driverMarkersRef.current[driver.id].setLatLng([newLat, newLng]);
                            currentStep++;
                            setTimeout(animateMovement, 100); // 100ms per step = 2 seconds total
                        }
                    };
                    animateMovement();
                }
                
                marker.setIcon(icon); 
                marker.setZIndexOffset(1000); // Keep drivers on top
            } else {
                const marker = L.marker(pos, { icon: icon, zIndexOffset: 1000 });
                marker.addTo(map);
                driverMarkersRef.current[driver.id] = marker;
                
                // اطلاعات کامل راننده در پاپ آپ
                const popupContent = `
                    <div style="text-align: center; font-family: system-ui; min-width: 160px; padding: 12px; direction: rtl; background: white; border-radius: 12px;">
                        <div style="font-weight: bold; font-size: 16px; color: ${taxiType.color}; margin-bottom: 8px;">
                            ${driver.name || 'راننده iTaxi'}
                        </div>
                        <div style="font-size: 13px; color: #6B7280; margin-bottom: 6px;">
                            ${driver.vehicle || 'تویوتا کرولا'} • ${taxiType.nameFa}
                        </div>
                        <div style="font-size: 12px; color: #6B7280; margin-bottom: 6px;">
                            ${driver.rating?.toFixed(1) || '4.8'} ⭐ • ${driver.totalRides || 0} سفر
                        </div>
                        <div style="font-size: 11px; color: #6B7280; margin-bottom: 8px;">
                            پلاک: ${driver.licensePlate || 'ABC-123'}
                        </div>
                        <div style="background: ${statusColor}; color: white; padding: 6px 12px; border-radius: 15px; font-size: 11px; font-weight: bold; margin-bottom: 6px;">
                            ${getDriverStatusText(driver.status)} • ${Math.floor(Math.random() * 5) + 1} دقیقه فاصله
                        </div>
                        <div style="font-size: 10px; color: #9CA3AF; margin-bottom: 4px;">
                            کرایه پایه: ${taxiType.baseFare.toLocaleString()} افغانی
                        </div>
                        <div style="font-size: 9px; color: #9CA3AF;">
                            ${taxiType.featuresFa.slice(0, 2).join(' • ')}
                        </div>
                    </div>
                `;
                marker.bindPopup(popupContent);
            }
        });

        // Remove old drivers
        Object.keys(driverMarkersRef.current).forEach(id => {
            if (!currentIds.has(id)) {
                driverMarkersRef.current[id].remove();
                delete driverMarkersRef.current[id];
            }
        });

    }, [drivers, adminSettings]);

    // Static Markers Update - Separate from Route
    useEffect(() => {
        const map = mapInstanceRef.current;
        const markersLayer = markersRef.current;
        
        if (!map || !markersLayer) return;

        markersLayer.clearLayers();

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
    }, [pickup, destination, showUserLocation, isDriverView, userLocation]);

    // Hotels Overlay (used in the rider "hotel" meta-service).
    useEffect(() => {
        const map = mapInstanceRef.current;
        const layer = hotelsLayerRef.current;

        if (!map || !layer) return;

        layer.clearLayers();
        if (!showHotels || !hotels || hotels.length === 0) return;

        const bounds = L.latLngBounds([]);
        hotels.forEach((hotel) => {
            const latLng = [hotel.location.lat, hotel.location.lng] as [number, number];
            bounds.extend(latLng);

            const marker = L.marker(latLng, { icon: HotelIcon, zIndexOffset: 450 });
            const container = document.createElement('div');
            container.style.minWidth = '160px';
            const cardBg = isDarkMode ? 'rgba(17,24,39,0.96)' : 'rgba(255,255,255,0.98)';
            const titleColor = isDarkMode ? '#F9FAFB' : '#111827';
            const subColor = isDarkMode ? '#A1A1AA' : '#6B7280';
            container.innerHTML = `
                <div style="text-align:center; font-family: system-ui; padding: 10px 10px; border-radius: 14px; background:${cardBg}; border:1px solid ${isDarkMode ? 'rgba(255,255,255,0.10)' : 'rgba(15,23,42,0.08)'};">
                    <div style="font-weight:900; font-size:14px; color:${titleColor}; margin-bottom:4px;">${hotel.name}</div>
                    <div style="margin:2px 0; color:${subColor}; font-size:12px;">${hotel.priceRange || ''}</div>
                    <button type="button" style="margin-top:8px; background:#f97316; color:white; border:none; padding:8px 12px; border-radius:10px; cursor:pointer; font-weight:800; width:100%;">Select</button>
                </div>
            `;

            const btn = container.querySelector('button');
            if (btn) {
                btn.addEventListener('click', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    window.dispatchEvent(new CustomEvent('select-hotel', { detail: hotel }));
                    map.closePopup();
                });
            }

            marker.bindPopup(container).addTo(layer);
        });

        if (!route) {
            map.fitBounds(bounds, { padding: [50, 50], maxZoom: 14 });
        }
    }, [showHotels, hotels, route, isDarkMode]);

    // POI Overlay (Uber-like places: airport, mall, restaurants, ...)
    useEffect(() => {
        const map = mapInstanceRef.current;
        const layer = poiLayerRef.current;
        if (!map || !layer) return;

        if (!showPois) {
            layer.clearLayers();
            poiMarkersRef.current = {};
            return;
        }

        const list = Array.isArray(pois) ? pois : [];
        const currentIds = new Set<string>();

        for (const poi of list) {
            if (!poi?.id || !poi?.location) continue;
            const lat = poi.location.lat;
            const lng = poi.location.lng;
            if (typeof lat !== 'number' || typeof lng !== 'number' || Number.isNaN(lat) || Number.isNaN(lng)) continue;

            currentIds.add(poi.id);
            const pos = new L.LatLng(lat, lng);
            const icon = createPoiIcon(poi.category || 'poi');

            if (poiMarkersRef.current[poi.id]) {
                const marker = poiMarkersRef.current[poi.id];
                marker.setLatLng(pos);
                marker.setIcon(icon);
                marker.setZIndexOffset(400);
            } else {
                const marker = L.marker(pos, { icon, zIndexOffset: 400 });

                const container = document.createElement('div');
                container.style.minWidth = '180px';
                const title = String(poi.name || '').trim() || 'Place';
                const subtitle = String(poi.address || '').trim();
                const cardBg = isDarkMode ? 'rgba(17,24,39,0.96)' : 'rgba(255,255,255,0.98)';
                const titleColor = isDarkMode ? '#F9FAFB' : '#111827';
                const subColor = isDarkMode ? '#A1A1AA' : '#6B7280';
                const btnBg = isDarkMode ? '#3B82F6' : '#2563EB';
                container.innerHTML = `
                    <div style="font-family: system-ui; padding: 10px 10px; border-radius: 14px; background:${cardBg}; border:1px solid ${isDarkMode ? 'rgba(255,255,255,0.10)' : 'rgba(15,23,42,0.08)'};">
                        <div style="font-weight:950; font-size:14px; color:${titleColor}; margin-bottom:4px;">${title}</div>
                        ${subtitle ? `<div style="color:${subColor}; font-size:12px; margin-bottom:8px;">${subtitle}</div>` : ''}
                        <button type="button" style="background:${btnBg}; color:white; border:none; padding:8px 12px; border-radius:10px; cursor:pointer; font-weight:900; width:100%;">Set Destination</button>
                    </div>
                `;

                const btn = container.querySelector('button');
                if (btn) {
                    btn.addEventListener('click', (e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        window.dispatchEvent(new CustomEvent('select-poi', { detail: poi }));
                        map.closePopup();
                    });
                }

                marker.bindPopup(container);
                marker.addTo(layer);
                poiMarkersRef.current[poi.id] = marker;
            }
        }

        Object.keys(poiMarkersRef.current).forEach((id) => {
            if (!currentIds.has(id)) {
                const marker = poiMarkersRef.current[id];
                layer.removeLayer(marker);
                delete poiMarkersRef.current[id];
            }
        });
    }, [showPois, pois, isDarkMode]);

    // Route Rendering - Separate Effect
    useEffect(() => {
        const map = mapInstanceRef.current;
        const routeLayer = routeLayerRef.current;
        
        if (!map || !routeLayer) return;

        routeLayer.clearLayers();

        // Premium Route Rendering - Silicon Valley Style
        if (route && route.coordinates && route.coordinates.length > 1) {
            const routeColor = isDarkMode ? '#60A5FA' : '#3B82F6';
            const shadowColor = isDarkMode ? '#1E293B' : '#94A3B8';
            
            // Validate coordinates format - ensure [lat, lng] format
            const validCoords = route.coordinates.filter(coord => 
                Array.isArray(coord) && coord.length === 2 && 
                typeof coord[0] === 'number' && typeof coord[1] === 'number' &&
                !isNaN(coord[0]) && !isNaN(coord[1]) &&
                coord[0] >= -90 && coord[0] <= 90 && // Valid latitude
                coord[1] >= -180 && coord[1] <= 180 // Valid longitude
            );
            
            if (validCoords.length > 1) {
                // Outer Shadow/Glow
                L.polyline(validCoords, {
                    color: shadowColor,
                    weight: 12,
                    opacity: 0.2,
                    lineCap: 'round',
                    lineJoin: 'round',
                    smoothFactor: 1.0
                }).addTo(routeLayer);
                
                // Middle Border
                L.polyline(validCoords, {
                    color: isDarkMode ? '#1E293B' : '#FFFFFF',
                    weight: 8,
                    opacity: 0.9,
                    lineCap: 'round',
                    lineJoin: 'round',
                    smoothFactor: 1.0
                }).addTo(routeLayer);

                // Main Route Line - Solid, not dashed
                L.polyline(validCoords, {
                    color: routeColor,
                    weight: 6,
                    opacity: 1,
                    lineCap: 'round',
                    lineJoin: 'round',
                    smoothFactor: 1.0
                }).addTo(routeLayer);
                
                // Add subtle animated overlay for active routes
                L.polyline(validCoords, {
                    color: '#FFFFFF',
                    weight: 2,
                    opacity: 0.6,
                    lineCap: 'round',
                    lineJoin: 'round',
                    dashArray: '8, 12',
                    smoothFactor: 1.0
                }).addTo(routeLayer);
            }

            // Fit bounds only once when route is first loaded
            if (route.bbox) {
                 map.fitBounds([
                    [route.bbox[0], route.bbox[1]],
                    [route.bbox[2], route.bbox[3]]
                ], { padding: [80, 80] });
            }
        }
    }, [route, isDarkMode]);

    // Map Center Control - Only when explicitly needed
    useEffect(() => {
        const map = mapInstanceRef.current;
        if (!map || !center) return;
        
        // Only update center if no route is displayed and not showing hotels
        if (!route && !showHotels) {
            const currentCenter = map.getCenter();
            const dist = currentCenter.distanceTo([center.lat, center.lng]);
            // Only move if distance is significant (>100m) to prevent constant updates
            if (dist > 100) {
                map.setView([center.lat, center.lng], zoom, { animate: true });
            }
        }
    }, [center, zoom, route, showHotels]);

    return <div ref={mapContainerRef} className="w-full h-full absolute inset-0 z-0 bg-slate-100 dark:bg-slate-900 outline-none" />;
};
