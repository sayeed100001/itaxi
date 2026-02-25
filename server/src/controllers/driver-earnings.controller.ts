import { Response, NextFunction } from 'express';
import prisma from '../config/database';
import { AuthRequest } from '../middlewares/auth';

export class DriverEarningsController {
  // Get driver earnings summary
  async getEarningsSummary(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const driver = await prisma.driver.findUnique({
        where: { userId: req.user!.id },
      });

      if (!driver) {
        return res.status(404).json({ success: false, message: 'Driver not found' });
      }

      const now = new Date();
      const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const startOfWeek = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

      const [todayEarnings, weekEarnings, monthEarnings, totalEarnings, todayTrips, weekTrips, monthTrips, totalTrips] = await Promise.all([
        prisma.trip.aggregate({
          where: { driverId: driver.id, status: 'COMPLETED', createdAt: { gte: startOfToday } },
          _sum: { fare: true },
        }),
        prisma.trip.aggregate({
          where: { driverId: driver.id, status: 'COMPLETED', createdAt: { gte: startOfWeek } },
          _sum: { fare: true },
        }),
        prisma.trip.aggregate({
          where: { driverId: driver.id, status: 'COMPLETED', createdAt: { gte: startOfMonth } },
          _sum: { fare: true },
        }),
        prisma.trip.aggregate({
          where: { driverId: driver.id, status: 'COMPLETED' },
          _sum: { fare: true },
        }),
        prisma.trip.count({
          where: { driverId: driver.id, status: 'COMPLETED', createdAt: { gte: startOfToday } },
        }),
        prisma.trip.count({
          where: { driverId: driver.id, status: 'COMPLETED', createdAt: { gte: startOfWeek } },
        }),
        prisma.trip.count({
          where: { driverId: driver.id, status: 'COMPLETED', createdAt: { gte: startOfMonth } },
        }),
        prisma.trip.count({
          where: { driverId: driver.id, status: 'COMPLETED' },
        }),
      ]);

      const avgRating = await prisma.tripRating.aggregate({
        where: { 
          toUserId: driver.userId,
          toRole: 'DRIVER'
        },
        _avg: { score: true },
        _count: true,
      });

      res.json({
        success: true,
        data: {
          today: {
            earnings: Number((todayEarnings._sum.fare || 0).toFixed(2)),
            trips: todayTrips,
          },
          week: {
            earnings: Number((weekEarnings._sum.fare || 0).toFixed(2)),
            trips: weekTrips,
          },
          month: {
            earnings: Number((monthEarnings._sum.fare || 0).toFixed(2)),
            trips: monthTrips,
          },
          total: {
            earnings: Number((totalEarnings._sum.fare || 0).toFixed(2)),
            trips: totalTrips,
          },
          rating: {
            average: Number((avgRating._avg.score || 0).toFixed(2)),
            count: avgRating._count,
          },
        },
      });
    } catch (error) {
      next(error);
    }
  }

  // Get daily earnings for chart (last 30 days)
  async getDailyEarnings(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const driver = await prisma.driver.findUnique({
        where: { userId: req.user!.id },
      });

      if (!driver) {
        return res.status(404).json({ success: false, message: 'Driver not found' });
      }

      const last30Days = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

      const dailyData = await prisma.$queryRaw<Array<{ date: string; earnings: number | null; trips: number | bigint }>>`
        SELECT
          DATE(createdAt) AS date,
          COALESCE(SUM(fare), 0) AS earnings,
          COUNT(*) AS trips
        FROM Trip
        WHERE driverId = ${driver.id} AND status = 'COMPLETED' AND createdAt >= ${last30Days}
        GROUP BY DATE(createdAt)
        ORDER BY date ASC
      `;

      res.json({
        success: true,
        data: dailyData.map((d) => ({
          date: d.date,
          earnings: Number((d.earnings || 0).toFixed(2)),
          trips: typeof d.trips === 'bigint' ? Number(d.trips) : d.trips,
        })),
      });
    } catch (error) {
      next(error);
    }
  }

  // Get trip history with pagination
  async getTripHistory(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const driver = await prisma.driver.findUnique({
        where: { userId: req.user!.id },
      });

      if (!driver) {
        return res.status(404).json({ success: false, message: 'Driver not found' });
      }

      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      const skip = (page - 1) * limit;

      const [trips, total] = await Promise.all([
        prisma.trip.findMany({
          where: { driverId: driver.id },
          include: {
            rider: {
              select: { id: true, name: true, phone: true },
            },
          },
          orderBy: { createdAt: 'desc' },
          skip,
          take: limit,
        }),
        prisma.trip.count({ where: { driverId: driver.id } }),
      ]);

      res.json({
        success: true,
        data: {
          trips,
          pagination: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit),
          },
        },
      });
    } catch (error) {
      next(error);
    }
  }

  // Get performance metrics
  async getPerformanceMetrics(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const driver = await prisma.driver.findUnique({
        where: { userId: req.user!.id },
      });

      if (!driver) {
        return res.status(404).json({ success: false, message: 'Driver not found' });
      }

      const [completedTrips, cancelledTrips, avgTripDuration, avgTripDistance, peakHours] = await Promise.all([
        prisma.trip.count({ where: { driverId: driver.id, status: 'COMPLETED' } }),
        prisma.trip.count({ where: { driverId: driver.id, status: 'CANCELLED' } }),
        prisma.trip.aggregate({
          where: { driverId: driver.id, status: 'COMPLETED' },
          _avg: { duration: true },
        }),
        prisma.trip.aggregate({
          where: { driverId: driver.id, status: 'COMPLETED' },
          _avg: { distance: true },
        }),
        prisma.$queryRaw<Array<{ hour: number; trips: number | bigint }>>`
          SELECT
            HOUR(createdAt) AS hour,
            COUNT(*) AS trips
          FROM Trip
          WHERE driverId = ${driver.id} AND status = 'COMPLETED'
          GROUP BY HOUR(createdAt)
          ORDER BY trips DESC
          LIMIT 3
        `,
      ]);

      const totalTrips = completedTrips + cancelledTrips;
      const completionRate = totalTrips > 0 ? (completedTrips / totalTrips) * 100 : 0;

      res.json({
        success: true,
        data: {
          completionRate: Number(completionRate.toFixed(2)),
          avgTripDuration: Number(((avgTripDuration._avg.duration || 0) / 60).toFixed(2)), // minutes
          avgTripDistance: Number(((avgTripDistance._avg.distance || 0) / 1000).toFixed(2)), // km
          peakHours: peakHours.map((h) => ({
            hour: h.hour,
            trips: typeof h.trips === 'bigint' ? Number(h.trips) : h.trips,
          })),
        },
      });
    } catch (error) {
      next(error);
    }
  }
}
