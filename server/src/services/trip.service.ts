import prisma from '../config/database';
import { AppError } from '../middlewares/errorHandler';
import logger from '../config/logger';
import dispatchService from './dispatch.service';
import * as paymentService from './payment.service';
import { WhatsAppService } from './whatsapp.service';
import { logAudit } from '../utils/audit';
import { MessageChannel, MessageDeliveryStatus, Prisma, Role, TripStatus } from '@prisma/client';
import { driverCreditService } from './driverCredit.service';

const whatsappService = new WhatsAppService();

function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function toRad(degrees: number): number {
  return degrees * (Math.PI / 180);
}

export class TripService {
  private async hydrateTrip(tripId: string) {
    return prisma.trip.findUnique({
      where: { id: tripId },
      include: {
        metadata: true,
        rider: true,
        driver: { include: { user: true } },
      },
    });
  }

  private async getTripForParticipantChecks(tripId: string) {
    const trip = await prisma.trip.findUnique({
      where: { id: tripId },
      include: {
        rider: true,
        driver: { include: { user: true } },
      },
    });

    if (!trip) {
      throw new AppError('Trip not found', 404);
    }

    return trip;
  }

  private resolveTripParticipant(
    trip: {
      riderId: string;
      rider: { id: string; phone: string };
      driver: { userId: string; user: { id: string; phone: string } } | null;
    },
    user: { id: string; role: string }
  ) {
    if (user.role === 'ADMIN') {
      throw new AppError('Admin cannot chat or rate as trip participant', 403);
    }

    if (user.role === 'RIDER') {
      if (trip.riderId !== user.id) {
        throw new AppError('Forbidden', 403);
      }
      if (!trip.driver) {
        throw new AppError('Driver has not been assigned yet', 400);
      }
      return {
        fromRole: 'RIDER' as Role,
        toRole: 'DRIVER' as Role,
        toUserId: trip.driver.userId,
        toPhone: trip.driver.user.phone,
      };
    }

    if (user.role === 'DRIVER') {
      if (!trip.driver || trip.driver.userId !== user.id) {
        throw new AppError('Forbidden', 403);
      }
      return {
        fromRole: 'DRIVER' as Role,
        toRole: 'RIDER' as Role,
        toUserId: trip.rider.id,
        toPhone: trip.rider.phone,
      };
    }

    throw new AppError('Forbidden', 403);
  }

  async createTrip(
    data: {
      riderId: string;
      pickupLat: number;
      pickupLng: number;
      dropLat: number;
      dropLng: number;
      fare: number;
      distance: number;
      duration: number;
      serviceType?: string;
      paymentMethod?: 'CASH' | 'WALLET';
      scheduledFor?: string;
      womenOnly?: boolean;
      serviceClass?: string;
      specialInstructions?: string;
      bookingChannel?: 'APP' | 'PHONE';
      requestedFor?: { name: string; phone: string };
      stops?: Array<{ lat: number; lng: number; label?: string }>;
      preferredDriverId?: string;
    },
    io?: any
  ) {
    // Validate rider exists
    const rider = await prisma.user.findUnique({
      where: { id: data.riderId },
    });

    if (!rider) {
      throw new AppError('Rider not found. Please login again.', 404);
    }

    const scheduledFor = data.scheduledFor ? new Date(data.scheduledFor) : null;
    const isScheduled = !!scheduledFor;

    const trip = await prisma.trip.create({
      data: {
        riderId: data.riderId,
        pickupLat: data.pickupLat,
        pickupLng: data.pickupLng,
        dropLat: data.dropLat,
        dropLng: data.dropLng,
        fare: data.fare,
        distance: data.distance,
        duration: data.duration,
        serviceType: data.serviceType || 'city',
        paymentMethod: data.paymentMethod || 'CASH',
      },
    });

    await prisma.tripMetadata.create({
      data: {
        tripId: trip.id,
        isScheduled,
        scheduledFor,
        bookingChannel: data.bookingChannel || 'APP',
        requestedForName: data.requestedFor?.name,
        requestedForPhone: data.requestedFor?.phone,
        womenOnly: !!data.womenOnly,
        serviceClass: data.serviceClass,
        extraStops: data.stops ? (data.stops as Prisma.InputJsonValue) : undefined,
        specialInstructions: data.specialInstructions,
      },
    });

    if (!isScheduled) {
      const selectedDriverId = data.preferredDriverId;

      // If rider explicitly selected a driver, offer directly to that driver only.
      if (selectedDriverId && io) {
        const preferredDriver = await prisma.driver.findUnique({
          where: { id: selectedDriverId },
        });

        const hasActiveCredits =
          !!preferredDriver &&
          preferredDriver.creditBalance > 0 &&
          !!preferredDriver.creditExpiresAt &&
          preferredDriver.creditExpiresAt > new Date();

        if (preferredDriver && preferredDriver.status === 'ONLINE' && hasActiveCredits) {
          const offerTripPayload = await prisma.trip.findUnique({
            where: { id: trip.id },
            include: { rider: true, metadata: true },
          });

          io.to(`driver:${preferredDriver.id}`).emit('trip:requested', offerTripPayload);

          logger.info('Preferred driver offer sent', {
            tripId: trip.id,
            preferredDriverId: preferredDriver.id,
            riderId: data.riderId,
          });
        } else {
          logger.warn('Preferred driver unavailable, falling back to smart dispatch', {
            tripId: trip.id,
            preferredDriverId: selectedDriverId,
          });

          await dispatchService.findAndOfferDrivers(
            trip.id,
            data.pickupLat,
            data.pickupLng,
            data.serviceType || 'city',
            io
          );
        }
      } else {
        // Default mode: intelligent dispatch.
        await dispatchService.findAndOfferDrivers(
          trip.id,
          data.pickupLat,
          data.pickupLng,
          data.serviceType || 'city',
          io
        );
      }
    }

    return this.hydrateTrip(trip.id);
  }

  async acceptTrip(tripId: string, driverIdentifier: string) {
    const driver = await prisma.driver.findFirst({
      where: {
        OR: [
          { id: driverIdentifier },
          { userId: driverIdentifier },
        ],
      },
    });

    if (!driver) {
      throw new AppError('Driver profile not found', 404);
    }

    await prisma.$transaction(async (tx) => {
      const trip = await tx.trip.findUnique({ where: { id: tripId } });
      if (!trip || trip.status !== 'REQUESTED') {
        throw new AppError('Trip already accepted or not in requested state', 400);
      }

      // Calculate commission: 20% iTaxi, 80% driver
      const platformCommission = Math.ceil(trip.fare * 0.20);
      const driverEarnings = trip.fare - platformCommission;

      // Deduct commission from driver credits (20% of fare in AFN = credits to deduct)
      await driverCreditService.deductCommission(driver.id, tripId, platformCommission, trip.fare, tx);

      const result = await tx.trip.updateMany({
        where: { id: tripId, status: 'REQUESTED' },
        data: { 
          driverId: driver.id, 
          status: 'ACCEPTED',
          platformCommission,
          driverEarnings
        },
      });

      if (result.count === 0) {
        throw new AppError('Trip already accepted or not in requested state', 400);
      }
    });

    return prisma.trip.findUnique({
      where: { id: tripId },
      include: { metadata: true, rider: true, driver: { include: { user: true } } },
    });
  }

  async completeTrip(tripId: string) {
    return await prisma.$transaction(async (tx) => {
      const trip = await tx.trip.findUnique({ 
        where: { id: tripId },
        include: { driver: true }
      });
      if (!trip) throw new AppError('Trip not found', 404);
      if (trip.status !== 'IN_PROGRESS') throw new AppError('Trip not in progress', 400);

      const balance = await this.calculateBalance(trip.riderId, tx);
      if (balance < trip.fare) {
        throw new AppError('Insufficient balance', 400);
      }

      // Calculate commission split: 20% iTaxi, 80% driver
      const platformCommission = Math.ceil(trip.fare * 0.20);
      const driverEarnings = trip.fare - platformCommission;

      // Debit rider's wallet
      const transaction = await tx.transaction.create({
        data: {
          userId: trip.riderId,
          amount: trip.fare,
          type: 'DEBIT',
          status: 'COMPLETED',
          description: `Trip payment - ${tripId}`,
        }
      });

      // Credit driver's earnings (80%)
      if (trip.driver) {
        await tx.transaction.create({
          data: {
            userId: trip.driver.userId,
            amount: driverEarnings,
            type: 'CREDIT',
            status: 'COMPLETED',
            description: `Trip earnings (80%) - ${tripId}`,
          }
        });

        // Log platform commission (20%)
        await tx.driverCreditLedger.create({
          data: {
            driverId: trip.driver.id,
            tripId,
            action: 'TRIP_DEDUCTION',
            creditsDelta: -platformCommission,
            balanceAfter: 0, // Not affecting credit balance, just logging commission
            amountAfn: platformCommission,
            notes: `Platform commission (20% of ${trip.fare} AFN)`,
          },
        });
      }

      const updatedTrip = await tx.trip.update({
        where: { id: tripId },
        data: { status: 'COMPLETED' },
      });

      return { trip: updatedTrip, transaction };
    });
  }

  private async calculateBalance(userId: string, tx: any) {
    const result = await tx.$queryRaw<[{ balance: number }]>`
      SELECT 
        COALESCE(SUM(CASE WHEN type = 'CREDIT' AND status = 'COMPLETED' THEN amount ELSE 0 END), 0) -
        COALESCE(SUM(CASE WHEN type = 'DEBIT' AND status = 'COMPLETED' THEN amount ELSE 0 END), 0) as balance
      FROM Transaction
      WHERE userId = ${userId}
    `;
    return result[0]?.balance || 0;
  }

  private assertStatusTransition(current: TripStatus, next: TripStatus) {
    const allowed: Record<TripStatus, TripStatus[]> = {
      REQUESTED: ['ACCEPTED', 'CANCELLED'],
      ACCEPTED: ['ARRIVED', 'CANCELLED'],
      ARRIVED: ['IN_PROGRESS', 'CANCELLED'],
      IN_PROGRESS: ['COMPLETED', 'CANCELLED'],
      COMPLETED: [],
      CANCELLED: [],
    };
    if (!allowed[current].includes(next)) {
      throw new AppError(`Invalid status transition ${current} -> ${next}`, 400);
    }
  }

  async updateTripStatus(tripId: string, status: string) {
    // Legacy simple updater kept for backwards compatibility; prefer updateTripStatusSecure
    return await prisma.trip.update({
      where: { id: tripId },
      data: { status: status as any },
    });
  }

  async getTripByIdWithOwnership(
    tripId: string,
    user: { id: string; role: string }
  ) {
    const trip = await prisma.trip.findUnique({
      where: { id: tripId },
      include: { metadata: true, rider: true, driver: { include: { user: true } } },
    });
    if (!trip) throw new AppError('Trip not found', 404);

    if (user.role !== 'ADMIN') {
      const isRider = trip.riderId === user.id;
      const isDriver = !!trip.driver && trip.driver.userId === user.id;
      if (!isRider && !isDriver) {
        throw new AppError('Forbidden', 403);
      }
    }
    return trip;
  }

  async updateTripStatusSecure(
    tripId: string,
    status: string,
    user: { id: string; role: string }
  ) {
    const desired = status.toUpperCase() as TripStatus;
    if (!Object.values(TripStatus).includes(desired)) {
      throw new AppError('Invalid status', 400);
    }

    return await prisma.$transaction(async (tx) => {
      const trip = await tx.trip.findUnique({
        where: { id: tripId },
        include: { driver: true },
      });
      if (!trip) throw new AppError('Trip not found', 404);

      if (user.role !== 'ADMIN') {
        const isRider = trip.riderId === user.id;
        const isDriver = !!trip.driver && trip.driver.userId === user.id;
        if (!isRider && !isDriver) {
          throw new AppError('Forbidden', 403);
        }
      }

      this.assertStatusTransition(trip.status as TripStatus, desired);

      const updated = await tx.trip.update({
        where: { id: tripId },
        data: { status: desired },
      });
      return updated;
    });
  }

  async getTripById(tripId: string) {
    return await prisma.trip.findUnique({
      where: { id: tripId },
      include: { metadata: true, rider: true, driver: { include: { user: true } } },
    });
  }

  async getUserTrips(userId: string, role: string) {
    if (role === 'RIDER') {
      return await prisma.trip.findMany({
        where: { riderId: userId },
        orderBy: { createdAt: 'desc' },
        include: { metadata: true, driver: { include: { user: true } } },
      });
    } else {
      const driver = await prisma.driver.findUnique({ where: { userId } });
      if (!driver) return [];
      return await prisma.trip.findMany({
        where: { driverId: driver.id },
        orderBy: { createdAt: 'desc' },
        include: { metadata: true, rider: true },
      });
    }
  }

  async getTripMessages(tripId: string, user: { id: string; role: string }) {
    const trip = await this.getTripForParticipantChecks(tripId);

    if (user.role !== 'ADMIN') {
      this.resolveTripParticipant(trip, user);
    }

    return prisma.tripMessage.findMany({
      where: { tripId },
      orderBy: { createdAt: 'asc' },
    });
  }

  async sendTripMessage(
    tripId: string,
    user: { id: string; role: string },
    payload: { text: string; channel: MessageChannel },
    io?: any
  ) {
    const trip = await this.getTripForParticipantChecks(tripId);
    const participant = this.resolveTripParticipant(trip, user);

    let messageId: string | null = null;
    let deliveryStatus: MessageDeliveryStatus = 'SENT';
    let deliveryError: string | null = null;

    if (payload.channel === 'WHATSAPP') {
      try {
        messageId = await whatsappService.sendMessage(participant.toPhone, payload.text);
      } catch (error: any) {
        deliveryStatus = 'FAILED';
        deliveryError = String(error?.message || 'WhatsApp send failed');
      }
    }

    const message = await prisma.tripMessage.create({
      data: {
        tripId,
        fromUserId: user.id,
        toUserId: participant.toUserId,
        channel: payload.channel,
        body: payload.text,
        messageId,
        deliveryStatus,
        deliveryError,
      },
    });

    if (io) {
      const eventPayload = {
        id: message.id,
        tripId: message.tripId,
        fromUserId: message.fromUserId,
        toUserId: message.toUserId,
        body: message.body,
        channel: message.channel,
        deliveryStatus: message.deliveryStatus,
        createdAt: message.createdAt,
      };

      io.to(`user:${participant.toUserId}`).emit('trip:message:new', eventPayload);
      io.to(`user:${user.id}`).emit('trip:message:new', eventPayload);
    }

    if (payload.channel === 'WHATSAPP' && message.deliveryStatus === 'FAILED') {
      throw new AppError(message.deliveryError || 'Failed to send WhatsApp message', 502);
    }

    return message;
  }

  async rateTrip(
    tripId: string,
    user: { id: string; role: string },
    payload: { score: number; comment?: string }
  ) {
    const trip = await this.getTripForParticipantChecks(tripId);
    const participant = this.resolveTripParticipant(trip, user);

    if (trip.status !== 'COMPLETED') {
      throw new AppError('Trip must be completed before rating', 400);
    }

    if (payload.score < 1 || payload.score > 5) {
      throw new AppError('Score must be between 1 and 5', 400);
    }

    let rating;
    try {
      rating = await prisma.tripRating.create({
        data: {
          tripId,
          fromUserId: user.id,
          toUserId: participant.toUserId,
          fromRole: participant.fromRole,
          toRole: participant.toRole,
          score: payload.score,
          comment: payload.comment,
        },
      });
    } catch (error: any) {
      if (error?.code === 'P2002') {
        throw new AppError('You have already submitted a rating for this trip', 400);
      }
      throw error;
    }

    if (participant.toRole === 'DRIVER') {
      const aggregate = await prisma.tripRating.aggregate({
        where: {
          toRole: 'DRIVER',
          toUserId: participant.toUserId,
        },
        _avg: { score: true },
      });

      const avg = aggregate._avg.score ?? 5;
      await prisma.driver.updateMany({
        where: { userId: participant.toUserId },
        data: {
          rating: avg,
        },
      });
    }

    return rating;
  }

  async getTripRatings(tripId: string, user: { id: string; role: string }) {
    const trip = await this.getTripForParticipantChecks(tripId);

    if (user.role !== 'ADMIN') {
      this.resolveTripParticipant(trip, user);
    }

    return prisma.tripRating.findMany({
      where: { tripId },
      orderBy: { createdAt: 'asc' },
    });
  }

  async getScheduledTrips(userId: string, role: string) {
    const now = new Date();
    const baseWhere: Prisma.TripWhereInput = {
      metadata: {
        is: {
          isScheduled: true,
          scheduledFor: { gte: new Date(now.getTime() - 24 * 60 * 60 * 1000) },
        },
      },
    };

    if (role === 'ADMIN') {
      return prisma.trip.findMany({
        where: baseWhere,
        include: { metadata: true, rider: true, driver: { include: { user: true } } },
        orderBy: { createdAt: 'desc' },
      });
    }

    if (role === 'RIDER') {
      return prisma.trip.findMany({
        where: { ...baseWhere, riderId: userId },
        include: { metadata: true, driver: { include: { user: true } } },
        orderBy: { createdAt: 'desc' },
      });
    }

    const driver = await prisma.driver.findUnique({ where: { userId } });
    if (!driver) return [];
    return prisma.trip.findMany({
      where: { ...baseWhere, driverId: driver.id },
      include: { metadata: true, rider: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createPhoneBooking(
    data: {
      riderPhone: string;
      riderName: string;
      pickupLat: number;
      pickupLng: number;
      dropLat: number;
      dropLng: number;
      fare: number;
      distance: number;
      duration: number;
      serviceType?: string;
      paymentMethod?: 'CASH' | 'WALLET';
      scheduledFor?: string;
      womenOnly?: boolean;
      serviceClass?: string;
      specialInstructions?: string;
      requestedFor?: { name: string; phone: string };
      stops?: Array<{ lat: number; lng: number; label?: string }>;
    },
    io?: any
  ) {
    let rider = await prisma.user.findUnique({ where: { phone: data.riderPhone } });
    if (!rider) {
      rider = await prisma.user.create({
        data: {
          phone: data.riderPhone,
          name: data.riderName,
          role: 'RIDER',
        },
      });
    }

    return this.createTrip(
      {
        riderId: rider.id,
        pickupLat: data.pickupLat,
        pickupLng: data.pickupLng,
        dropLat: data.dropLat,
        dropLng: data.dropLng,
        fare: data.fare,
        distance: data.distance,
        duration: data.duration,
        serviceType: data.serviceType,
        paymentMethod: data.paymentMethod,
        scheduledFor: data.scheduledFor,
        womenOnly: data.womenOnly,
        serviceClass: data.serviceClass,
        specialInstructions: data.specialInstructions,
        requestedFor: data.requestedFor || {
          name: data.riderName,
          phone: data.riderPhone,
        },
        stops: data.stops,
        bookingChannel: 'PHONE',
      },
      io
    );
  }

  async processDueScheduledTrips(io?: any) {
    const dueTrips = await prisma.trip.findMany({
      where: {
        status: 'REQUESTED',
        driverId: null,
        metadata: {
          is: {
            isScheduled: true,
            scheduledFor: { lte: new Date() },
            scheduledDispatchedAt: null,
          },
        },
      },
      include: { metadata: true },
      take: 100,
    });

    for (const trip of dueTrips) {
      await dispatchService.findAndOfferDrivers(
        trip.id,
        trip.pickupLat,
        trip.pickupLng,
        trip.serviceType || 'city',
        io
      );

      await prisma.tripMetadata.update({
        where: { tripId: trip.id },
        data: { scheduledDispatchedAt: new Date() },
      });

      logger.info('Scheduled trip dispatched', { tripId: trip.id });
    }

    return dueTrips.length;
  }

  async triggerSOS(tripId: string, userId: string, ipAddress?: string, userAgent?: string, io?: any) {
    const trip = await prisma.trip.findUnique({
      where: { id: tripId },
      include: { rider: true, driver: { include: { user: true } } },
    });

    if (!trip) throw new AppError('Trip not found', 404);
    if (trip.riderId !== userId && trip.driver?.userId !== userId) {
      throw new AppError('Unauthorized', 403);
    }

    // Log SOS event
    await logAudit(
      userId,
      'SOS_TRIGGERED',
      {
        tripId,
        riderId: trip.riderId,
        driverId: trip.driverId,
        location: { lat: trip.pickupLat, lng: trip.pickupLng },
        status: trip.status,
      },
      ipAddress,
      userAgent
    );

    // Send WhatsApp alert to admin (get first admin user)
    const admin = await prisma.user.findFirst({ where: { role: 'ADMIN' } });
    if (admin?.phone) {
      const message = `🚨 EMERGENCY SOS ALERT\n\nTrip ID: ${tripId}\nRider: ${trip.rider.name} (${trip.rider.phone})\nDriver: ${trip.driver?.user.name || 'N/A'} (${trip.driver?.user.phone || 'N/A'})\nStatus: ${trip.status}\nLocation: ${trip.pickupLat}, ${trip.pickupLng}\n\nImmediate action required!`;
      
      try {
        await whatsappService.sendMessage(admin.phone, message);
      } catch (error) {
        logger.error('Failed to send SOS WhatsApp alert', { error });
      }
    }

    // Emit real-time alert to admin dashboard
    if (io) {
      io.to('admin').emit('sos:alert', {
      tripId,
      riderId: trip.riderId,
      riderName: trip.rider.name,
      riderPhone: trip.rider.phone,
      driverId: trip.driverId,
      driverName: trip.driver?.user.name,
      driverPhone: trip.driver?.user.phone,
      location: { lat: trip.pickupLat, lng: trip.pickupLng },
      timestamp: new Date(),
    });
    }

    logger.warn('SOS triggered', { tripId, userId });

    return { message: 'Emergency alert sent', tripId };
  }

  async markPaymentCollected(tripId: string, paymentMethod: string) {
    const trip = await prisma.trip.findUnique({ where: { id: tripId } });
    if (!trip) throw new AppError('Trip not found', 404);
    if (trip.status !== 'COMPLETED') throw new AppError('Trip not completed', 400);

    return await prisma.trip.update({
      where: { id: tripId },
      data: {
        paymentMethod,
        paymentStatus: paymentMethod === 'CASH' ? 'CASH_COLLECTED' : 'PAID',
      },
    });
  }

  async settleTrip(tripId: string, user: { id: string; role: string }) {
    return await prisma.$transaction(async (tx) => {
      const trip = await tx.trip.findUnique({ where: { id: tripId } });
      if (!trip) throw new AppError('Trip not found', 404);

      if (trip.status !== 'COMPLETED') {
        throw new AppError('Trip must be completed before settlement', 400);
      }

      if (trip.paymentMethod === 'WALLET') {
        if (user.role !== 'ADMIN' && trip.riderId !== user.id) {
          throw new AppError('Forbidden', 403);
        }

        await paymentService.deductTripPayment(trip.riderId, trip.id, trip.fare);
        await tx.trip.update({
          where: { id: tripId },
          data: { paymentStatus: 'PAID' },
        });
      } else {
        // CASH: only assigned driver or admin can confirm collection
        if (user.role !== 'ADMIN') {
          const driver = await tx.driver.findFirst({
            where: { id: trip.driverId!, userId: user.id },
          });
          if (!driver) throw new AppError('Only assigned driver can mark cash collected', 403);
        }
        await tx.trip.update({
          where: { id: tripId },
          data: { paymentStatus: 'CASH_COLLECTED' },
        });
      }

      return await tx.trip.findUnique({ where: { id: tripId } });
    });
  }
}
