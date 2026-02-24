import { Response, NextFunction } from 'express';
import prisma from '../config/database';
import { AuthRequest } from '../middlewares/auth';

const toNumber = (value: unknown): number => {
  if (typeof value === 'bigint') return Number(value);
  if (typeof value === 'number') return value;
  if (typeof value === 'string') return Number(value) || 0;
  return 0;
};

export class AdminInsightsController {
  async getAnalyticsOverview(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const now = new Date();
      const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);

      const [
        totalTrips,
        completedTrips,
        cancelledTrips,
        activeDrivers,
        avgTrip,
        sosCount,
        serviceDistribution,
        hourlyDemandRaw,
      ] = await Promise.all([
        prisma.trip.count(),
        prisma.trip.count({ where: { status: 'COMPLETED' } }),
        prisma.trip.count({ where: { status: 'CANCELLED' } }),
        prisma.driver.count({ where: { status: 'ONLINE' } }),
        prisma.trip.aggregate({
          where: { status: 'COMPLETED' },
          _avg: { fare: true, duration: true },
        }),
        prisma.auditLog.count({
          where: {
            action: 'SOS_TRIGGERED',
            createdAt: { gte: last24h },
          },
        }),
        prisma.trip.groupBy({
          by: ['serviceType'],
          _count: { _all: true },
          orderBy: { _count: { serviceType: 'desc' } },
          take: 8,
        }),
        prisma.$queryRaw<Array<{ hour: string; rides: number | bigint; revenue: number | null }>>`
          SELECT
            DATE_FORMAT(createdAt, '%H:00') AS hour,
            COUNT(*) AS rides,
            COALESCE(SUM(fare), 0) AS revenue
          FROM Trip
          WHERE createdAt >= ${last24h}
          GROUP BY DATE_FORMAT(createdAt, '%H')
          ORDER BY hour ASC
        `,
      ]);

      const completionRate = totalTrips > 0 ? (completedTrips / totalTrips) * 100 : 0;
      const cancellationRate = totalTrips > 0 ? (cancelledTrips / totalTrips) * 100 : 0;

      res.json({
        success: true,
        data: {
          kpis: {
            totalTrips,
            completedTrips,
            cancelledTrips,
            activeDrivers,
            completionRate: Number(completionRate.toFixed(2)),
            cancellationRate: Number(cancellationRate.toFixed(2)),
            avgFare: Number((avgTrip._avg.fare || 0).toFixed(2)),
            avgDurationMinutes: Number(((avgTrip._avg.duration || 0) / 60).toFixed(2)),
            sosLast24h: sosCount,
          },
          hourlyDemand: hourlyDemandRaw.map((item) => ({
            hour: item.hour,
            rides: toNumber(item.rides),
            revenue: Number((item.revenue || 0).toFixed(2)),
          })),
          serviceDistribution: serviceDistribution.map((item) => ({
            serviceType: item.serviceType,
            count: item._count._all,
          })),
          generatedAt: now.toISOString(),
        },
      });
    } catch (error) {
      next(error);
    }
  }

  async getFinanceOverview(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const now = new Date();
      const last30d = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

      const [
        credits,
        debits,
        pendingTransactions,
        payouts,
        pendingPayouts,
        driverCreditSalesAgg,
        recentDriverCreditSales,
        recentTransactions,
        recentPayouts,
        dailyRevenueRaw,
      ] = await Promise.all([
        prisma.transaction.aggregate({
          where: { type: 'CREDIT', status: 'COMPLETED' },
          _sum: { amount: true },
          _count: true,
        }),
        prisma.transaction.aggregate({
          where: { type: 'DEBIT', status: 'COMPLETED' },
          _sum: { amount: true },
          _count: true,
        }),
        prisma.transaction.count({ where: { status: 'PENDING' } }),
        prisma.payout.aggregate({
          _sum: { amount: true },
          _count: true,
        }),
        prisma.payout.count({ where: { status: 'PENDING_MANUAL_REVIEW' } }),
        prisma.driverCreditLedger.aggregate({
          where: { action: 'PURCHASE_MONTHLY_PACKAGE' },
          _sum: { amountAfn: true, creditsDelta: true },
          _count: true,
        }),
        prisma.driverCreditLedger.findMany({
          where: { action: 'PURCHASE_MONTHLY_PACKAGE' },
          orderBy: { createdAt: 'desc' },
          take: 30,
          include: {
            driver: {
              include: {
                user: {
                  select: { id: true, name: true, phone: true },
                },
              },
            },
          },
        }),
        prisma.transaction.findMany({
          orderBy: { createdAt: 'desc' },
          take: 50,
          include: {
            user: {
              select: { id: true, name: true, phone: true, role: true },
            },
          },
        }),
        prisma.payout.findMany({
          orderBy: { createdAt: 'desc' },
          take: 50,
          include: {
            driver: {
              include: {
                user: {
                  select: { id: true, name: true, phone: true },
                },
              },
            },
          },
        }),
        prisma.$queryRaw<Array<{ date: string; revenue: number | null; rides: number | bigint }>>`
          SELECT
            DATE(createdAt) AS date,
            COALESCE(SUM(fare), 0) AS revenue,
            COUNT(*) AS rides
          FROM Trip
          WHERE status = 'COMPLETED' AND createdAt >= ${last30d}
          GROUP BY DATE(createdAt)
          ORDER BY date ASC
        `,
      ]);

      const totalCredits = credits._sum.amount || 0;
      const totalDebits = debits._sum.amount || 0;
      const netCashflow = totalCredits - totalDebits;
      const totalPayouts = payouts._sum.amount || 0;

      res.json({
        success: true,
        data: {
          summary: {
            totalCredits: Number(totalCredits.toFixed(2)),
            totalDebits: Number(totalDebits.toFixed(2)),
            netCashflow: Number(netCashflow.toFixed(2)),
            totalPayouts: Number(totalPayouts.toFixed(2)),
            driverCreditSalesAfn: Number((driverCreditSalesAgg._sum.amountAfn || 0).toFixed(2)),
            soldDriverCredits: Number((driverCreditSalesAgg._sum.creditsDelta || 0).toFixed(0)),
            driverCreditSalesCount: driverCreditSalesAgg._count,
            pendingTransactions,
            pendingPayouts,
            transactionCount: credits._count + debits._count,
            payoutCount: payouts._count,
          },
          revenueTrend: dailyRevenueRaw.map((item) => ({
            date: item.date,
            revenue: Number((item.revenue || 0).toFixed(2)),
            rides: toNumber(item.rides),
          })),
          recentTransactions,
          recentPayouts,
          recentDriverCreditSales,
          generatedAt: now.toISOString(),
        },
      });
    } catch (error) {
      next(error);
    }
  }
}
