
import { RouteData, AdminSettings, Location } from '../../types.js';
import { apiFetch } from '../api.js';

// Interface for all providers
export interface IRoutingProvider {
    calculateRoute(start: Location, end: Location, apiKey?: string): Promise<RouteData>;
}

// 1. OSRM Provider (Free Public API)
class OSRMProvider implements IRoutingProvider {
    async calculateRoute(start: Location, end: Location): Promise<RouteData> {
        try {
            // Call backend routing proxy to avoid CORS/network issues and keep pricing consistent
            const response = await apiFetch('/api/route', {
                method: 'POST',
                body: JSON.stringify({ start, end })
            });
            if (!response.ok) {
                const err = await response.json().catch(() => ({}));
                throw new Error(err.error || 'Routing API Error');
            }
            const data = await response.json();
            return data as RouteData;
        } catch (error) {
            console.error("OSRM Routing Error:", error);
            throw error;
        }
    }
}

// 2. OpenRouteService Provider
class OpenRouteServiceProvider implements IRoutingProvider {
    async calculateRoute(start: Location, end: Location, apiKey?: string): Promise<RouteData> {
        if (!apiKey) {
            throw new Error("OpenRouteService API Key is missing. Please configure it in Admin Settings.");
        }

        const baseUrl = "https://api.openrouteservice.org/v2/directions/driving-car";
        
        // Exact format required by ORS: lng,lat
        const startCoord = `${start.lng},${start.lat}`;
        const endCoord = `${end.lng},${end.lat}`;
        
        const url = `${baseUrl}?api_key=${apiKey}&start=${startCoord}&end=${endCoord}`;

        try {
            const response = await fetch(url, {
                method: 'GET',
                headers: {
                    'Accept': 'application/json, application/geo+json, application/gpx+xml, img/png; charset=utf-8'
                }
            });

            if (!response.ok) {
                const err = await response.json();
                console.error("ORS API Error:", err);
                throw new Error(err.error?.message || `API Error: ${response.status} ${response.statusText}`);
            }

            const data = await response.json();
            
            if (!data.features || data.features.length === 0) {
                throw new Error("No route found in response");
            }

            const feature = data.features[0];
            const coords = feature.geometry.coordinates; // ORS returns [lng, lat]
            const props = feature.properties;

            // Convert [lng, lat] to [lat, lng] for Leaflet
            const latLngs: [number, number][] = coords.map((c: number[]) => [c[1], c[0]]);

            return {
                coordinates: latLngs,
                distance: props.summary.distance,
                duration: props.summary.duration,
                bbox: data.bbox ? [data.bbox[1], data.bbox[0], data.bbox[3], data.bbox[2]] : undefined
            };

        } catch (error) {
            console.error("ORS Calculation Failed:", error);
            throw error;
        }
    }
}

// 3. Mapbox Provider
class MapboxProvider implements IRoutingProvider {
    async calculateRoute(start: Location, end: Location, apiKey?: string): Promise<RouteData> {
        if (!apiKey) {
            throw new Error("Mapbox API Key is missing.");
        }

        const baseUrl = "https://api.mapbox.com/directions/v5/mapbox/driving";
        const url = `${baseUrl}/${start.lng},${start.lat};${end.lng},${end.lat}?steps=true&geometries=geojson&access_token=${apiKey}`;

        try {
            const response = await fetch(url);
            if (!response.ok) {
                const err = await response.json();
                throw new Error(err.message || 'Mapbox API Error');
            }

            const data = await response.json();
            if (!data.routes || data.routes.length === 0) {
                throw new Error("No route found");
            }

            const route = data.routes[0];
            const coords = route.geometry.coordinates;
            // Mapbox returns [lng, lat]
            const latLngs: [number, number][] = coords.map((c: number[]) => [c[1], c[0]]);

            return {
                coordinates: latLngs,
                distance: route.distance,
                duration: route.duration,
                // Simple bbox estimation (Mapbox doesn't always return bbox in this endpoint without extra params)
                bbox: [
                     Math.min(start.lat, end.lat), Math.min(start.lng, end.lng),
                     Math.max(start.lat, end.lat), Math.max(start.lng, end.lng)
                ]
            };
        } catch (error) {
            console.error("Mapbox Routing Error:", error);
            throw error;
        }
    }
}

// 4. Mock Provider (Enhanced Fallback with Realistic Road Simulation)
class MockRoutingProvider implements IRoutingProvider {
    async calculateRoute(start: Location, end: Location): Promise<RouteData> {
        // Generate realistic road-following route using road network simulation
        const coordinates: [number, number][] = [];
        
        // Add start point
        coordinates.push([start.lat, start.lng]);
        
        // Calculate main direction and distance
        const deltaLat = end.lat - start.lat;
        const deltaLng = end.lng - start.lng;
        const totalDistance = Math.sqrt(deltaLat * deltaLat + deltaLng * deltaLng);
        
        // Generate waypoints that follow realistic road patterns
        const numSegments = Math.max(10, Math.min(50, Math.floor(totalDistance * 1000))); // 10-50 segments based on distance
        
        for (let i = 1; i < numSegments; i++) {
            const progress = i / numSegments;
            
            // Base interpolation
            let lat = start.lat + deltaLat * progress;
            let lng = start.lng + deltaLng * progress;
            
            // Add realistic road network deviations
            // Simulate following major roads with occasional turns
            const roadDeviation = 0.0008; // Max deviation from straight line
            
            // Create road-like patterns with turns at intersections
            const intersectionFreq = 0.15; // Intersection every ~15% of route
            const nearIntersection = (progress % intersectionFreq) < 0.05;
            
            if (nearIntersection) {
                // Sharp turn at intersection
                const turnIntensity = (Math.random() - 0.5) * roadDeviation * 2;
                lat += turnIntensity;
                lng += turnIntensity * 0.7; // Different ratio for lng
            } else {
                // Gentle road curves
                const curveIntensity = Math.sin(progress * Math.PI * 8) * roadDeviation * 0.3;
                const perpendicular = Math.atan2(deltaLng, deltaLat) + Math.PI / 2;
                lat += Math.cos(perpendicular) * curveIntensity;
                lng += Math.sin(perpendicular) * curveIntensity;
            }
            
            // Add slight randomness for GPS-like imperfection
            lat += (Math.random() - 0.5) * 0.0001;
            lng += (Math.random() - 0.5) * 0.0001;
            
            coordinates.push([lat, lng]);
        }
        
        // Add end point
        coordinates.push([end.lat, end.lng]);

        // Calculate realistic distance and duration
        let totalDistanceMeters = 0;
        for (let i = 1; i < coordinates.length; i++) {
            const prev = coordinates[i - 1];
            const curr = coordinates[i];
            const segmentDist = Math.sqrt(
                Math.pow((curr[0] - prev[0]) * 111000, 2) + 
                Math.pow((curr[1] - prev[1]) * 111000 * Math.cos(prev[0] * Math.PI / 180), 2)
            );
            totalDistanceMeters += segmentDist;
        }
        
        // Realistic duration based on urban driving (25-40 km/h average)
        const avgSpeedKmh = 30 + Math.random() * 15; // 30-45 km/h
        const duration = (totalDistanceMeters / 1000) / avgSpeedKmh * 3600; // seconds

        return {
            coordinates,
            distance: totalDistanceMeters,
            duration,
            bbox: [
                Math.min(start.lat, end.lat) - 0.002,
                Math.min(start.lng, end.lng) - 0.002,
                Math.max(start.lat, end.lat) + 0.002,
                Math.max(start.lng, end.lng) + 0.002
            ]
        };
    }
}

export class RoutingManager {
    private static providers: Record<string, IRoutingProvider> = {
        'osrm': new OSRMProvider(),
        'ors': new OpenRouteServiceProvider(),
        'mapbox': new MapboxProvider(),
        'mock': new MockRoutingProvider(),
    };

    static async getRoute(
        start: Location, 
        end: Location, 
        settings: AdminSettings
    ): Promise<RouteData> {
        const providerName = settings.routingProvider || 'osrm';

        const allowMock = import.meta.env.DEV && (typeof window !== 'undefined') && window.localStorage?.getItem('itaxi:mockRouting') === '1';
        // Always try OSRM first for real road data; never silently "simulate" routes in production.
        const providers = (allowMock ? ['osrm', providerName, 'mock'] : ['osrm', providerName]).filter((p, i, arr) => arr.indexOf(p) === i);
        
        for (const provider of providers) {
            try {
                const providerInstance = this.providers[provider] || this.providers['osrm'];
                
                let apiKey = '';
                if (provider === 'ors') apiKey = settings?.apiKeys?.ors || '';
                if (provider === 'mapbox') apiKey = settings?.apiKeys?.mapbox || '';

                console.log(`🗺️ Trying routing provider: ${provider}`);
                const result = await providerInstance.calculateRoute(start, end, apiKey);
                console.log(`✅ Route calculated successfully with ${provider}`);
                return result;
            } catch (error) {
                console.warn(`❌ Routing provider ${provider} failed:`, error);
                continue;
            }
        }
        
        // This should never happen as mock provider should always work
        throw new Error('All routing providers failed');
    }
}
