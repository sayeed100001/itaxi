
import React from 'react';
import { RealMap } from './RealMap';
import { useAppStore } from '../../store';
import { RouteData, Hotel, Location } from '../../types';

interface MapBackgroundProps {
    pickup?: { lat: number; lng: number } | null;
    destination?: { lat: number; lng: number } | null;
    isDriverView?: boolean;
    route?: RouteData | null;
    showHotels?: boolean;
    hotels?: Hotel[];
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
    onCameraChange,
    center,
    zoom
}) => {
    const { drivers, userLocation, currentRoute } = useAppStore();

    return (
        <RealMap 
            drivers={drivers}
            pickup={pickup}
            destination={destination}
            center={center || pickup || userLocation}
            zoom={zoom}
            isDriverView={isDriverView}
            route={route || currentRoute}
            showHotels={showHotels}
            hotels={hotels}
            onCameraChange={onCameraChange}
        />
    );
};
