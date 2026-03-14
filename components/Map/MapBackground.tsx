
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { RealMap } from './RealMap';
import { useAppStore } from '../../store';
import { RouteData, Hotel, Location, Poi } from '../../types';
import { fetchPois } from '../../services/pois';

import { DriverMarker } from '../../types';

interface MapBackgroundProps {
    pickup?: { lat: number; lng: number } | null;
    destination?: { lat: number; lng: number } | null;
    isDriverView?: boolean;
    route?: RouteData | null;
    showHotels?: boolean;
    hotels?: Hotel[];
    showPois?: boolean;
    pois?: Poi[];
    drivers?: DriverMarker[];
    onCameraChange?: (center: Location) => void;
    center?: Location;
    zoom?: number;
}

export const MapBackground: React.FC<MapBackgroundProps> = ({ 
    pickup, 
    destination, 
    isDriverView, 
    route, 
    showHotels, 
    hotels,
    showPois,
    pois,
    drivers,
    onCameraChange,
    center,
    zoom
}) => {
    const storeDrivers = useAppStore((state) => state.drivers);
    const userLocation = useAppStore((state) => state.userLocation);
    const currentRoute = useAppStore((state) => state.currentRoute);

    const effectiveShowPois = showPois !== undefined ? showPois : true;
    const [autoPois, setAutoPois] = useState<Poi[]>([]);
    const poiAbortRef = useRef<AbortController | null>(null);
    const lastPoiFetchCenterRef = useRef<Location | null>(null);
    const lastPoiFetchAtRef = useRef<number>(0);

    const poiCenter = useMemo<Location>(() => {
        return (center || pickup || userLocation) as Location;
    }, [center?.lat, center?.lng, pickup?.lat, pickup?.lng, userLocation.lat, userLocation.lng]);

    // Auto-fetch POIs for all portals (rider/admin/driver) unless parent provides `pois` explicitly.
    useEffect(() => {
        if (!effectiveShowPois) return;
        if (pois !== undefined) return; // parent-controlled mode
        if (!poiCenter || typeof poiCenter.lat !== 'number' || typeof poiCenter.lng !== 'number') return;

        const prev = lastPoiFetchCenterRef.current;
        const now = Date.now();

        const movedKm = (() => {
            if (!prev) return Infinity;
            const latRad = (poiCenter.lat * Math.PI) / 180;
            const kmPerDegLat = 111.32;
            const kmPerDegLng = 111.32 * Math.cos(latRad);
            const dLatKm = (poiCenter.lat - prev.lat) * kmPerDegLat;
            const dLngKm = (poiCenter.lng - prev.lng) * kmPerDegLng;
            return Math.sqrt(dLatKm * dLatKm + dLngKm * dLngKm);
        })();

        const ageMs = now - (lastPoiFetchAtRef.current || 0);
        // Prevent spammy refetching while driver GPS is updating.
        if (movedKm < 0.8 && ageMs < 2 * 60 * 1000) return;

        lastPoiFetchCenterRef.current = { lat: poiCenter.lat, lng: poiCenter.lng };
        lastPoiFetchAtRef.current = now;

        poiAbortRef.current?.abort();
        const ac = new AbortController();
        poiAbortRef.current = ac;

        (async () => {
            const data = await fetchPois({
                center: poiCenter,
                radiusM: 10_000,
                limit: 90,
                categories: ['hotel', 'airport', 'mall'],
                signal: ac.signal,
            });

            if (ac.signal.aborted) return;
            setAutoPois(data);
        })();

        return () => ac.abort();
    }, [effectiveShowPois, pois, poiCenter.lat, poiCenter.lng]);

    const resolvedPois = pois !== undefined ? pois : autoPois;

    return (
        <RealMap 
            drivers={drivers || storeDrivers}
            pickup={pickup}
            destination={destination}
            center={center || pickup || userLocation}
            zoom={zoom}
            isDriverView={isDriverView}
            route={route || currentRoute}
            showHotels={showHotels}
            hotels={hotels}
            showPois={effectiveShowPois}
            pois={resolvedPois}
            onCameraChange={onCameraChange}
        />
    );
};
