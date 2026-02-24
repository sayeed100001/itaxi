import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import Stripe from 'stripe';
import axios from 'axios';
import { PrismaClient } from '@prisma/client';
import { config } from '@shared/config';
import { logger, addCorrelationId } from '@shared/logger';
import { authenticate, requireDriver } from '@shared/auth';

const app = express();
const prisma = new PrismaClient();
const hasUsableStripeKey = () => {
  const key = config.stripe.secretKey || '';
  if (!key) return false;
  if (!key.startsWith('sk_')) return false;
  if (key.includes('your_stripe_secret_key_here')) return false;
  return true;
};
const stripe = hasUsableStripeKey() ? new Stripe(config.stripe.secretKey) : null;

// Middleware
app.use(helmet());
app.use(compression());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

app.use(cors({
  origin: config.corsOrigin,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Correlation-ID']
}));

// Rate limiting
const paymentLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 30, // limit each IP to 30 requests per windowMs
  message: 'Too many payment requests, please try again later',
  standardHeaders: true,
  legacyHeaders: false,
});

// Add correlation ID middleware
app.use(addCorrelationId);

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'OK',
    service: 'Payment Service',
    timestamp: new Date().toISOString(),
    correlationId: req.correlationId
  });
});

// Metrics endpoint
app.get('/metrics', (req, res) => {
  res.status(200).json({
    status: 'OK',
    service: 'Payment Service',
    metrics: {
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      activePayments: 0, // Placeholder
      timestamp: new Date().toISOString()
    },
    correlationId: req.correlationId
  });
});

// Ready check endpoint
app.get('/ready', (req, res) => {
  // Check database connection
  prisma.$queryRaw`SELECT 1`
    .then(() => {
      res.status(200).json({
        status: 'READY',
        correlationId: req.correlationId
      });
    })
    .catch(error => {
      logger.logWithContext('error', 'Payment service not ready', {
        correlationId: req.correlationId,
        error: error.message
      });
      res.status(503).json({
        status: 'NOT_READY',
        error: error.message,
        correlationId: req.correlationId
      });
    });
});

// Create payment session endpoint
app.post('/api/create-session', authenticate, paymentLimiter, async (req, res) => {
  try {
    const { amount, currency = 'usd', paymentMethodTypes = ['card'] } = req.body;

    if (!amount) {
      return res.status(400).json({ error: 'Amount is required' });
    }

    const fallbackOrigin = String(config.corsOrigin || 'http://localhost:3000').split(',')[0].trim();
    const requestOrigin = (req.headers.origin && String(req.headers.origin).startsWith('http'))
      ? req.headers.origin
      : fallbackOrigin;

    if (!stripe) {
      return res.status(503).json({
        error: 'Stripe is not configured with a valid secret key'
      });
    }

    const session = await stripe.checkout.sessions.create({
      payment_method_types: paymentMethodTypes,
      line_items: [{
        price_data: {
          currency: currency,
          product_data: {
            name: 'iTaxi Ride Payment',
            description: 'Payment for ride service'
          },
          unit_amount: Math.round(amount * 100), // Convert to cents
        },
        quantity: 1,
      }],
      mode: 'payment',
      success_url: `${requestOrigin}/payment-success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${requestOrigin}/payment-cancel`,
    });

    // Store the session in our database
    await prisma.transaction.create({
      data: {
        userId: req.user.id,
        amount,
        type: 'CREDIT',
        status: 'PENDING',
        description: 'Payment session created',
        stripeSessionId: session.id
      }
    });

    logger.logWithContext('info', 'Payment session created', {
      correlationId: req.correlationId,
      sessionId: session.id,
      amount,
      userId: req.user.id
    });

    res.json({
      success: true,
      data: {
        sessionId: session.id,
        url: session.url
      }
    });
  } catch (error) {
    logger.logWithContext('error', 'Error creating payment session', {
      correlationId: req.correlationId,
      error: error.message
    });
    res.status(500).json({ error: 'Failed to create payment session' });
  }
});

// Stripe webhook endpoint
app.post('/api/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  if (!stripe || !config.stripe.webhookSecret) {
    return res.status(503).json({
      error: 'Stripe webhook is not configured'
    });
  }

  const sig = req.headers['stripe-signature'];
  let event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, config.stripe.webhookSecret);
  } catch (err) {
    logger.logWithContext('error', 'Stripe webhook signature verification failed', {
      correlationId: req.headers['x-correlation-id'] || 'unknown',
      error: err.message
    });
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // Handle the event
  switch (event.type) {
    case 'checkout.session.completed':
      const session = event.data.object;
      
      // Update transaction status
      try {
        const transaction = await prisma.transaction.update({
          where: { stripeSessionId: session.id },
          data: { status: 'COMPLETED' }
        });

        // Update user's wallet balance if applicable
        if (transaction.type === 'CREDIT') {
          // Notify wallet service to update balance
          try {
            await axios.post(`${config.services.walletServiceUrl}/api/wallet/update-balance`, {
              userId: transaction.userId,
              amount: transaction.amount,
              transactionId: transaction.id
            }, {
              headers: {
                'X-Correlation-ID': req.headers['x-correlation-id'] || 'unknown'
              }
            });
          } catch (walletError) {
            logger.logWithContext('error', 'Failed to update wallet after payment', {
              correlationId: req.headers['x-correlation-id'] || 'unknown',
              error: walletError.message,
              transactionId: transaction.id
            });
          }
        }

        logger.logWithContext('info', 'Payment session completed', {
          correlationId: req.headers['x-correlation-id'] || 'unknown',
          sessionId: session.id,
          transactionId: transaction.id
        });
      } catch (updateError) {
        logger.logWithContext('error', 'Failed to update transaction after payment', {
          correlationId: req.headers['x-correlation-id'] || 'unknown',
          error: updateError.message,
          sessionId: session.id
        });
      }
      break;
    case 'payment_intent.succeeded':
      const paymentIntent = event.data.object;
      logger.logWithContext('info', 'Payment intent succeeded', {
        correlationId: req.headers['x-correlation-id'] || 'unknown',
        paymentIntentId: paymentIntent.id
      });
      break;
    case 'payment_intent.payment_failed':
      const failedPaymentIntent = event.data.object;
      logger.logWithContext('error', 'Payment intent failed', {
        correlationId: req.headers['x-correlation-id'] || 'unknown',
        paymentIntentId: failedPaymentIntent.id,
        reason: failedPaymentIntent.last_payment_error?.message
      });
      break;
    default:
      logger.logWithContext('info', 'Unhandled event type', {
        correlationId: req.headers['x-correlation-id'] || 'unknown',
        eventType: event.type
      });
  }

  res.json({ received: true });
});

// Request driver payout endpoint
app.post('/api/payout', authenticate, requireDriver, async (req, res) => {
  try {
    const { amount } = req.body;

    if (!amount || amount <= 0) {
      return res.status(400).json({ error: 'Valid amount is required' });
    }

    // Verify driver has sufficient balance in wallet
    const driver = await prisma.driver.findUnique({
      where: { userId: req.user.id },
      include: { user: true }
    });

    if (!driver) {
      return res.status(404).json({ error: 'Driver not found' });
    }

    // Check wallet balance
    try {
      const walletResponse = await axios.get(`${config.services.walletServiceUrl}/api/balance`, {
        headers: {
          'Authorization': req.headers.authorization,
          'X-Correlation-ID': req.correlationId
        }
      });

      const balance = walletResponse.data?.data?.balance ?? walletResponse.data?.balance ?? 0;
      if (balance < amount) {
        return res.status(400).json({ error: 'Insufficient funds in wallet' });
      }
    } catch (walletError) {
      logger.logWithContext('error', 'Failed to check wallet balance', {
        correlationId: req.correlationId,
        error: walletError.message,
        driverId: driver.id
      });
      return res.status(500).json({ error: 'Failed to verify wallet balance' });
    }

    // Create payout request
    const payout = await prisma.payout.create({
      data: {
        driverId: driver.id,
        amount,
        status: 'PENDING',
        idempotencyKey: `${driver.id}_${Date.now()}`
      }
    });

    logger.logWithContext('info', 'Payout requested', {
      correlationId: req.correlationId,
      payoutId: payout.id,
      driverId: driver.id,
      amount
    });

    res.json({
      success: true,
      data: payout
    });
  } catch (error) {
    logger.logWithContext('error', 'Error requesting payout', {
      correlationId: req.correlationId,
      error: error.message
    });
    res.status(500).json({ error: 'Failed to request payout' });
  }
});

// Reconciliation endpoint (for admin use)
app.get('/api/reconcile', authenticate, async (req, res) => {
  try {
    // Only admin can access this
    if (req.user.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const { from, to } = req.query;

    // Get date range
    const startDate = from ? new Date(from) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // 30 days ago
    const endDate = to ? new Date(to) : new Date();

    // Get transactions in the date range
    const transactions = await prisma.transaction.findMany({
      where: {
        createdAt: {
          gte: startDate,
          lte: endDate
        }
      },
      include: { user: true }
    });

    // Get payouts in the date range
    const payouts = await prisma.payout.findMany({
      where: {
        createdAt: {
          gte: startDate,
          lte: endDate
        }
      },
      include: { driver: { include: { user: true } } }
    });

    // Calculate totals
    const totalCredits = transactions
      .filter(t => t.type === 'CREDIT')
      .reduce((sum, t) => sum + t.amount, 0);

    const totalDebits = transactions
      .filter(t => t.type === 'DEBIT')
      .reduce((sum, t) => sum + t.amount, 0);

    const totalPayouts = payouts.reduce((sum, p) => sum + p.amount, 0);

    const reconciliation = {
      period: {
        start: startDate,
        end: endDate
      },
      totals: {
        credits: totalCredits,
        debits: totalDebits,
        payouts: totalPayouts,
        net: totalCredits - totalDebits
      },
      transactionCount: transactions.length,
      payoutCount: payouts.length,
      transactions,
      payouts
    };

    logger.logWithContext('info', 'Reconciliation completed', {
      correlationId: req.correlationId,
      period: `${startDate} to ${endDate}`,
      net: reconciliation.totals.net
    });

    res.json({
      success: true,
      data: reconciliation
    });
  } catch (error) {
    logger.logWithContext('error', 'Error during reconciliation', {
      correlationId: req.correlationId,
      error: error.message
    });
    res.status(500).json({ error: 'Failed to perform reconciliation' });
  }
});

// Get user balance endpoint
app.get('/api/balance', authenticate, async (req, res) => {
  try {
    // Forward to wallet service
    try {
      const response = await axios.get(`${config.services.walletServiceUrl}/api/balance`, {
        headers: {
          'Authorization': req.headers.authorization,
          'X-Correlation-ID': req.correlationId
        }
      });

      res.json(response.data);
    } catch (walletError) {
      logger.logWithContext('error', 'Failed to get wallet balance', {
        correlationId: req.correlationId,
        error: walletError.message,
        userId: req.user.id
      });
      res.status(500).json({ error: 'Failed to retrieve balance' });
    }
  } catch (error) {
    logger.logWithContext('error', 'Error getting balance', {
      correlationId: req.correlationId,
      error: error.message
    });
    res.status(500).json({ error: 'Failed to get balance' });
  }
});

// Global error handler
app.use((err, req, res, next) => {
  logger.logWithContext('error', 'Payment service error occurred', {
    correlationId: req.correlationId,
    error: err.message,
    stack: err.stack,
    path: req.path
  });
  
  res.status(500).json({
    error: 'Internal Server Error',
    correlationId: req.correlationId
  });
});

// Start the server
const PORT = process.env.PORT || 5003;
app.listen(PORT, () => {
  logger.logWithContext('info', `Payment service running`, {
    port: PORT,
    environment: config.environment,
    timestamp: new Date().toISOString()
  });
});

export default app;
