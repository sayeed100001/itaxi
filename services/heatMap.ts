import { query } from '../db-config';
import { latLngToCell, cellToBoundary } from 'h3-js';

export class HeatMapService {
    static async getDemandHeatMap(resolution: number = 8) {
        const result = await query(
            `SELECT pickup_lat, pickup_lng, COUNT(*) as count
             FROM rides
             WHERE created_at > datetime('now', '-7 days')
             GROUP BY ROUND(pickup_lat, 3), ROUND(pickup_lng, 3)`
        );
        
        const heatData = result.rows.map(row => {
            const h3Index = latLngToCell(row.pickup_lat, row.pickup_lng, resolution);
            return {
                h3Index,
                lat: row.pickup_lat,
                lng: row.pickup_lng,
                intensity: row.count
            };
        });
        
        return heatData;
    }
    
    static async getEarningsHeatMap(resolution: number = 8) {
        const result = await query(
            `SELECT pickup_lat, pickup_lng, SUM(fare) as total_earnings
             FROM rides
             WHERE status = 'completed' AND created_at > datetime('now', '-7 days')
             GROUP BY ROUND(pickup_lat, 3), ROUND(pickup_lng, 3)`
        );
        
        return result.rows.map(row => ({
            h3Index: latLngToCell(row.pickup_lat, row.pickup_lng, resolution),
            lat: row.pickup_lat,
            lng: row.pickup_lng,
            earnings: row.total_earnings
        }));
    }
    
    static async getHotZones() {
        const result = await query(
            `SELECT 
                ROUND(pickup_lat, 2) as lat,
                ROUND(pickup_lng, 2) as lng,
                COUNT(*) as ride_count,
                AVG(fare) as avg_fare
             FROM rides
             WHERE created_at > datetime('now', '-24 hours')
             GROUP BY ROUND(pickup_lat, 2), ROUND(pickup_lng, 2)
             HAVING ride_count > 5
             ORDER BY ride_count DESC
             LIMIT 20`
        );
        
        return result.rows;
    }
    
    static async predictDemand(lat: number, lng: number, hour: number) {
        const dayOfWeek = new Date().getDay();
        
        const result = await query(
            `SELECT AVG(ride_count) as predicted_demand
             FROM (
                 SELECT COUNT(*) as ride_count
                 FROM rides
                 WHERE ABS(pickup_lat - ?) < 0.05
                   AND ABS(pickup_lng - ?) < 0.05
                   AND DAYOFWEEK(created_at) = ?
                   AND HOUR(created_at) = ?
                   AND created_at > datetime('now', '-30 days')
                 GROUP BY DATE(created_at)
             ) sub`,
            [lat, lng, dayOfWeek + 1, hour]
        );
        
        return result.rows[0]?.predicted_demand || 0;
    }
}
