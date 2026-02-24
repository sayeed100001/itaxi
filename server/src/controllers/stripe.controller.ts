import { Response, NextFunction } from 'express';
import { AuthRequest } from '../middlewares/auth';
import prisma from '../config/database';
import logger from '../config/logger';
import { getStripeClient } from '../utils/stripe';

export class StripeController {
  async createConnectAccount(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.user!.id;
      const driver = await prisma.driver.findUnique({ where: { userId } });

      if (!driver) {
        return res.status(404).json({ error: 'Driver not found' });
      }

      if (driver.stripeAccountId) {
        return res.json({ accountId: driver.stripeAccountId });
      }

      const stripe = getStripeClient();
      const account = await stripe.accounts.create({
        type: 'express',
        country: 'US',
        capabilities: {
          transfers: { requested: true },
        },
      });

      await prisma.driver.update({
        where: { id: driver.id },
        data: { stripeAccountId: account.id },
      });

      logger.info('Stripe Connect account created', { driverId: driver.id, accountId: account.id });

      res.json({ accountId: account.id });
    } catch (error: any) {
      logger.error('Create Connect account error', { error, userId: req.user?.id });
      next(error);
    }
  }

  async getOnboardingLink(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.user!.id;
      const driver = await prisma.driver.findUnique({ where: { userId } });

      if (!driver || !driver.stripeAccountId) {
        return res.status(404).json({ error: 'Stripe account not found' });
      }

      const stripe = getStripeClient();
      const accountLink = await stripe.accountLinks.create({
        account: driver.stripeAccountId,
        refresh_url: `${process.env.CLIENT_URL}/driver/stripe/refresh`,
        return_url: `${process.env.CLIENT_URL}/driver/stripe/return`,
        type: 'account_onboarding',
      });

      res.json({ url: accountLink.url });
    } catch (error: any) {
      logger.error('Get onboarding link error', { error, userId: req.user?.id });
      next(error);
    }
  }

  async getAccountStatus(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.user!.id;
      const driver = await prisma.driver.findUnique({ where: { userId } });

      if (!driver || !driver.stripeAccountId) {
        return res.json({ connected: false });
      }

      const stripe = getStripeClient();
      const account = await stripe.accounts.retrieve(driver.stripeAccountId);

      res.json({
        connected: true,
        chargesEnabled: account.charges_enabled,
        payoutsEnabled: account.payouts_enabled,
        detailsSubmitted: account.details_submitted,
      });
    } catch (error: any) {
      logger.error('Get account status error', { error, userId: req.user?.id });
      next(error);
    }
  }
}
