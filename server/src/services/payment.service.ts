import Stripe from 'stripe';
import prisma from '../config/database';
import logger from '../config/logger';
import { getStripeClient } from '../utils/stripe';

const DISABLE_PAYOUTS = process.env.DISABLE_PAYOUTS === 'true';
const ALLOW_AUTO_PAYOUTS = process.env.ALLOW_AUTO_PAYOUTS === 'true';
const STRIPE_TEST_MODE = process.env.STRIPE_TEST_MODE !== 'false';

export const calculateBalance = async (userId: string): Promise<number> => {
  const result = await prisma.$queryRaw<[{ balance: number }]>`
    SELECT 
      COALESCE(SUM(CASE WHEN type = 'CREDIT' AND status = 'COMPLETED' THEN amount ELSE 0 END), 0) -
      COALESCE(SUM(CASE WHEN type = 'DEBIT' AND status = 'COMPLETED' THEN amount ELSE 0 END), 0) as balance
    FROM Transaction
    WHERE userId = ${userId}
  `;
  return result[0]?.balance || 0;
};

export const createCheckoutSession = async (userId: string, amount: number) => {
  const stripe = getStripeClient();
  const session = await stripe.checkout.sessions.create({
    payment_method_types: ['card'],
    line_items: [{
      price_data: {
        currency: 'usd',
        product_data: { name: 'Wallet Top-up' },
        unit_amount: Math.round(amount * 100),
      },
      quantity: 1,
    }],
    mode: 'payment',
    success_url: `${process.env.CLIENT_URL}/wallet?success=true`,
    cancel_url: `${process.env.CLIENT_URL}/wallet?canceled=true`,
    metadata: { userId, amount: amount.toString() }
  });

  await prisma.transaction.create({
    data: {
      userId,
      amount,
      type: 'CREDIT',
      status: 'PENDING',
      description: 'Wallet top-up',
      stripeSessionId: session.id
    }
  });

  return { sessionId: session.id, url: session.url };
};

export const handleWebhook = async (payload: Buffer, signature: string) => {
  const stripe = getStripeClient();
  if (!process.env.STRIPE_WEBHOOK_SECRET) {
    throw new Error('Stripe webhook secret is not configured');
  }

  const event = stripe.webhooks.constructEvent(
    payload,
    signature,
    process.env.STRIPE_WEBHOOK_SECRET
  );
  const eventType = (event as any).type as string;
  const eventData = (event as any).data?.object as any;

  if (eventType === 'checkout.session.completed') {
    const session = eventData as Stripe.Checkout.Session;
    const { userId } = session.metadata!;

    await prisma.transaction.updateMany({
      where: { stripeSessionId: session.id },
      data: {
        status: 'COMPLETED',
        stripePaymentId: session.payment_intent as string
      }
    });

    logger.info('Payment completed', { userId, sessionId: session.id });
  }

  if (eventType === 'checkout.session.expired') {
    const session = eventData as Stripe.Checkout.Session;
    await prisma.transaction.updateMany({
      where: { stripeSessionId: session.id },
      data: { status: 'FAILED' }
    });
  }

  if (eventType === 'transfer.created') {
    const transfer = eventData as Stripe.Transfer;
    logger.info('Transfer created', { transferId: transfer.id, amount: transfer.amount });
  }

  if (eventType === 'transfer.failed') {
    const transfer = eventData as Stripe.Transfer;
    const failureReason = (transfer as any).failure_message || 'Transfer failed';
    await prisma.payout.updateMany({
      where: { stripeTransferId: transfer.id },
      data: {
        status: 'FAILED',
        failureReason,
      },
    });
    logger.error('Transfer failed', { transferId: transfer.id, reason: failureReason });
  }

  if (eventType === 'transfer.reversed') {
    const transfer = eventData as Stripe.Transfer;
    await prisma.payout.updateMany({
      where: { stripeTransferId: transfer.id },
      data: {
        status: 'FAILED',
        failureReason: 'Transfer reversed',
      },
    });
    logger.warn('Transfer reversed', { transferId: transfer.id });
  }
};

export const deductTripPayment = async (userId: string, tripId: string, amount: number) => {
  return await prisma.$transaction(async (tx) => {
    const result = await tx.$queryRaw<[{ balance: number }]>`
      SELECT 
        COALESCE(SUM(CASE WHEN type = 'CREDIT' AND status = 'COMPLETED' THEN amount ELSE 0 END), 0) -
        COALESCE(SUM(CASE WHEN type = 'DEBIT' AND status = 'COMPLETED' THEN amount ELSE 0 END), 0) as balance
      FROM Transaction
      WHERE userId = ${userId}
    `;
    const balance = result[0]?.balance || 0;

    if (balance < amount) {
      throw new Error('Insufficient balance');
    }

    // NOTE: Do NOT update trip status here — settleTrip() in trip.service.ts handles it.
    const transaction = await tx.transaction.create({
      data: {
        userId,
        amount,
        type: 'DEBIT',
        status: 'COMPLETED',
        description: `Trip payment - ${tripId}`,
      }
    });

    return transaction;
  });
};

export const requestPayout = async (driverId: string, amount: number) => {
  const payout = await prisma.payout.create({
    data: {
      driverId,
      amount,
      status: 'PENDING_MANUAL_REVIEW'
    }
  });

  logger.info('Payout requested - requires manual review', { payoutId: payout.id, driverId, amount });
  return payout;
};

export const processPayout = async (payoutId: string) => {
  // Afghanistan market: all payouts are manual cash transactions.
  // Automatic payouts are disabled by design. Use adminProcessPayout() instead.
  throw new Error('Automatic payouts are disabled. Use adminProcessPayout() for manual payout processing.');
};

export const adminProcessPayout = async (payoutId: string, adminId: string) => {
  const payout = await prisma.payout.findUnique({
    where: { id: payoutId },
    include: { driver: true }
  });

  if (!payout) throw new Error('Payout not found');
  if (payout.status === 'COMPLETED') throw new Error('Payout already completed');
  if (payout.status === 'PROCESSING') throw new Error('Payout already processing');

  if (!payout.driver.stripeAccountId) {
    throw new Error('Driver does not have Stripe account connected');
  }

  const existingWithKey = await prisma.payout.findFirst({
    where: { idempotencyKey: payout.id }
  });

  if (existingWithKey && existingWithKey.id !== payoutId) {
    logger.warn('Idempotency check: payout already processed', { payoutId, existingId: existingWithKey.id });
    return existingWithKey;
  }

  await prisma.payout.update({
    where: { id: payoutId },
    data: {
      status: 'PROCESSING',
      idempotencyKey: payout.id
    }
  });

  try {
    let transferId = null;

    if (ALLOW_AUTO_PAYOUTS && !DISABLE_PAYOUTS) {
      const stripe = getStripeClient();
      const transfer = await stripe.transfers.create({
        amount: Math.round(payout.amount * 100),
        currency: 'usd',
        destination: payout.driver.stripeAccountId,
        description: `Payout for driver ${payout.driverId}`,
        metadata: { payoutId: payout.id, driverId: payout.driverId }
      }, {
        idempotencyKey: payout.id
      });

      transferId = transfer.id;
      logger.info('Stripe transfer created', { payoutId, transferId, testMode: STRIPE_TEST_MODE });
    } else {
      logger.info('Payout marked as completed without Stripe transfer (ALLOW_AUTO_PAYOUTS=false)', { payoutId });
    }

    const updatedPayout = await prisma.payout.update({
      where: { id: payoutId },
      data: {
        status: 'COMPLETED',
        stripeTransferId: transferId
      }
    });

    await prisma.auditLog.create({
      data: {
        userId: adminId,
        action: 'PAYOUT_PROCESSED',
        details: JSON.stringify({ payoutId, amount: payout.amount, transferId }),
      }
    });

    return updatedPayout;
  } catch (error: any) {
    await prisma.payout.update({
      where: { id: payoutId },
      data: {
        status: 'FAILED',
        failureReason: error.message
      }
    });

    logger.error('Payout processing failed', { payoutId, error: error.message });
    throw error;
  }
};

export const reconcilePayments = async (from: Date, to: Date) => {
  const stripe = getStripeClient();
  const dbTransactions = await prisma.transaction.findMany({
    where: {
      type: 'CREDIT',
      status: 'COMPLETED',
      createdAt: { gte: from, lte: to },
    },
  });

  const dbTotal = dbTransactions.reduce((sum, t) => sum + t.amount, 0);

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

  const details = {
    dbCount: dbTransactions.length,
    stripeCount: stripePayments.data.length,
    dbTransactionIds: dbTransactions.map(t => t.id),
    stripePaymentIds: stripePayments.data.map(p => p.id),
  };

  const log = await prisma.reconciliationLog.create({
    data: {
      periodStart: from,
      periodEnd: to,
      dbTotal,
      stripeTotal,
      mismatch,
      details: JSON.stringify(details),
    },
  });

  logger.info('Reconciliation completed', { dbTotal, stripeTotal, mismatch });

  return {
    dbTotal,
    stripeTotal,
    mismatch,
    details,
    log,
  };
};
