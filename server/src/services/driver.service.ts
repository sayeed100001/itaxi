import prisma from '../config/database';
import { AppError } from '../middlewares/errorHandler';

export class DriverService {
  async createDriver(userId: string, data: { vehicleType: string; plateNumber: string; baseFare?: number; perKmRate?: number }) {
    const existing = await prisma.driver.findUnique({ where: { userId } });
    if (existing) throw new AppError('Driver profile already exists', 400);

    return await prisma.driver.create({ data: { userId, ...data } });
  }

  async updateDriverStatus(userId: string, status: 'ONLINE' | 'OFFLINE' | 'BUSY') {
    const driver = await prisma.driver.findUnique({ where: { userId } });
    if (!driver) throw new AppError('Driver not found', 404);

    // Validate credits before going ONLINE
    if (status === 'ONLINE') {
      if (driver.creditBalance <= 0) {
        throw new AppError('Insufficient credits. Please purchase a credit package to go online.', 403);
      }
      if (driver.creditExpiresAt && driver.creditExpiresAt < new Date()) {
        throw new AppError('Your credit package has expired. Please purchase a new package.', 403);
      }
    }

    return await prisma.driver.update({
      where: { userId },
      data: { status },
    });
  }

  async updateDriverLocation(driverId: string, lat: number, lng: number, bearing?: number) {
    return await prisma.driverLocation.upsert({
      where: { driverId },
      update: { lat, lng },
      create: { driverId, lat, lng },
    });
  }

  async getAvailableDrivers() {
    return await prisma.driver.findMany({
      where: {
        status: 'ONLINE',
        creditBalance: { gt: 0 },
        creditExpiresAt: { gt: new Date() },
      },
      include: { user: true, location: true },
    });
  }

  async getDriverByUserId(userId: string) {
    return await prisma.driver.findUnique({
      where: { userId },
      include: { user: true, location: true },
    });
  }
}
