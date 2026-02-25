import axios from 'axios';
import prisma from '../config/database';
import logger from '../config/logger';
import driverCreditService from './driverCredit.service';
import { AppError } from '../middlewares/errorHandler';

const OPENROUTE_API_KEY = process.env.OPENROUTESERVICE_API_KEY || '';
const MATRIX_CACHE_TTL = 30000; // 30 seconds

interface MatrixCache {
  data: any;
  timestamp: number;
}

const matrixCache = new Map<string, MatrixCache>();

interface ScoredDriver {
  driverId: string;
  score: number;
  eta: number;
  distance: number;
  rating: number;
  acceptanceRate: number;
}

export class DispatchService {
  private async getConfig() {
    let config = await prisma.dispatchConfig.findFirst();
    if (!config) {
      config = await prisma.dispatchConfig.create({
        data: {
          weightETA: 0.5,
          weightRating: 0.3,
          weightAcceptance: 0.2,
          serviceMatchBonus: 0.1,
          offerTimeout: 30,
          maxOffers: 3,
          searchRadius: 10,
        },
      });
    }
    return config;
  }

  async findAndOfferDrivers(tripId: string, pickupLat: number, pickupLng: number, serviceType: string, io: any) {
    const config = await this.getConfig();

    // Step 1: Query online drivers within radius
    const drivers = await prisma.driver.findMany({
      where: {
        status: 'ONLINE',
        anomalyCount: { lt: 3 },
        creditBalance: { gt: 0 },
        creditExpiresAt: { gt: new Date() },
      },
      include: { location: true },
    });

    const candidates = drivers.filter(d => {
      if (!d.location) return false;
      const distance = this.calculateDistance(pickupLat, pickupLng, d.location.lat, d.location.lng);
      return distance <= config.searchRadius;
    });

    if (candidates.length === 0) {
      logger.warn('No drivers available', { tripId, pickupLat, pickupLng });
      return [];
    }

    // Step 2: Call ORS matrix API for ETAs
    const driverCoords = candidates.map(d => [d.location!.lng, d.location!.lat]);
    const pickupCoord = [pickupLng, pickupLat];

    const cacheKey = `${pickupCoord.join(',')}_${driverCoords.map(c => c.join(',')).join('_')}`;
    let matrixData;

    const cached = matrixCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < MATRIX_CACHE_TTL) {
      matrixData = cached.data;
      logger.info('Matrix cache hit', { cacheKey });
    } else {
      try {
        const response = await axios.post(
          'https://api.openrouteservice.org/v2/matrix/driving-car',
          {
            locations: [pickupCoord, ...driverCoords],
            sources: [0],
            destinations: Array.from({ length: driverCoords.length }, (_, i) => i + 1),
            metrics: ['duration', 'distance'],
          },
          {
            headers: {
              'Authorization': OPENROUTE_API_KEY,
              'Content-Type': 'application/json',
            },
            timeout: 5000,
          }
        );

        matrixData = response.data;
        matrixCache.set(cacheKey, { data: matrixData, timestamp: Date.now() });
        logger.info('Matrix API called', { driverCount: candidates.length });
      } catch (error) {
        logger.error('Matrix API failed', { error });
        // Fallback to straight-line distance
        matrixData = null;
      }
    }

    // Step 3: Batch-fetch acceptance stats for ALL candidates (avoids N+1 queries)
    const candidateIds = candidates.map(d => d.id);

    const [acceptedCountsRaw, offerCountsRaw] = await Promise.all([
      prisma.trip.groupBy({
        by: ['driverId'],
        where: { driverId: { in: candidateIds }, status: { in: ['ACCEPTED', 'ARRIVED', 'IN_PROGRESS', 'COMPLETED'] } },
        _count: { id: true },
      }),
      prisma.tripOffer.groupBy({
        by: ['driverId'],
        where: { driverId: { in: candidateIds } },
        _count: { id: true },
      }),
    ]);

    const acceptedMap = new Map(acceptedCountsRaw.map(r => [r.driverId, r._count.id]));
    const offersMap = new Map(offerCountsRaw.map(r => [r.driverId, r._count.id]));

    // Compute scores
    const scoredDrivers: ScoredDriver[] = [];

    for (let i = 0; i < candidates.length; i++) {
      const driver = candidates[i];
      const eta = matrixData ? matrixData.durations[0][i] / 60 : this.calculateDistance(pickupLat, pickupLng, driver.location!.lat, driver.location!.lng) * 3;
      const distance = matrixData ? matrixData.distances[0][i] / 1000 : this.calculateDistance(pickupLat, pickupLng, driver.location!.lat, driver.location!.lng);

      const acceptedTrips = acceptedMap.get(driver.id) || 0;
      const totalOffers = offersMap.get(driver.id) || 0;
      const acceptanceRate = totalOffers > 0 ? acceptedTrips / totalOffers : 0.5;

      const etaNorm = 1 - Math.min(eta / 30, 1);
      const ratingNorm = driver.rating / 5;
      const acceptanceNorm = acceptanceRate;
      const serviceBonus = driver.vehicleType === serviceType ? config.serviceMatchBonus : 0;

      const score =
        config.weightETA * etaNorm +
        config.weightRating * ratingNorm +
        config.weightAcceptance * acceptanceNorm +
        serviceBonus;

      scoredDrivers.push({
        driverId: driver.id,
        score,
        eta,
        distance,
        rating: driver.rating,
        acceptanceRate,
      });
    }

    scoredDrivers.sort((a, b) => b.score - a.score);
    const topDrivers = scoredDrivers.slice(0, config.maxOffers);

    logger.info('Drivers scored', { tripId, totalCandidates: candidates.length, topDrivers: topDrivers.length });

    // Step 4: Sequential offers
    for (const driver of topDrivers) {
      await prisma.tripOffer.create({
        data: {
          tripId,
          driverId: driver.driverId,
          status: 'PENDING',
          score: driver.score,
          eta: driver.eta,
        },
      });
    }

    // Send first offer
    if (topDrivers.length > 0) {
      this.sendOffer(tripId, topDrivers[0].driverId, config.offerTimeout, io);
    }

    return topDrivers;
  }

  private async sendOffer(tripId: string, driverId: string, timeout: number, io: any) {
    const trip = await prisma.trip.findUnique({
      where: { id: tripId },
      include: { rider: true },
    });

    if (!trip) return;

    io.to(`driver:${driverId}`).emit('trip:offer', {
      tripId,
      pickup: { lat: trip.pickupLat, lng: trip.pickupLng },
      drop: { lat: trip.dropLat, lng: trip.dropLng },
      fare: trip.fare,
      distance: trip.distance,
      timeout,
    });

    logger.info('Offer sent', { tripId, driverId, timeout });

    // Set timeout for next offer
    setTimeout(async () => {
      const offer = await prisma.tripOffer.findFirst({
        where: { tripId, driverId, status: 'PENDING' },
      });

      if (offer) {
        await prisma.tripOffer.update({
          where: { id: offer.id },
          data: { status: 'EXPIRED' },
        });

        const nextOffer = await prisma.tripOffer.findFirst({
          where: { tripId, status: 'PENDING' },
          orderBy: { score: 'desc' },
        });

        if (nextOffer) {
          this.sendOffer(tripId, nextOffer.driverId, timeout, io);
        } else {
          logger.warn('All offers expired', { tripId });
          io.to(`user:${trip.riderId}`).emit('trip:no_drivers');
        }
      }
    }, timeout * 1000);
  }

  async acceptOffer(tripId: string, driverId: string) {
    await prisma.$transaction(async (tx) => {
      const offer = await tx.tripOffer.findFirst({
        where: { tripId, driverId, status: 'PENDING' },
      });

      if (!offer) {
        throw new AppError('Offer not found or expired', 400);
      }

      const trip = await tx.trip.findUnique({ where: { id: tripId } });
      if (!trip || trip.status !== 'REQUESTED') {
        throw new AppError('Trip already accepted or invalid', 400);
      }

      // Deduct commission when trip is accepted (handled in trip.service.ts acceptTrip)
      // await driverCreditService.deductCommission(driverId, trip.fare, tripId, tx);

      await tx.tripOffer.update({
        where: { id: offer.id },
        data: { status: 'ACCEPTED', respondedAt: new Date() },
      });

      await tx.tripOffer.updateMany({
        where: { tripId, status: 'PENDING' },
        data: { status: 'CANCELLED' },
      });

      await tx.trip.update({
        where: { id: tripId },
        data: { driverId, status: 'ACCEPTED' },
      });
    });

    logger.info('Offer accepted', { tripId, driverId });
  }

  async rejectOffer(tripId: string, driverId: string, io: any) {
    const offer = await prisma.tripOffer.findFirst({
      where: { tripId, driverId, status: 'PENDING' },
    });

    if (!offer) return;

    await prisma.tripOffer.update({
      where: { id: offer.id },
      data: { status: 'REJECTED', respondedAt: new Date() },
    });

    const config = await this.getConfig();
    const nextOffer = await prisma.tripOffer.findFirst({
      where: { tripId, status: 'PENDING' },
      orderBy: { score: 'desc' },
    });

    if (nextOffer) {
      this.sendOffer(tripId, nextOffer.driverId, config.offerTimeout, io);
    }

    logger.info('Offer rejected', { tripId, driverId });
  }

  private calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
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
}

export default new DispatchService();
