import { Response, NextFunction } from 'express';
import prisma from '../config/database';
import { AuthRequest } from '../middlewares/auth';

export class AdminDriversController {
  // Get all drivers with filtering by city/province/status
  async getAllDrivers(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { city, province, status, search } = req.query;

      const where: any = {};

      if (city) where.city = city;
      if (province) where.province = province;
      if (status) where.status = status;

      const drivers = await prisma.driver.findMany({
        where,
        include: {
          user: {
            select: {
              id: true,
              name: true,
              phone: true,
              email: true,
              city: true,
              province: true,
            },
          },
          location: true,
          _count: {
            select: {
              trips: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      });

      // Apply search filter if provided
      let filteredDrivers = drivers;
      if (search && typeof search === 'string') {
        const searchLower = search.toLowerCase();
        filteredDrivers = drivers.filter(
          (d) =>
            d.user.name.toLowerCase().includes(searchLower) ||
            d.user.phone.includes(searchLower) ||
            d.plateNumber?.toLowerCase().includes(searchLower) ||
            d.vehicleType?.toLowerCase().includes(searchLower)
        );
      }

      // Calculate earnings for each driver
      const driversWithStats = await Promise.all(
        filteredDrivers.map(async (driver) => {
          try {
            const earnings = await prisma.trip.aggregate({
              where: {
                driverId: driver.id,
                status: 'COMPLETED',
              },
              _sum: { fare: true },
              _count: true,
            });

            const rating = await prisma.tripRating.aggregate({
              where: {
                toUserId: driver.userId,
                toRole: 'DRIVER',
              },
              _avg: { score: true },
              _count: true,
            });

            return {
              id: driver.id,
              userId: driver.userId,
              name: driver.user.name,
              phone: driver.user.phone,
              email: driver.user.email,
              city: driver.city,
              province: driver.province,
              status: driver.status,
              vehicleType: driver.vehicleType,
              plateNumber: driver.plateNumber,
              baseFare: driver.baseFare,
              perKmRate: driver.perKmRate,
              creditBalance: driver.creditBalance,
              creditExpiresAt: driver.creditExpiresAt,
              totalTrips: driver._count.trips,
              completedTrips: earnings._count,
              totalEarnings: Number((earnings._sum.fare || 0).toFixed(2)),
              rating: Number((rating._avg.score || 0).toFixed(2)),
              ratingCount: rating._count,
              location: driver.location
                ? {
                    lat: driver.location.lat,
                    lng: driver.location.lng,
                    updatedAt: driver.location.updatedAt,
                  }
                : null,
              createdAt: driver.createdAt,
              updatedAt: driver.updatedAt,
            };
          } catch (error) {
            console.error(`Error calculating stats for driver ${driver.id}:`, error);
            return {
              id: driver.id,
              userId: driver.userId,
              name: driver.user.name,
              phone: driver.user.phone,
              email: driver.user.email,
              city: driver.city,
              province: driver.province,
              status: driver.status,
              vehicleType: driver.vehicleType,
              plateNumber: driver.plateNumber,
              baseFare: driver.baseFare,
              perKmRate: driver.perKmRate,
              creditBalance: driver.creditBalance,
              creditExpiresAt: driver.creditExpiresAt,
              totalTrips: 0,
              completedTrips: 0,
              totalEarnings: 0,
              rating: 0,
              ratingCount: 0,
              location: null,
              createdAt: driver.createdAt,
              updatedAt: driver.updatedAt,
            };
          }
        })
      );

      res.json({
        success: true,
        data: driversWithStats,
      });
    } catch (error) {
      next(error);
    }
  }

  // Get drivers grouped by city
  async getDriversByCity(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { province } = req.query;

      const where: any = {};
      if (province) where.province = province;

      const drivers = await prisma.driver.findMany({
        where,
        include: {
          user: {
            select: { name: true, phone: true, city: true, province: true },
          },
          location: true,
        },
      });

      // Group by city
      const byCity: Record<string, any[]> = {};
      drivers.forEach((driver) => {
        const city = driver.city || 'unknown';
        if (!byCity[city]) byCity[city] = [];
        byCity[city].push({
          id: driver.id,
          name: driver.user.name,
          phone: driver.user.phone,
          status: driver.status,
          vehicleType: driver.vehicleType,
          plateNumber: driver.plateNumber,
          creditBalance: driver.creditBalance,
          location: driver.location
            ? { lat: driver.location.lat, lng: driver.location.lng }
            : null,
        });
      });

      // Calculate stats per city
      const cityStats = Object.entries(byCity).map(([city, driversList]) => ({
        city,
        totalDrivers: driversList.length,
        onlineDrivers: driversList.filter((d) => d.status === 'ONLINE').length,
        offlineDrivers: driversList.filter((d) => d.status === 'OFFLINE').length,
        drivers: driversList,
      }));

      res.json({
        success: true,
        data: cityStats,
      });
    } catch (error) {
      next(error);
    }
  }

  // Get driver statistics
  async getDriverStats(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const [total, online, offline, byCity, byProvince, commissionStats] = await Promise.all([
        prisma.driver.count(),
        prisma.driver.count({ where: { status: 'ONLINE' } }),
        prisma.driver.count({ where: { status: 'OFFLINE' } }),
        prisma.driver.groupBy({
          by: ['city'],
          _count: true,
          orderBy: { _count: { city: 'desc' } },
        }),
        prisma.driver.groupBy({
          by: ['province'],
          _count: true,
          orderBy: { _count: { province: 'desc' } },
        }),
        // Calculate total platform commission (20% of all completed trips)
        prisma.trip.aggregate({
          where: { status: 'COMPLETED' },
          _sum: { 
            fare: true,
            platformCommission: true,
            driverEarnings: true
          },
          _count: true,
        }),
      ]);

      res.json({
        success: true,
        data: {
          total,
          online,
          offline,
          byCity: byCity.map((c) => ({ city: c.city, count: c._count })),
          byProvince: byProvince.map((p) => ({ province: p.province, count: p._count })),
          revenue: {
            totalCompletedTrips: commissionStats._count,
            totalFares: Number((commissionStats._sum.fare || 0).toFixed(2)),
            platformCommission: Number((commissionStats._sum.platformCommission || 0).toFixed(2)),
            driverEarnings: Number((commissionStats._sum.driverEarnings || 0).toFixed(2)),
            commissionRate: '20%',
            driverRate: '80%',
          },
        },
      });
    } catch (error) {
      next(error);
    }
  }

  // Update driver details
  async updateDriver(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { driverId } = req.params;
      const { vehicleType, plateNumber, baseFare, perKmRate, status, city, province } = req.body;

      const driver = await prisma.driver.update({
        where: { id: driverId },
        data: {
          vehicleType,
          plateNumber,
          baseFare,
          perKmRate,
          status,
          city,
          province,
        },
        include: {
          user: {
            select: { id: true, name: true, phone: true },
          },
        },
      });

      res.json({
        success: true,
        data: driver,
      });
    } catch (error) {
      next(error);
    }
  }

  // Suspend/Activate driver
  async toggleDriverStatus(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { driverId } = req.params;
      const { status } = req.body;

      if (!['ONLINE', 'OFFLINE', 'SUSPENDED'].includes(status)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid status',
        });
      }

      const driver = await prisma.driver.update({
        where: { id: driverId },
        data: { status },
        include: {
          user: {
            select: { name: true, phone: true },
          },
        },
      });

      res.json({
        success: true,
        data: driver,
        message: `Driver ${status.toLowerCase()} successfully`,
      });
    } catch (error) {
      next(error);
    }
  }
}
