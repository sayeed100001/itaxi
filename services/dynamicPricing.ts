import { db, query } from '../db-config.js';
import { latLngToCell, gridDisk } from 'h3-js';

export class DynamicPricingService {
    static async calculateSurge(lat: number, lng: number): Promise<number> {
        const h3Index = latLngToCell(lat, lng, 8);
        const nearbyHexes = gridDisk(h3Index, 2);

        // Count active rides in area
        const activeRidesResult = await query(
            `SELECT COUNT(*) as count FROM rides 
             WHERE status IN ('searching', 'accepted', 'in_progress')
             AND (
                 ABS(pickup_lat - ?) < 0.05 AND ABS(pickup_lng - ?) < 0.05
             )`,
            [lat, lng]
        );

        // Count available drivers in area
        const availableDriversResult = await query(
            `SELECT COUNT(*) as count FROM drivers 
             WHERE status = 'available' 
             AND ABS(current_lat - ?) < 0.05 
             AND ABS(current_lng - ?) < 0.05`,
            [lat, lng]
        );

        const activeRides = Number(activeRidesResult.rows[0]?.count || 0);
        const availableDrivers = Number(availableDriversResult.rows[0]?.count || 0);

        // Calculate surge multiplier
        let surgeMultiplier = 1.0;

        if (availableDrivers === 0) {
            surgeMultiplier = 2.0;
        } else {
            const ratio = activeRides / availableDrivers;
            if (ratio > 3) surgeMultiplier = 2.0;
            else if (ratio > 2) surgeMultiplier = 1.8;
            else if (ratio > 1.5) surgeMultiplier = 1.5;
            else if (ratio > 1) surgeMultiplier = 1.3;
        }

        // Check time-based surge (peak hours)
        const hour = new Date().getHours();
        if ((hour >= 7 && hour <= 9) || (hour >= 17 && hour <= 19)) {
            surgeMultiplier *= 1.2;
        }

        // Check weather-based surge (if weather API available)
        // surgeMultiplier *= await this.getWeatherMultiplier();

        // Cap at 3x
        surgeMultiplier = Math.min(surgeMultiplier, 3.0);

        // Save surge data (upsert)
        const surgeId = Date.now().toString(36);
        const upsertSql =
            db.provider === 'postgres'
                ? `INSERT INTO surge_zones (id, h3_index, lat, lng, multiplier, active_rides, available_drivers, created_at, updated_at)
                   VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
                   ON CONFLICT (h3_index) DO UPDATE SET
                     multiplier = EXCLUDED.multiplier,
                     active_rides = EXCLUDED.active_rides,
                     available_drivers = EXCLUDED.available_drivers,
                     updated_at = NOW()`
                : `INSERT INTO surge_zones (id, h3_index, lat, lng, multiplier, active_rides, available_drivers, created_at)
                   VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))
                   ON DUPLICATE KEY UPDATE 
                      multiplier = VALUES(multiplier), 
                      active_rides = VALUES(active_rides), 
                      available_drivers = VALUES(available_drivers),
                      updated_at = datetime('now')`;
        await query(upsertSql, [surgeId, h3Index, lat, lng, surgeMultiplier, activeRides, availableDrivers]);

        return surgeMultiplier;
    }

    static async calculateFare(
        distance: number,
        duration: number,
        serviceType: string,
        pickupLat: number,
        pickupLng: number
    ): Promise<{ baseFare: number; surgeFare: number; finalFare: number; surgeMultiplier: number }> {
        // Get service pricing
        const settingsResult = await query(
            `SELECT settings FROM admin_settings WHERE id = 1`
        );

        let baseFare = 50;
        let perKm = 20;
        let perMin = 2;

        if (settingsResult.rows.length > 0) {
            const settings = JSON.parse(settingsResult.rows[0].settings);
            const service = settings.services.find((s: any) => s.id === serviceType);
            if (service) {
                baseFare = service.baseFare;
                perKm = service.perKm;
                perMin = service.perMin;
            }
        }

        // Calculate base fare
        const distanceKm = distance / 1000;
        const durationMin = duration / 60;
        const calculatedFare = Math.round(baseFare + (distanceKm * perKm) + (durationMin * perMin));

        // Apply surge
        const surgeMultiplier = await this.calculateSurge(pickupLat, pickupLng);
        const surgeFare = Math.round(calculatedFare * surgeMultiplier);

        return {
            baseFare: calculatedFare,
            surgeFare,
            finalFare: surgeFare,
            surgeMultiplier
        };
    }

    static async getSurgeZones(): Promise<any[]> {
        const result = await query(
            `SELECT * FROM surge_zones 
             WHERE updated_at > datetime('now', '-10 minutes')
             AND multiplier > 1.0
             ORDER BY multiplier DESC`
        );

        return result.rows;
    }

    static async predictDemand(lat: number, lng: number, futureMinutes: number): Promise<number> {
        // Get historical data for same time/day
        const now = new Date();
        const dayOfWeek = now.getDay();
        const hour = now.getHours();

        const result = await query(
            `SELECT AVG(ride_count) as avg_demand FROM (
                SELECT COUNT(*) as ride_count, 
                       DAYOFWEEK(created_at) as dow,
                       HOUR(created_at) as hour
                FROM rides
                WHERE ABS(pickup_lat - ?) < 0.05 
                  AND ABS(pickup_lng - ?) < 0.05
                  AND created_at > DATE_SUB(NOW(), INTERVAL 30 DAY)
                GROUP BY DATE(created_at), HOUR(created_at)
            ) sub WHERE dow = ? AND hour = ?`,
            [lat, lng, dayOfWeek + 1, hour]
        );

        return result.rows[0]?.avg_demand || 0;
    }
}
