import { Response, NextFunction } from 'express';
import { AuthRequest } from '../middlewares/auth';
import prisma from '../config/database';
import logger from '../config/logger';
import { getStripeClient } from '../utils/stripe';

export class PayoutsController {
  async getPendingPayouts(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const payouts = await prisma.payout.findMany({
        where: { status: 'PENDING_MANUAL_REVIEW' },
        include: {
          driver: {
            include: { user: true },
          },
        },
        orderBy: { createdAt: 'asc' },
      });

      res.json({ success: true, data: payouts });
    } catch (error: any) {
      logger.error('Get pending payouts error', { error });
      next(error);
    }
  }

  async processPayout(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { payoutId } = req.body;

      const payout = await prisma.payout.findUnique({
        where: { id: payoutId },
        include: { driver: true },
      });

      if (!payout) {
        return res.status(404).json({ error: 'Payout not found' });
      }

      if (payout.status !== 'PENDING_MANUAL_REVIEW') {
        return res.status(400).json({ error: 'Payout already processed' });
      }

      if (!payout.driver.stripeAccountId) {
        return res.status(400).json({ error: 'Driver has no Stripe account' });
      }

      await prisma.payout.update({
        where: { id: payoutId },
        data: { status: 'PROCESSING' },
      });

      try {
        const stripe = getStripeClient();
        const transfer = await stripe.transfers.create({
          amount: Math.round(payout.amount * 100),
          currency: 'usd',
          destination: payout.driver.stripeAccountId,
          description: `Payout for driver ${payout.driverId}`,
        });

        await prisma.payout.update({
          where: { id: payoutId },
          data: {
            status: 'COMPLETED',
            stripeTransferId: transfer.id,
          },
        });

        logger.info('Payout processed', { payoutId, transferId: transfer.id, amount: payout.amount });

        res.json({ success: true, data: { payoutId, transferId: transfer.id } });
      } catch (stripeError: any) {
        await prisma.payout.update({
          where: { id: payoutId },
          data: {
            status: 'FAILED',
            failureReason: stripeError.message,
          },
        });

        logger.error('Stripe transfer failed', { payoutId, error: stripeError.message });

        return res.status(400).json({ error: stripeError.message });
      }
    } catch (error: any) {
      logger.error('Process payout error', { error });
      next(error);
    }
  }

  async getAllPayouts(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { status } = req.query;
      const where = status ? { status: status as any } : {};

      const payouts = await prisma.payout.findMany({
        where,
        include: {
          driver: {
            include: { user: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: 100,
      });

      res.json({ success: true, data: payouts });
    } catch (error: any) {
      logger.error('Get all payouts error', { error });
      next(error);
    }
  }
}
