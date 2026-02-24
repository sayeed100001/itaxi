import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import { createServer } from 'http';
import { config } from './config/env';
import { errorHandler } from './middlewares/errorHandler';
import routes from './routes';
import paymentRoutes from './routes/payment.routes';
import { initializeSocket } from './config/socket';
import prisma from './config/database';
import logger from './config/logger';
import { initSentry } from './config/sentry';
import Sentry from '@sentry/node';
import { startOTPCleanup } from './services/otpCleanup.service';
import { startReconciliationCron } from './services/reconciliation.service';
import { startScheduledTripDispatcher } from './services/scheduledTripDispatcher.service';

// Initialize Sentry (no-op if DSN is not configured)
initSentry();

const app = express();
const httpServer = createServer(app);

// Security Middleware
app.use(helmet());
app.use(compression());

// CORS Configuration
app.use(cors({
  origin: config.clientUrl,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Request Timeouts (CRITICAL FIX #1)
app.use((req, res, next) => {
  req.setTimeout(30000); // 30 seconds
  res.setTimeout(30000);
  next();
});

// Global Rate Limiting - IPv6 Safe
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: 'Too many requests from this IP',
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => req.path === '/health'
});
app.use(globalLimiter);

// Webhook Rate Limiter - Using Stripe Signature as Key
const webhookLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    // Use stripe signature as the key (most reliable)
    const signature = req.headers['stripe-signature'];
    if (signature) {
      return `webhook-${signature}`;
    }
    // Fallback to a generic webhook key
    return 'webhook-generic';
  }
});

// Stripe webhook needs raw body
app.use('/api/payments/webhook', webhookLimiter, express.raw({ type: 'application/json' }));

// WhatsApp webhook needs raw body for signature verification
app.use('/api/whatsapp/webhook', webhookLimiter, express.raw({ type: 'application/json' }));

// Body Parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Compatibility health endpoint for legacy scripts/probes.
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Sentry handlers (only if available and DSN is configured)
const sentryDsn = process.env.SENTRY_DSN;
const hasSentryHandlers =
  sentryDsn &&
  (Sentry as any)?.Handlers &&
  typeof (Sentry as any).Handlers.requestHandler === 'function';
const sentryHandlers = (Sentry as any)?.Handlers;

if (hasSentryHandlers) {
  app.use(sentryHandlers.requestHandler());
  if (typeof sentryHandlers.tracingHandler === 'function') {
    app.use(sentryHandlers.tracingHandler());
  }
}

// Routes
app.use('/api/payments', paymentRoutes);
app.use('/api', routes);

// Sentry error handler (only if available and DSN is configured)
if (hasSentryHandlers && typeof (Sentry as any).Handlers.errorHandler === 'function') {
  app.use(sentryHandlers.errorHandler());
}

// Error Handler
app.use(errorHandler);

// Initialize WebSocket
initializeSocket(httpServer);

// Start OTP cleanup cron
startOTPCleanup();

// Start reconciliation cron
startReconciliationCron();

// Start scheduled trip dispatch cron
startScheduledTripDispatcher();

// Start Server
const PORT = config.port;

httpServer.listen(PORT, () => {
  logger.info(`Server running on port ${PORT}`);
  logger.info(`WebSocket enabled`);
  logger.info(`Environment: ${config.nodeEnv}`);
});

// Graceful Shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, closing server...');
  await prisma.$disconnect();
  httpServer.close(() => {
    logger.info('Server closed');
    process.exit(0);
  });
});

export default app;
