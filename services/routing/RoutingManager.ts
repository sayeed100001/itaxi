
import { RouteData, AdminSettings, Location } from '../../types';
import * as routingService from '../routingService';

// Interface for all providers
export interface IRoutingProvider {
    calculateRoute(start: Location, end: Location, apiKey?: string): Promise<RouteData>;
}

// 1. Backend Provider (Real OpenRouteService via backend)
class BackendProvider implements IRoutingProvider {
    async calculateRoute(start: Location, end: Location): Promise<RouteData> {
        return await routingService.getDirections(start, end);
    }
}

// Manager Factory
export class RoutingManager {
    private static providers: Record<string, IRoutingProvider> = {
        'ors': new BackendProvider(),
        'mapbox': new BackendProvider(),
    };

    static async getRoute(
        start: Location, 
        end: Location, 
        settings: AdminSettings
    ): Promise<RouteData> {
        const requestedProvider = settings?.routingProvider;
        const providerKey = requestedProvider === 'mapbox' ? 'mapbox' : 'ors';
        const provider = this.providers[providerKey];
        if (!provider) {
            throw new Error(`Unsupported routing provider: ${String(requestedProvider)}`);
        }
        return await provider.calculateRoute(start, end);
    }
}
