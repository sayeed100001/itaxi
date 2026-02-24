import { Response, NextFunction } from 'express';
import prisma from '../config/database';
import { AuthRequest } from '../middlewares/auth';

type FeedType = 'promo' | 'system' | 'success' | 'alert';

interface FeedItem {
  id: string;
  type: FeedType;
  title: string;
  message: string;
  timestamp: number;
  read: boolean;
}

const mapTripStatus = (status: string): { title: string; type: FeedType } => {
  if (status === 'COMPLETED') return { title: 'Trip Completed', type: 'success' };
  if (status === 'CANCELLED') return { title: 'Trip Cancelled', type: 'alert' };
  if (status === 'IN_PROGRESS') return { title: 'Trip In Progress', type: 'system' };
  if (status === 'ARRIVED') return { title: 'Driver Arrived', type: 'system' };
  if (status === 'ACCEPTED') return { title: 'Driver Assigned', type: 'success' };
  return { title: 'Trip Requested', type: 'system' };
};

export class NotificationsController {
  async getFeed(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const limit = Math.max(1, Math.min(100, Number(req.query.limit) || 50));
      const user = req.user!;
      const items: FeedItem[] = [];

      if (user.role === 'RIDER') {
        const trips = await prisma.trip.findMany({
          where: { riderId: user.id },
          include: { metadata: true, driver: { include: { user: true } } },
          orderBy: { updatedAt: 'desc' },
          take: limit,
        });

        for (const trip of trips) {
          const mapped = mapTripStatus(trip.status);
          const forOtherSuffix = trip.metadata?.requestedForName
            ? ` for ${trip.metadata.requestedForName}`
            : '';
          items.push({
            id: `trip_${trip.id}`,
            type: mapped.type,
            title: mapped.title,
            message: `${mapped.title}${forOtherSuffix}. Fare: ${trip.fare}`,
            timestamp: new Date(trip.updatedAt).getTime(),
            read: false,
          });
        }
      }

      if (user.role === 'DRIVER') {
        const driver = await prisma.driver.findUnique({ where: { userId: user.id } });

        if (driver) {
          const [trips, payouts, rideNotifications] = await Promise.all([
            prisma.trip.findMany({
              where: { driverId: driver.id },
              include: { rider: true, metadata: true },
              orderBy: { updatedAt: 'desc' },
              take: limit,
            }),
            prisma.payout.findMany({
              where: { driverId: driver.id },
              orderBy: { createdAt: 'desc' },
              take: 20,
            }),
            prisma.rideNotification.findMany({
              where: { driverId: driver.id },
              orderBy: { createdAt: 'desc' },
              take: 20,
            }),
          ]);

          for (const trip of trips) {
            const mapped = mapTripStatus(trip.status);
            items.push({
              id: `driver_trip_${trip.id}`,
              type: mapped.type,
              title: mapped.title,
              message: `Trip for ${trip.rider.name} (${trip.serviceType}).`,
              timestamp: new Date(trip.updatedAt).getTime(),
              read: false,
            });
          }

          for (const payout of payouts) {
            items.push({
              id: `payout_${payout.id}`,
              type: payout.status === 'COMPLETED' ? 'success' : payout.status === 'FAILED' ? 'alert' : 'system',
              title: `Payout ${payout.status}`,
              message: `Amount: ${payout.amount}`,
              timestamp: new Date(payout.updatedAt).getTime(),
              read: false,
            });
          }

          for (const notification of rideNotifications) {
            items.push({
              id: `ride_notification_${notification.id}`,
              type: notification.status === 'FAILED' ? 'alert' : 'system',
              title: `Ride Offer Notification ${notification.status}`,
              message: `Trip ID: ${notification.tripId}`,
              timestamp: new Date(notification.createdAt).getTime(),
              read: false,
            });
          }
        }
      }

      if (user.role === 'ADMIN') {
        const [recentTrips, sosLogs, pendingPayouts] = await Promise.all([
          prisma.trip.findMany({
            orderBy: { updatedAt: 'desc' },
            take: limit,
            include: { rider: true, driver: { include: { user: true } }, metadata: true },
          }),
          prisma.auditLog.findMany({
            where: { action: 'SOS_TRIGGERED' },
            orderBy: { createdAt: 'desc' },
            take: 20,
          }),
          prisma.payout.findMany({
            where: { status: 'PENDING_MANUAL_REVIEW' },
            orderBy: { createdAt: 'desc' },
            take: 20,
            include: { driver: { include: { user: true } } },
          }),
        ]);

        for (const trip of recentTrips) {
          const mapped = mapTripStatus(trip.status);
          items.push({
            id: `admin_trip_${trip.id}`,
            type: mapped.type,
            title: mapped.title,
            message: `Rider: ${trip.rider.name} | Service: ${trip.serviceType}`,
            timestamp: new Date(trip.updatedAt).getTime(),
            read: false,
          });
        }

        for (const log of sosLogs) {
          items.push({
            id: `sos_${log.id}`,
            type: 'alert',
            title: 'SOS Alert Triggered',
            message: log.details || 'Emergency incident reported.',
            timestamp: new Date(log.createdAt).getTime(),
            read: false,
          });
        }

        for (const payout of pendingPayouts) {
          items.push({
            id: `admin_payout_${payout.id}`,
            type: 'system',
            title: 'Pending Payout Review',
            message: `${payout.driver.user.name} requested ${payout.amount}`,
            timestamp: new Date(payout.createdAt).getTime(),
            read: false,
          });
        }
      }

      const sorted = items
        .sort((a, b) => b.timestamp - a.timestamp)
        .slice(0, limit);

      res.json({ success: true, data: sorted });
    } catch (error) {
      next(error);
    }
  }
}
