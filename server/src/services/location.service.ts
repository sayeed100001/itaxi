import axios from 'axios';
import prisma from '../config/database';
import logger from '../config/logger';

const OPENROUTE_API_KEY = process.env.OPENROUTESERVICE_API_KEY || '';
const SPEED_THRESHOLD_KMH = parseFloat(process.env.SPEED_THRESHOLD_KMH || '150');
const ANOMALY_THRESHOLD = parseInt(process.env.ANOMALY_THRESHOLD || '3');

interface SnapResult {
  snappedLat: number;
  snappedLng: number;
  deviation: number;
}

export class LocationService {
  async snapToRoad(lat: number, lng: number): Promise<SnapResult> {
    try {
      const response = await axios.post(
        'https://api.openrouteservice.org/v2/snap/driving-car',
        {
          locations: [[lng, lat]],
          radius: 100,
        },
        {
          headers: {
            'Authorization': OPENROUTE_API_KEY,
            'Content-Type': 'application/json',
          },
          timeout: 3000,
        }
      );

      const snapped = response.data.locations[0];
      if (!snapped) {
        return { snappedLat: lat, snappedLng: lng, deviation: 0 };
      }

      const snappedLat = snapped.location[1];
      const snappedLng = snapped.location[0];
      const deviation = this.calculateDistance(lat, lng, snappedLat, snappedLng) * 1000; // meters

      return { snappedLat, snappedLng, deviation };
    } catch (error) {
      logger.error('Snap to road failed', { error, lat, lng });
      return { snappedLat: lat, snappedLng: lng, deviation: 0 };
    }
  }

  calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const R = 6371;
    const dLat = this.toRad(lat2 - lat1);
    const dLng = this.toRad(lng2 - lng1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRad(lat1)) * Math.cos(this.toRad(lat2)) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  private toRad(deg: number): number {
    return deg * (Math.PI / 180);
  }

  async updateDriverLocation(driverId: string, rawLat: number, rawLng: number, bearing: number = 0) {
    const lastLocation = await prisma.driverLocation.findUnique({
      where: { driverId },
    });
    const driver = await prisma.driver.findUnique({
      where: { id: driverId },
      select: { anomalyCount: true },
    });

    const { snappedLat, snappedLng, deviation } = await this.snapToRoad(rawLat, rawLng);

    let anomalyCount = driver?.anomalyCount || 0;
    let shouldFlag = false;

    if (lastLocation) {
      const timeDiff = (Date.now() - lastLocation.updatedAt.getTime()) / 1000;
      if (timeDiff > 0) {
        const distance = this.calculateDistance(lastLocation.lat, lastLocation.lng, snappedLat, snappedLng);
        const speedKmh = (distance / timeDiff) * 3600;

        if (speedKmh > SPEED_THRESHOLD_KMH) {
          anomalyCount++;
          logger.warn('Speed anomaly detected', {
            driverId,
            speedKmh: speedKmh.toFixed(2),
            threshold: SPEED_THRESHOLD_KMH,
            anomalyCount,
          });

          if (anomalyCount >= ANOMALY_THRESHOLD) {
            shouldFlag = true;
            await prisma.driver.update({
              where: { id: driverId },
              data: { status: 'OFFLINE', anomalyCount },
            });
            logger.error('Driver flagged for GPS anomalies', { driverId, anomalyCount });
          }
        } else {
          anomalyCount = Math.max(0, anomalyCount - 1);
        }
      }
    }

    await prisma.driver.update({
      where: { id: driverId },
      data: { anomalyCount },
    });

    await prisma.driverLocation.upsert({
      where: { driverId },
      update: {
        lat: snappedLat,
        lng: snappedLng,
      },
      create: {
        driverId,
        lat: snappedLat,
        lng: snappedLng,
      },
    });

    return {
      snappedLat,
      snappedLng,
      deviation,
      anomalyCount,
      bearing,
      rawLat,
      rawLng,
      flagged: shouldFlag
    };
  }
}

export default new LocationService();
