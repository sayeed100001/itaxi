import { query } from '../db-config';

interface Stop {
  address: string;
  lat: number;
  lng: number;
  order: number;
}

export class MultiStopService {
  static async createMultiStopRide(riderId: string, stops: Stop[], serviceType: string): Promise<string> {
    if (stops.length < 2) throw new Error('At least 2 stops required');

    const optimizedStops = this.optimizeRoute(stops);
    const totalDistance = this.calculateTotalDistance(optimizedStops);
    const totalDuration = Math.round(totalDistance / 40 * 60);

    const rideId = Date.now().toString(36) + Math.random().toString(36).substr(2);
    const pickup = optimizedStops[0];
    const dropoff = optimizedStops[optimizedStops.length - 1];

    await query(
      `INSERT INTO rides (id, rider_id, pickup_address, pickup_lat, pickup_lng, 
                          dropoff_address, dropoff_lat, dropoff_lng, 
                          fare, status, service_type, distance, duration, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'searching', ?, ?, ?, datetime('now'))`,
      [rideId, riderId, pickup.address, pickup.lat, pickup.lng,
       dropoff.address, dropoff.lat, dropoff.lng,
       this.calculateFare(totalDistance, optimizedStops.length),
       serviceType, totalDistance, totalDuration]
    );

    for (const stop of optimizedStops) {
      await query(
        `INSERT INTO ride_stops (id, ride_id, address, lat, lng, stop_order, status, created_at)
         VALUES (?, ?, ?, ?, ?, ?, 'pending', datetime('now'))`,
        [Date.now().toString(36) + Math.random().toString(36).substr(2), 
         rideId, stop.address, stop.lat, stop.lng, stop.order]
      );
    }

    return rideId;
  }

  private static optimizeRoute(stops: Stop[]): Stop[] {
    if (stops.length <= 2) return stops;

    const start = stops[0];
    const end = stops[stops.length - 1];
    const middle = stops.slice(1, -1);

    middle.sort((a, b) => {
      const distA = this.distance(start.lat, start.lng, a.lat, a.lng);
      const distB = this.distance(start.lat, start.lng, b.lat, b.lng);
      return distA - distB;
    });

    return [start, ...middle, end].map((stop, index) => ({ ...stop, order: index }));
  }

  private static distance(lat1: number, lng1: number, lat2: number, lng2: number): number {
    return Math.sqrt(Math.pow(lat2 - lat1, 2) + Math.pow(lng2 - lng1, 2)) * 111;
  }

  private static calculateTotalDistance(stops: Stop[]): number {
    let total = 0;
    for (let i = 0; i < stops.length - 1; i++) {
      total += this.distance(stops[i].lat, stops[i].lng, stops[i + 1].lat, stops[i + 1].lng);
    }
    return total;
  }

  private static calculateFare(distance: number, stopCount: number): number {
    const baseFare = 50;
    const perKm = 20;
    const perStop = 10;
    
    return Math.round(baseFare + (distance * perKm) + ((stopCount - 2) * perStop));
  }

  static async completeStop(rideId: string, stopOrder: number): Promise<void> {
    await query(
      `UPDATE ride_stops SET status = 'completed', completed_at = datetime('now')
       WHERE ride_id = ? AND stop_order = ?`,
      [rideId, stopOrder]
    );
  }

  static async getRideStops(rideId: string): Promise<any[]> {
    const result = await query(
      `SELECT * FROM ride_stops WHERE ride_id = ? ORDER BY stop_order ASC`,
      [rideId]
    );
    return result.rows;
  }
}
