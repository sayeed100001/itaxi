import { query } from '../db-config.js';
import { latLngToCell, gridDisk } from 'h3-js';

interface PoolRide {
  id: string;
  riderId: string;
  pickupLat: number;
  pickupLng: number;
  dropoffLat: number;
  dropoffLng: number;
  maxDetour: number;
}

export class RideSharingService {
  static async findMatchingRides(newRide: PoolRide): Promise<string[]> {
    const pickupH3 = latLngToCell(newRide.pickupLat, newRide.pickupLng, 8);
    const dropoffH3 = latLngToCell(newRide.dropoffLat, newRide.dropoffLng, 8);
    
    const pickupArea = gridDisk(pickupH3, 2);
    const dropoffArea = gridDisk(dropoffH3, 2);

    const result = await query(
      `SELECT r.*, 
              ABS(r.pickup_lat - ?) + ABS(r.pickup_lng - ?) as pickup_distance,
              ABS(r.dropoff_lat - ?) + ABS(r.dropoff_lng - ?) as dropoff_distance
       FROM rides r
       WHERE r.status = 'searching'
         AND r.service_type = 'pool'
         AND r.id != ?
         AND r.created_at > datetime('now', '-5 minutes')
       ORDER BY pickup_distance + dropoff_distance ASC
       LIMIT 5`,
      [newRide.pickupLat, newRide.pickupLng, newRide.dropoffLat, newRide.dropoffLng, newRide.id]
    );

    const matches: string[] = [];
    for (const ride of result.rows) {
      const detour = this.calculateDetour(newRide, ride);
      if (detour <= newRide.maxDetour) {
        matches.push(ride.id);
      }
    }

    return matches;
  }

  private static calculateDetour(ride1: PoolRide, ride2: any): number {
    const dist = (lat1: number, lng1: number, lat2: number, lng2: number) => {
      return Math.sqrt(Math.pow(lat2 - lat1, 2) + Math.pow(lng2 - lng1, 2)) * 111;
    };

    const directDist1 = dist(ride1.pickupLat, ride1.pickupLng, ride1.dropoffLat, ride1.dropoffLng);
    const directDist2 = dist(ride2.pickup_lat, ride2.pickup_lng, ride2.dropoff_lat, ride2.dropoff_lng);

    const sharedDist = 
      dist(ride1.pickupLat, ride1.pickupLng, ride2.pickup_lat, ride2.pickup_lng) +
      dist(ride2.pickup_lat, ride2.pickup_lng, ride1.dropoffLat, ride1.dropoffLng) +
      dist(ride1.dropoffLat, ride1.dropoffLng, ride2.dropoff_lat, ride2.dropoff_lng);

    return sharedDist - (directDist1 + directDist2);
  }

  static async createPoolRide(rideIds: string[], driverId: string): Promise<string> {
    const poolId = Date.now().toString(36) + Math.random().toString(36).substr(2);

    await query(
      `INSERT INTO pool_rides (id, driver_id, status, created_at)
       VALUES (?, ?, 'active', datetime('now'))`,
      [poolId, driverId]
    );

    for (const rideId of rideIds) {
      await query(
        `UPDATE rides SET pool_id = ?, status = 'accepted', driver_id = ? WHERE id = ?`,
        [poolId, driverId, rideId]
      );
    }

    return poolId;
  }

  static async calculatePoolFare(rideId: string, baseFare: number): Promise<number> {
    const result = await query(
      `SELECT COUNT(*) as count FROM rides WHERE pool_id = (SELECT pool_id FROM rides WHERE id = ?)`,
      [rideId]
    );

    const poolSize = result.rows[0].count;
    const discount = Math.min(0.3, poolSize * 0.1);
    
    return Math.round(baseFare * (1 - discount));
  }
}
