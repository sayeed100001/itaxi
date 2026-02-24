import { Response, NextFunction } from 'express';
import { AuthRequest } from '../middlewares/auth';
import prisma from '../config/database';
import driverCreditService from '../services/driverCredit.service';

export class AdminDriverCreditController {

  // ==========================================
  // CREDIT PACKAGES MANAGEMENT
  // ==========================================

  async getCreditPackages(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const activeOnly = req.query.active !== 'false';
      const packages = await prisma.creditPackage.findMany({
        where: activeOnly ? { active: true } : undefined,
        orderBy: { priceAfn: 'asc' }
      });
      res.json({ success: true, data: packages });
    } catch (error) {
      next(error);
    }
  }

  async createCreditPackage(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { name, priceAfn, credits, durationDays, perKmRate, commissionRate } = req.body;
      const pkg = await prisma.creditPackage.create({
        data: { name, priceAfn, credits, durationDays, perKmRate, commissionRate }
      });
      res.status(201).json({ success: true, data: pkg });
    } catch (error) {
      next(error);
    }
  }

  async updateCreditPackage(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const id = String(req.params.id || '');
      const data = req.body;
      const pkg = await prisma.creditPackage.update({
        where: { id },
        data
      });
      res.json({ success: true, data: pkg });
    } catch (error) {
      next(error);
    }
  }

  async toggleCreditPackageStatus(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const id = String(req.params.id || '');
      const { active } = req.body;
      const pkg = await prisma.creditPackage.update({
        where: { id },
        data: { active }
      });
      res.json({ success: true, data: pkg });
    } catch (error) {
      next(error);
    }
  }

  // ==========================================
  // DRIVER CREDIT MANAGEMENT / BULK OPERATIONS
  // ==========================================

  async getDriversWithCredits(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const limit = Number(req.query.limit) || 300;
      const drivers = await prisma.driver.findMany({
        take: limit,
        include: { user: true }
      });

      const data = drivers.map(d => ({
        driverId: d.id,
        driverName: d.user?.name || 'Unknown',
        phone: d.user?.phone || 'Unknown',
        creditBalance: d.creditBalance,
        creditExpiresAt: d.creditExpiresAt,
        active: Boolean(d.creditExpiresAt && d.creditExpiresAt > new Date() || d.creditBalance > 0),
        status: d.status
      }));

      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  async assignPackageToDriver(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const driverId = String(req.params.driverId || '');
      const { packageId, reason = 'Admin package assignment' } = req.body;

      const pkg = await prisma.creditPackage.findUnique({ where: { id: packageId } });
      if (!pkg) return res.status(404).json({ success: false, message: 'Package not found' });

      await driverCreditService.addCredits(
        driverId,
        pkg.credits,
        req.user!.id,
        reason,
        pkg.name,
        pkg.durationDays
      );

      res.json({ success: true, message: `Package ${pkg.name} assigned to driver successfully` });
    } catch (error) {
      next(error);
    }
  }

  async addCredits(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const driverId = String(req.params.driverId || '');
      const { amount, reason = 'Admin manual addition' } = req.body;

      if (!amount || amount <= 0) return res.status(400).json({ success: false, message: 'Invalid amount' });

      await driverCreditService.addCredits(driverId, amount, req.user!.id, reason);

      const newBalance = await driverCreditService.getBalance(driverId);
      res.json({ success: true, message: 'Credits added successfully', newBalance });
    } catch (error) {
      next(error);
    }
  }

  async deductCredits(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const driverId = String(req.params.driverId || '');
      const { amount, reason = 'Admin manual deduction' } = req.body;

      if (!amount || amount <= 0) return res.status(400).json({ success: false, message: 'Invalid amount' });

      await driverCreditService.deductCredits(driverId, 'ADMIN_DEDUCTION', amount);

      // Log the deduction reason since deductCredits doesn't take notes directly in the signature
      await prisma.driverCreditLedger.updateMany({
        where: { driverId, action: 'TRIP_DEDUCTION', tripId: 'ADMIN_DEDUCTION' },
        data: { notes: reason, action: 'ADMIN_DEDUCT' }
      });

      const newBalance = await driverCreditService.getBalance(driverId);
      res.json({ success: true, message: 'Credits deducted successfully', newBalance });
    } catch (error) {
      if (error instanceof Error && error.message.includes('Insufficient')) {
        return res.status(400).json({ success: false, message: error.message });
      }
      next(error);
    }
  }

  // ==========================================
  // CREDIT PURCHASE REQUESTS
  // ==========================================

  async getCreditPurchaseRequests(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const status = req.query.status as string | undefined;
      const requests = await prisma.creditPurchaseRequest.findMany({
        where: status ? { status: status as any } : undefined,
        include: {
          driver: {
            include: { user: { select: { name: true, phone: true } } }
          }
        },
        orderBy: { requestedAt: 'desc' },
        take: 200
      });
      res.json({ success: true, data: requests });
    } catch (error) {
      next(error);
    }
  }

  async createCreditPurchaseRequest(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { driverId, packageName, credits, amountAfn, months, paymentMethod, paymentReference, notes } = req.body;
      
      const request = await prisma.creditPurchaseRequest.create({
        data: {
          driverId,
          packageName,
          credits,
          amountAfn,
          months: months || 1,
          paymentMethod: paymentMethod || 'CASH',
          paymentReference,
          notes
        },
        include: {
          driver: {
            include: { user: { select: { name: true, phone: true } } }
          }
        }
      });

      res.status(201).json({ success: true, data: request });
    } catch (error) {
      next(error);
    }
  }

  async approveCreditRequest(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const id = String(req.params.id || '');
      const { reviewNotes } = req.body;

      const request = await prisma.creditPurchaseRequest.findUnique({ where: { id } });
      if (!request) return res.status(404).json({ success: false, message: 'Request not found' });
      if (request.status !== 'PENDING') return res.status(400).json({ success: false, message: 'Request already processed' });

      await prisma.$transaction(async (tx) => {
        await tx.creditPurchaseRequest.update({
          where: { id },
          data: {
            status: 'APPROVED',
            reviewedAt: new Date(),
            reviewedByUserId: req.user!.id,
            reviewNotes
          }
        });

        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + (request.months * 30));

        const driver = await tx.driver.findUnique({ where: { id: request.driverId } });
        const newBalance = (driver?.creditBalance || 0) + request.credits;

        await tx.driver.update({
          where: { id: request.driverId },
          data: {
            creditBalance: newBalance,
            creditExpiresAt: expiresAt,
            monthlyPackage: request.packageName
          }
        });

        await tx.driverCreditLedger.create({
          data: {
            driverId: request.driverId,
            actorUserId: req.user!.id,
            action: 'PURCHASE_MONTHLY_PACKAGE',
            creditsDelta: request.credits,
            balanceAfter: newBalance,
            amountAfn: request.amountAfn,
            paymentMethod: request.paymentMethod,
            paymentReference: request.paymentReference,
            packageName: request.packageName,
            notes: `Approved by admin. ${reviewNotes || ''}`
          }
        });
      });

      res.json({ success: true, message: 'Credit request approved successfully' });
    } catch (error) {
      next(error);
    }
  }

  async rejectCreditRequest(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const id = String(req.params.id || '');
      const { reviewNotes } = req.body;

      const request = await prisma.creditPurchaseRequest.findUnique({ where: { id } });
      if (!request) return res.status(404).json({ success: false, message: 'Request not found' });
      if (request.status !== 'PENDING') return res.status(400).json({ success: false, message: 'Request already processed' });

      await prisma.creditPurchaseRequest.update({
        where: { id },
        data: {
          status: 'REJECTED',
          reviewedAt: new Date(),
          reviewedByUserId: req.user!.id,
          reviewNotes
        }
      });

      res.json({ success: true, message: 'Credit request rejected' });
    } catch (error) {
      next(error);
    }
  }

  async getDriverCreditHistory(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const driverId = String(req.params.driverId || '');
      
      const [requests, ledger] = await Promise.all([
        prisma.creditPurchaseRequest.findMany({
          where: { driverId },
          orderBy: { requestedAt: 'desc' },
          take: 50
        }),
        prisma.driverCreditLedger.findMany({
          where: { driverId },
          orderBy: { createdAt: 'desc' },
          take: 100
        })
      ]);

      res.json({ success: true, data: { requests, ledger } });
    } catch (error) {
      next(error);
    }
  }

  // ==========================================
  // STATISTICS
  // ==========================================

  async getCreditStats(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const [totalApproved, totalPending, totalRejected] = await Promise.all([
        prisma.creditPurchaseRequest.aggregate({
          where: { status: 'APPROVED' },
          _sum: { amountAfn: true, credits: true },
          _count: true
        }),
        prisma.creditPurchaseRequest.aggregate({
          where: { status: 'PENDING' },
          _sum: { amountAfn: true, credits: true },
          _count: true
        }),
        prisma.creditPurchaseRequest.aggregate({
          where: { status: 'REJECTED' },
          _count: true
        })
      ]);

      const stats = {
        totalRevenue: totalApproved._sum.amountAfn || 0,
        totalCredits: totalApproved._sum.credits || 0,
        approvedCount: totalApproved._count,
        pendingRevenue: totalPending._sum.amountAfn || 0,
        pendingCredits: totalPending._sum.credits || 0,
        pendingCount: totalPending._count,
        rejectedCount: totalRejected._count
      };

      res.json({ success: true, data: stats });
    } catch (error) {
      next(error);
    }
  }

  async getMonthlyRevenue(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const months = Number(req.query.months) || 12;
      const startDate = new Date();
      startDate.setMonth(startDate.getMonth() - months);

      const revenue = await prisma.$queryRaw<Array<{
        month: string;
        totalRevenue: number | null;
        creditSales: number | null;
        tripRevenue: number | null;
        requestCount: number | bigint;
        tripCount: number | bigint;
      }>>`
        SELECT 
          DATE_FORMAT(requestedAt, '%Y-%m') as month,
          SUM(CASE WHEN status = 'APPROVED' THEN amountAfn ELSE 0 END) as totalRevenue,
          SUM(CASE WHEN status = 'APPROVED' THEN amountAfn ELSE 0 END) as creditSales,
          0 as tripRevenue,
          COUNT(*) as requestCount,
          0 as tripCount
        FROM CreditPurchaseRequest
        WHERE requestedAt >= ${startDate}
        GROUP BY DATE_FORMAT(requestedAt, '%Y-%m')
        ORDER BY month ASC
      `;

      const formatted = revenue.map(r => ({
        month: r.month,
        totalRevenue: Number(r.totalRevenue || 0),
        creditSales: Number(r.creditSales || 0),
        tripRevenue: Number(r.tripRevenue || 0),
        requestCount: Number(r.requestCount),
        tripCount: Number(r.tripCount)
      }));

      res.json({ success: true, data: formatted });
    } catch (error) {
      next(error);
    }
  }

  async getTopDrivers(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const limit = Number(req.query.limit) || 10;
      const period = req.query.period as string || 'all';

      let dateFilter = {};
      if (period === 'month') {
        const startOfMonth = new Date();
        startOfMonth.setDate(1);
        startOfMonth.setHours(0, 0, 0, 0);
        dateFilter = { createdAt: { gte: startOfMonth } };
      } else if (period === 'week') {
        const startOfWeek = new Date();
        startOfWeek.setDate(startOfWeek.getDate() - 7);
        dateFilter = { createdAt: { gte: startOfWeek } };
      }

      const topDrivers = await prisma.driver.findMany({
        take: limit,
        orderBy: { totalTrips: 'desc' },
        include: {
          user: { select: { name: true, phone: true } },
          trips: {
            where: { status: 'COMPLETED', ...dateFilter },
            select: { fare: true }
          }
        }
      });

      const formatted = topDrivers.map(d => ({
        driverId: d.id,
        name: d.user?.name || 'Unknown',
        phone: d.user?.phone || 'Unknown',
        totalTrips: d.totalTrips,
        rating: d.rating,
        earnings: d.trips.reduce((sum, t) => sum + t.fare, 0),
        creditBalance: d.creditBalance,
        status: d.status
      }));

      res.json({ success: true, data: formatted });
    } catch (error) {
      next(error);
    }
  }

  async getTopRiders(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const limit = Number(req.query.limit) || 10;
      const period = req.query.period as string || 'all';

      let dateFilter = {};
      if (period === 'month') {
        const startOfMonth = new Date();
        startOfMonth.setDate(1);
        startOfMonth.setHours(0, 0, 0, 0);
        dateFilter = { createdAt: { gte: startOfMonth } };
      } else if (period === 'week') {
        const startOfWeek = new Date();
        startOfWeek.setDate(startOfWeek.getDate() - 7);
        dateFilter = { createdAt: { gte: startOfWeek } };
      }

      const topRiders = await prisma.user.findMany({
        where: { role: 'RIDER' },
        take: limit * 3,
        include: {
          riderTrips: {
            where: { status: 'COMPLETED', ...dateFilter },
            select: { fare: true, createdAt: true }
          }
        }
      });

      const formatted = topRiders
        .map(u => ({
          riderId: u.id,
          name: u.name,
          phone: u.phone,
          totalTrips: u.riderTrips.length,
          totalSpent: u.riderTrips.reduce((sum, t) => sum + t.fare, 0)
        }))
        .filter(r => r.totalTrips > 0)
        .sort((a, b) => b.totalSpent - a.totalSpent)
        .slice(0, limit);

      res.json({ success: true, data: formatted });
    } catch (error) {
      next(error);
    }
  }
}
