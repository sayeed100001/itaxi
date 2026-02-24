import { Request, Response } from 'express';
import { z } from 'zod';
import * as paymentService from '../services/payment.service';
import logger from '../config/logger';
import { AuthRequest } from '../middlewares/auth';

const createSessionSchema = z.object({
  amount: z.number().positive(),
});

const payoutSchema = z.object({
  amount: z.number().positive(),
});

export const createSession = async (req: AuthRequest, res: Response) => {
  try {
    const { amount } = createSessionSchema.parse(req.body);
    const userId = req.user!.id;

    const session = await paymentService.createCheckoutSession(userId, amount);
    res.json(session);
  } catch (error: any) {
    logger.error('Create session error', { error, userId: req.user?.id });
    res.status(500).json({ error: 'Failed to create payment session' });
  }
};

export const getBalance = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const balance = await paymentService.calculateBalance(userId);
    res.json({ balance });
  } catch (error: any) {
    logger.error('Get balance error', { error, userId: req.user?.id });
    res.status(500).json({ error: 'Failed to get balance' });
  }
};

export const webhook = async (req: Request, res: Response) => {
  try {
    const signature = req.headers['stripe-signature'] as string;
    await paymentService.handleWebhook(req.body, signature);
    res.json({ received: true });
  } catch (error: any) {
    logger.error('Webhook error', { error });
    res.status(400).json({ error: 'Webhook failed' });
  }
};

export const requestPayout = async (req: AuthRequest, res: Response) => {
  try {
    const { amount } = payoutSchema.parse(req.body);
    const userId = req.user!.id;

    const driver = await require('../config/database').default.driver.findUnique({ where: { userId } });
    if (!driver) {
      return res.status(404).json({ error: 'Driver not found' });
    }

    const payout = await paymentService.requestPayout(driver.id, amount);
    res.json(payout);
  } catch (error: any) {
    logger.error('Payout request error', { error, userId: req.user?.id });
    res.status(500).json({ error: 'Failed to request payout' });
  }
};

export const reconcile = async (req: AuthRequest, res: Response) => {
  try {
    const from = new Date(req.query.from as string);
    const to = new Date(req.query.to as string);

    if (isNaN(from.getTime()) || isNaN(to.getTime())) {
      return res.status(400).json({ error: 'Invalid date range' });
    }

    const result = await paymentService.reconcilePayments(from, to);
    res.json(result);
  } catch (error: any) {
    logger.error('Reconciliation error', { error });
    res.status(500).json({ error: 'Reconciliation failed' });
  }
};
