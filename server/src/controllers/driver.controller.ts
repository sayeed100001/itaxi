import { Response, NextFunction } from 'express';
import { DriverService } from '../services/driver.service';
import { AuthRequest } from '../middlewares/auth';
import { z } from 'zod';
import { driverCreditService } from '../services/driverCredit.service';
import prisma from '../config/database';
import { AppError } from '../middlewares/errorHandler';

const driverService = new DriverService();

const createDriverSchema = z.object({
  vehicleType: z.string(),
  plateNumber: z.string(),
  baseFare: z.number().optional(),
  perKmRate: z.number().optional(),
});

const updateLocationSchema = z.object({
  lat: z.number(),
  lng: z.number(),
  bearing: z.number().optional(),
});

const creditRequestSchema = z.object({
  packageName: z.string(),
  credits: z.number().int().positive(),
  amountAfn: z.number().positive(),
  months: z.number().int().positive().default(1),
  paymentMethod: z.enum(['CASH', 'MOBILE_MONEY', 'BANK_TRANSFER']).default('CASH'),
  paymentReference: z.string().optional(),
  notes: z.string().optional()
});

export class DriverController {
  async createDriver(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const data = createDriverSchema.parse(req.body);
      const driver = await driverService.createDriver(req.user!.id, data);
      res.status(201).json({ success: true, data: driver });
    } catch (error) {
      next(error);
    }
  }

  async updateStatus(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { status } = req.body;
      const driver = await driverService.updateDriverStatus(req.user!.id, status);
      res.json({ success: true, data: driver });
    } catch (error) {
      next(error);
    }
  }

  async updateLocation(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const data = updateLocationSchema.parse(req.body);
      const driver = await driverService.getDriverByUserId(req.user!.id);
      if (!driver) throw new Error('Driver not found');
      
      const location = await driverService.updateDriverLocation(driver.id, data.lat, data.lng, data.bearing);
      res.json({ success: true, data: location });
    } catch (error) {
      next(error);
    }
  }

  async getAvailableDrivers(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const drivers = await driverService.getAvailableDrivers();
      res.json({ success: true, data: drivers });
    } catch (error) {
      next(error);
    }
  }

  async getDriver(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const driver = await driverService.getDriverByUserId(req.user!.id);
      res.json({ success: true, data: driver });
    } catch (error) {
      next(error);
    }
  }

  async getCreditStatus(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const status = await driverCreditService.getDriverCreditStatusByUserId(req.user!.id);
      res.json({ success: true, data: status });
    } catch (error) {
      next(error);
    }
  }

  async getCreditLedger(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const driver = await driverService.getDriverByUserId(req.user!.id);
      if (!driver) throw new Error('Driver not found');
      const limit = Math.max(1, Math.min(200, Number(req.query.limit) || 50));
      const rows = await driverCreditService.getDriverCreditLedger(driver.id, limit);
      res.json({ success: true, data: rows });
    } catch (error) {
      next(error);
    }
  }

  async requestCreditPurchase(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const driver = await driverService.getDriverByUserId(req.user!.id);
      if (!driver) throw new AppError('Driver profile not found', 404);

      const data = creditRequestSchema.parse(req.body);

      const request = await prisma.creditPurchaseRequest.create({
        data: {
          driverId: driver.id,
          packageName: data.packageName,
          credits: data.credits,
          amountAfn: data.amountAfn,
          months: data.months,
          paymentMethod: data.paymentMethod,
          paymentReference: data.paymentReference,
          notes: data.notes
        }
      });

      res.status(201).json({ success: true, data: request, message: 'Credit purchase request submitted successfully' });
    } catch (error) {
      next(error);
    }
  }

  async getMyCreditRequests(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const driver = await driverService.getDriverByUserId(req.user!.id);
      if (!driver) throw new AppError('Driver profile not found', 404);

      const requests = await prisma.creditPurchaseRequest.findMany({
        where: { driverId: driver.id },
        orderBy: { requestedAt: 'desc' },
        take: 50
      });

      res.json({ success: true, data: requests });
    } catch (error) {
      next(error);
    }
  }

  async getCreditPackages(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const packages = await prisma.creditPackage.findMany({
        where: { active: true },
        orderBy: { priceAfn: 'asc' }
      });

      res.json({ success: true, data: packages });
    } catch (error) {
      next(error);
    }
  }
}
