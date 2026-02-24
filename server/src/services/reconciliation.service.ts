import cron from 'node-cron';
import prisma from '../config/database';
import logger from '../config/logger';
import { getStripeClient } from '../utils/stripe';

export class ReconciliationService {
  async reconcileTransactions(from: Date, to: Date) {
    const stripe = getStripeClient();
    const dbResult = await prisma.$queryRaw<[{ total: number; count: number }]>`
      SELECT 
        COALESCE(SUM(amount), 0) as total,
        COUNT(*) as count
      FROM Transaction
      WHERE type = 'CREDIT' 
        AND status = 'COMPLETED'
        AND createdAt >= ${from}
        AND createdAt <= ${to}
    `;

    const dbTotal = dbResult[0]?.total || 0;
    const dbCount = dbResult[0]?.count || 0;

    const stripePayments = await stripe.paymentIntents.list({
      created: {
        gte: Math.floor(from.getTime() / 1000),
        lte: Math.floor(to.getTime() / 1000),
      },
      limit: 100,
    });

    const stripeTotal = stripePayments.data
      .filter(p => p.status === 'succeeded')
      .reduce((sum, p) => sum + p.amount / 100, 0);

    const mismatch = Math.abs(dbTotal - stripeTotal);

    const log = await prisma.reconciliationLog.create({
      data: {
        periodStart: from,
        periodEnd: to,
        dbTotal,
        stripeTotal,
        mismatch,
        details: JSON.stringify({
          dbCount,
          stripeCount: stripePayments.data.length,
          threshold: 0.01,
        }),
      },
    });

    if (mismatch > 0.01) {
      logger.error('Reconciliation mismatch detected', { 
        dbTotal, 
        stripeTotal, 
        mismatch,
        logId: log.id 
      });

      await prisma.auditLog.create({
        data: {
          action: 'RECONCILIATION_MISMATCH',
          details: JSON.stringify({ 
            logId: log.id, 
            mismatch, 
            dbTotal, 
            stripeTotal 
          }),
        },
      });
    }

    return log;
  }

  async reconcilePayouts(from: Date, to: Date) {
    const stripe = getStripeClient();
    const dbPayouts = await prisma.payout.findMany({
      where: {
        status: 'COMPLETED',
        createdAt: { gte: from, lte: to },
        stripeTransferId: { not: null },
      },
    });

    const dbTotal = dbPayouts.reduce((sum, p) => sum + p.amount, 0);

    const stripeTransfers = await stripe.transfers.list({
      created: {
        gte: Math.floor(from.getTime() / 1000),
        lte: Math.floor(to.getTime() / 1000),
      },
      limit: 100,
    });

    const stripeTotal = stripeTransfers.data.reduce((sum, t) => sum + t.amount / 100, 0);
    const mismatch = Math.abs(dbTotal - stripeTotal);

    const log = await prisma.reconciliationLog.create({
      data: {
        periodStart: from,
        periodEnd: to,
        dbTotal,
        stripeTotal,
        mismatch,
        details: JSON.stringify({
          type: 'PAYOUTS',
          dbCount: dbPayouts.length,
          stripeCount: stripeTransfers.data.length,
        }),
      },
    });

    if (mismatch > 0.01) {
      logger.error('Payout reconciliation mismatch', { 
        dbTotal, 
        stripeTotal, 
        mismatch 
      });
    }

    return log;
  }
}

export function startReconciliationCron() {
  cron.schedule('0 2 * * *', async () => {
    try {
      const service = new ReconciliationService();
      const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const today = new Date();

      await service.reconcileTransactions(yesterday, today);
      await service.reconcilePayouts(yesterday, today);

      logger.info('Daily reconciliation completed');
    } catch (error) {
      logger.error('Reconciliation cron failed', { error });
    }
  });

  logger.info('Reconciliation cron started (daily at 2 AM)');
}
