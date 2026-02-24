// Driver Credit System Service
// Handles cash-based credit/lead system for Afghanistan
// Drivers buy monthly credit packages from admin; each trip acceptance costs 1 credit.

import prisma from '../config/database';
import logger from '../config/logger';

export interface CreditTransaction {
  driverId: string;
  amount: number;
  action: 'ADMIN_ADD' | 'TRIP_DEDUCTION' | 'REFUND';
  reason?: string;
  tripId?: string;
  adminId?: string;
}

export class DriverCreditService {

  /**
   * Get driver's current credit balance (reads Driver.creditBalance directly — O(1)).
   */
  async getBalance(driverId: string): Promise<number> {
    try {
      const driver = await prisma.driver.findUnique({
        where: { id: driverId },
        select: { creditBalance: true },
      });
      return Math.max(0, driver?.creditBalance || 0);
    } catch (error) {
      logger.error('Error getting driver balance', { driverId, error });
      return 0;
    }
  }

  /**
   * Get credit status by userId
   */
  async getDriverCreditStatusByUserId(userId: string) {
    try {
      const driver = await prisma.driver.findUnique({
        where: { userId },
        select: {
          creditBalance: true,
          creditExpiresAt: true,
          monthlyPackage: true
        }
      });

      if (!driver) throw new Error('Driver profile not found');

      const hasActiveCredits = driver.creditBalance > 0 && 
        (!driver.creditExpiresAt || driver.creditExpiresAt > new Date());

      return {
        creditBalance: driver.creditBalance,
        creditExpiresAt: driver.creditExpiresAt,
        monthlyPackage: driver.monthlyPackage,
        hasActiveCredits
      };
    } catch (error) {
      logger.error('Error getting driver credit status', { userId, error });
      throw error;
    }
  }

  /**
   * Add credits to driver (admin action).
   * Atomically updates both DriverCreditLedger and Driver.creditBalance.
   */
  async addCredits(
    driverId: string,
    amount: number,
    adminId: string,
    reason: string = 'Admin credit addition',
    packageName?: string,
    durationDays?: number
  ): Promise<void> {
    if (amount <= 0) throw new Error('Amount must be positive');

    try {
      await prisma.$transaction(async (tx) => {
        const driver = await tx.driver.update({
          where: { id: driverId },
          data: {
            creditBalance: { increment: amount },
            // Set expiry to durationDays from now if provided
            ...(durationDays
              ? { creditExpiresAt: new Date(Date.now() + durationDays * 24 * 60 * 60 * 1000) }
              : {}),
            ...(packageName ? { monthlyPackage: packageName } : {}),
          },
          select: { creditBalance: true },
        });

        await tx.driverCreditLedger.create({
          data: {
            driverId,
            creditsDelta: amount,
            balanceAfter: driver.creditBalance,
            action: 'ADMIN_ADD',
            actorUserId: adminId,
            notes: reason,
            packageName,
          },
        });

        await tx.auditLog.create({
          data: {
            userId: adminId,
            action: 'DRIVER_CREDIT_ADD',
            details: JSON.stringify({ driverId, amount, reason, newBalance: driver.creditBalance }),
          },
        });
      });

      logger.info('Credits added to driver', { driverId, amount, adminId });
    } catch (error) {
      logger.error('Error adding credits', { driverId, amount, error });
      throw error;
    }
  }

  /**
   * Deduct commission when driver accepts trip (20% of fare).
   * Called inside transaction for atomicity.
   */
  async deductCommission(
    driverId: string,
    tripId: string,
    commissionAmount: number,
    totalFare: number,
    tx?: any
  ): Promise<void> {
    const db = tx || prisma;

    try {
      // Check if driver has enough credits to cover commission
      const driver = await db.driver.findUnique({
        where: { id: driverId },
        select: { creditBalance: true },
      });

      if (!driver || driver.creditBalance < commissionAmount) {
        throw new Error(`Insufficient credits. Need ${commissionAmount} AFN (20% of ${totalFare} AFN fare) to accept this trip.`);
      }

      // Deduct commission from credit balance
      const updatedDriver = await db.driver.update({
        where: { id: driverId },
        data: { creditBalance: { decrement: commissionAmount } },
        select: { creditBalance: true },
      });

      // Log the commission deduction
      await db.driverCreditLedger.create({
        data: {
          driverId,
          tripId,
          creditsDelta: -commissionAmount,
          balanceAfter: updatedDriver.creditBalance,
          action: 'TRIP_DEDUCTION',
          amountAfn: commissionAmount,
          notes: `Platform commission (20% of ${totalFare} AFN fare). Driver earns 80% (${totalFare - commissionAmount} AFN).`,
        },
      });

      logger.info('Commission deducted from driver', { 
        driverId, 
        tripId, 
        commission: commissionAmount,
        totalFare,
        driverEarnings: totalFare - commissionAmount,
        remainingBalance: updatedDriver.creditBalance 
      });
    } catch (error: any) {
      logger.error('Error deducting commission', { driverId, tripId, error: error.message });
      throw error;
    }
  }

  /**
   * Deduct credits from driver (general deduction, used for admin adjustments).
   */
  async deductCredits(driverId: string, tripId: string, amount: number): Promise<void> {
    if (amount <= 0) throw new Error('Amount must be positive');

    try {
      await prisma.$transaction(async (tx) => {
        const driver = await tx.driver.update({
          where: { id: driverId },
          data: { creditBalance: { decrement: amount } },
          select: { creditBalance: true },
        });

        if (driver.creditBalance < 0) {
          throw new Error(`Insufficient credits. Would go negative after deduction of ${amount}.`);
        }

        await tx.driverCreditLedger.create({
          data: {
            driverId,
            tripId,
            creditsDelta: -amount,
            balanceAfter: driver.creditBalance,
            action: 'TRIP_DEDUCTION',
          },
        });

        await tx.auditLog.create({
          data: {
            userId: driverId,
            action: 'DRIVER_CREDIT_DEDUCTION',
            details: JSON.stringify({ tripId, amount, newBalance: driver.creditBalance }),
          },
        });
      });

      logger.info('Credits deducted from driver', { driverId, tripId, amount });
    } catch (error) {
      logger.error('Error deducting credits', { driverId, tripId, amount, error });
      throw error;
    }
  }

  /**
   * Refund credits (if trip is cancelled before driver arrives).
   */
  async refundCredits(driverId: string, tripId: string, amount: number = 1, reason: string = 'Trip cancelled'): Promise<void> {
    if (amount <= 0) throw new Error('Amount must be positive');

    try {
      await prisma.$transaction(async (tx) => {
        const driver = await tx.driver.update({
          where: { id: driverId },
          data: { creditBalance: { increment: amount } },
          select: { creditBalance: true },
        });

        await tx.driverCreditLedger.create({
          data: {
            driverId,
            tripId,
            creditsDelta: amount,
            balanceAfter: driver.creditBalance,
            action: 'REFUND',
            notes: reason,
          },
        });

        await tx.auditLog.create({
          data: {
            userId: driverId,
            action: 'DRIVER_CREDIT_REFUND',
            details: JSON.stringify({ tripId, amount, reason, newBalance: driver.creditBalance }),
          },
        });
      });

      logger.info('Credits refunded to driver', { driverId, tripId, amount });
    } catch (error) {
      logger.error('Error refunding credits', { driverId, tripId, amount, error });
      throw error;
    }
  }

  /**
   * Check if driver has enough credits to accept a trip.
   */
  async hasEnoughCredits(driverId: string, requiredAmount: number = 1): Promise<boolean> {
    try {
      const balance = await this.getBalance(driverId);
      return balance >= requiredAmount;
    } catch (error) {
      logger.error('Error checking credits', { driverId, requiredAmount, error });
      return false;
    }
  }

  /**
   * Get credit history for driver (paginated).
   */
  async getDriverCreditLedger(driverId: string, limit: number = 50) {
    try {
      return await prisma.driverCreditLedger.findMany({
        where: { driverId },
        orderBy: { createdAt: 'desc' },
        take: limit
      });
    } catch (error) {
      logger.error('Error getting driver credit ledger', { driverId, error });
      return [];
    }
  }

  /**
   * Get credit history for driver (paginated).
   */
  async getHistory(driverId: string, limit: number = 50, skip: number = 0) {
    try {
      return await prisma.driverCreditLedger.findMany({
        where: { driverId },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip,
      });
    } catch (error) {
      logger.error('Error getting credit history', { driverId, error });
      return [];
    }
  }

  /**
   * Get credit statistics for driver.
   */
  async getStatistics(driverId: string) {
    try {
      const [driver, stats] = await Promise.all([
        prisma.driver.findUnique({
          where: { id: driverId },
          select: { creditBalance: true, creditExpiresAt: true, monthlyPackage: true },
        }),
        prisma.driverCreditLedger.groupBy({
          by: ['action'],
          where: { driverId },
          _sum: { creditsDelta: true },
          _count: { id: true },
        }),
      ]);

      const totalAdded = stats.find(s => s.action === 'ADMIN_ADD')?._sum.creditsDelta || 0;
      const totalDeducted = Math.abs(stats.find(s => s.action === 'TRIP_DEDUCTION')?._sum.creditsDelta || 0);
      const totalRefunded = stats.find(s => s.action === 'REFUND')?._sum.creditsDelta || 0;

      return {
        currentBalance: driver?.creditBalance || 0,
        creditExpiresAt: driver?.creditExpiresAt,
        monthlyPackage: driver?.monthlyPackage,
        isExpired: driver?.creditExpiresAt ? driver.creditExpiresAt < new Date() : false,
        totalAdded,
        totalDeducted,
        totalRefunded,
        transactionCount: stats.reduce((sum, s) => sum + s._count.id, 0),
      };
    } catch (error) {
      logger.error('Error getting credit statistics', { driverId, error });
      return {
        currentBalance: 0,
        creditExpiresAt: null,
        monthlyPackage: null,
        isExpired: false,
        totalAdded: 0,
        totalDeducted: 0,
        totalRefunded: 0,
        transactionCount: 0,
      };
    }
  }

  /**
   * Calculate commission for a trip in AFN.
   * Default: 20% platform, 80% driver
   */
  calculateCommission(fare: number, commissionRate: number = 20): { 
    platformCommission: number; 
    driverEarnings: number;
    commissionRate: number;
  } {
    const platformCommission = Math.ceil((fare * commissionRate) / 100);
    const driverEarnings = fare - platformCommission;
    return {
      platformCommission,
      driverEarnings,
      commissionRate
    };
  }

  /**
   * Validate credit transaction.
   */
  validateTransaction(transaction: CreditTransaction): { valid: boolean; error?: string } {
    if (!transaction.driverId) return { valid: false, error: 'Driver ID is required' };
    if (transaction.amount <= 0) return { valid: false, error: 'Amount must be positive' };
    if (!['ADMIN_ADD', 'TRIP_DEDUCTION', 'REFUND'].includes(transaction.action)) {
      return { valid: false, error: 'Invalid action' };
    }
    if (transaction.action === 'TRIP_DEDUCTION' && !transaction.tripId) {
      return { valid: false, error: 'Trip ID is required for deduction' };
    }
    if (transaction.action === 'ADMIN_ADD' && !transaction.adminId) {
      return { valid: false, error: 'Admin ID is required for credit addition' };
    }
    return { valid: true };
  }
}

export const driverCreditService = new DriverCreditService();
export default driverCreditService;
