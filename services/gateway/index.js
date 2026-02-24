import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import slowDown from 'express-slow-down';
import { createProxyMiddleware } from 'http-proxy-middleware';
import { config } from '@shared/config';
import { logger, addCorrelationId } from '@shared/logger';
import { authenticate, authenticateWithRefresh } from '@shared/auth';

// Import CommonJS module with dynamic import for compatibility
const { default: securityModule } = await import('../../shared/middleware/security.cjs');
const {
  securityHeaders,
  globalRateLimiter,
  slowDownMiddleware,
  deviceFingerprint,
  securityCheck,
  sanitizeInput,
  validateInput,
  corsOptions,
  maskPhone
} = securityModule;

import { centralizedLogging } from '../../shared/utils/log-rotation.js';
import { systemMonitor } from '../../shared/utils/system-monitor.js';
import GracefulShutdown from '../../shared/utils/graceful-shutdown.js';
import { RetryHandler } from '../../shared/utils/retry.js';
import { Server } from 'socket.io';
import http from 'http';

const app = express();
const gatewayLogger = centralizedLogging.getLogger('gateway-service');

// Enhanced security middleware
app.use(securityHeaders);
app.use(globalRateLimiter);
app.use(deviceFingerprint);
app.use(securityCheck);
app.use(sanitizeInput);
app.use(validateInput);

// Original middleware
app.use(helmet());
app.use(compression());

// CORS configuration
app.use(cors({
  origin: config.corsOrigin,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Correlation-ID', 'X-Device-Fingerprint', 'X-Refresh-Token', 'X-User-ID']
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP',
  standardHeaders: true,
  legacyHeaders: false,
});
app.use(limiter);

// Slow down repeated requests
app.use(slowDown({
  windowMs: 15 * 60 * 1000, // 15 minutes
  delayAfter: 10, // Begin slowing down after 10 requests
  delayMs: 500, // Slow down by 500ms per request after delayAfter
}));

// Add correlation ID middleware
app.use(addCorrelationId);

// Health check endpoint
app.get('/health', async (req, res) => {
  try {
    // Check if all services are reachable
    const serviceChecks = await Promise.allSettled([
      checkServiceHealth(config.services.authServiceUrl),
      checkServiceHealth(config.services.rideServiceUrl),
      checkServiceHealth(config.services.paymentServiceUrl),
      checkServiceHealth(config.services.dispatchServiceUrl),
      checkServiceHealth(config.services.walletServiceUrl),
      checkServiceHealth(config.services.notificationServiceUrl),
      checkServiceHealth(config.services.fraudServiceUrl),
      checkServiceHealth(config.services.analyticsServiceUrl),
      checkServiceHealth(config.services.corporateServiceUrl),
      checkServiceHealth(config.services.loyaltyServiceUrl),
    ]);

    const results = serviceChecks.map(result =>
      result.status === 'fulfilled' ? result.value : { healthy: false, error: result.reason }
    );

    const allHealthy = results.every(service => service.healthy);

    // Get system health status
    const healthStatus = await systemMonitor.getHealthStatus();

    res.status(200).json({
      status: allHealthy ? 'healthy' : 'degraded',
      service: 'gateway-service',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      services: results,
      ...healthStatus
    });
  } catch (error) {
    gatewayLogger.error('Health check failed', {
      correlationId: req.correlationId,
      error: error.message
    });
    res.status(503).json({
      status: 'unhealthy',
      service: 'gateway-service',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Metrics endpoint
app.get('/metrics', async (req, res) => {
  try {
    const metrics = await systemMonitor.getSystemMetrics();

    res.status(200).json({
      ...metrics,
      service: 'gateway-service',
      process: systemMonitor.getProcessMetrics()
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Ready check endpoint
app.get('/ready', (req, res) => {
  // Check if all services are reachable
  Promise.all([
    checkServiceHealth(config.services.authServiceUrl),
    checkServiceHealth(config.services.rideServiceUrl),
    checkServiceHealth(config.services.paymentServiceUrl),
    checkServiceHealth(config.services.dispatchServiceUrl),
  ])
    .then(results => {
      const allHealthy = results.every(service => service.healthy);
      res.status(allHealthy ? 200 : 503).json({
        status: allHealthy ? 'READY' : 'NOT_READY',
        services: results,
        correlationId: req.correlationId
      });
    })
    .catch(error => {
      res.status(503).json({
        status: 'NOT_READY',
        error: error.message,
        correlationId: req.correlationId
      });
    });
});

// Helper function to check service health
async function checkServiceHealth(url) {
  try {
    if (!url) return { url: 'N/A', healthy: false, error: 'URL not configured' };

    // Use retry handler for health checks
    const retryHandler = new RetryHandler({ maxRetries: 2, baseDelay: 500 });
    const response = await retryHandler.execute(async () => {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      const resp = await fetch(`${url}/health`, {
        signal: controller.signal,
        headers: { 'X-Correlation-ID': 'health-check' }
      });

      clearTimeout(timeoutId);
      return resp;
    });

    return { url, healthy: response.ok };
  } catch (error) {
    return { url, healthy: false, error: error.message };
  }
}

// Proxy middleware for services with enhanced error handling
const createEnhancedProxy = (target, pathRewrite = {}) => {
  return createProxyMiddleware({
    target,
    changeOrigin: true,
    pathRewrite,
    onProxyReq: (proxyReq, req, res) => {
      proxyReq.setHeader('X-Correlation-ID', req.correlationId);
      // Forward device fingerprint
      if (req.deviceFingerprint) {
        proxyReq.setHeader('X-Device-Fingerprint', req.deviceFingerprint);
      }
      // Forward refresh token if present
      if (req.headers['x-refresh-token']) {
        proxyReq.setHeader('X-Refresh-Token', req.headers['x-refresh-token']);
      }
      // Forward user ID if present
      if (req.headers['x-user-id']) {
        proxyReq.setHeader('X-User-ID', req.headers['x-user-id']);
      }
    },
    onProxyRes: (proxyRes, req, res) => {
      proxyRes.headers['X-Correlation-ID'] = req.correlationId;
      // Add security headers to response
      proxyRes.headers['X-Content-Type-Options'] = 'nosniff';
      proxyRes.headers['X-Frame-Options'] = 'DENY';
      proxyRes.headers['X-XSS-Protection'] = '1; mode=block';
    },
    onError: (err, req, res) => {
      gatewayLogger.error('Proxy error', {
        correlationId: req.correlationId,
        error: err.message,
        path: req.path,
        target
      });

      res.status(502).json({
        error: 'Service unavailable',
        message: 'Upstream service temporarily unavailable',
        correlationId: req.correlationId
      });
    }
  });
};

const authProxy = createEnhancedProxy(config.services.authServiceUrl, {
  '^/api/auth': '/api',
});

const rideProxy = createEnhancedProxy(config.services.rideServiceUrl, {
  '^/api/trips': '/api',
});

const paymentProxy = createEnhancedProxy(config.services.paymentServiceUrl, {
  '^/api/payments': '/api',
});

const dispatchProxy = createEnhancedProxy(config.services.dispatchServiceUrl, {
  '^/api/dispatch': '/api',
});

const walletProxy = createEnhancedProxy(config.services.walletServiceUrl, {
  '^/api/wallet': '/api',
});

const notificationProxy = createEnhancedProxy(config.services.notificationServiceUrl, {
  '^/api/notifications': '/api',
});

const fraudProxy = createEnhancedProxy(config.services.fraudServiceUrl, {
  '^/api/fraud': '/api',
});

const analyticsProxy = createEnhancedProxy(config.services.analyticsServiceUrl, {
  '^/api/analytics': '/api',
});

const corporateProxy = createEnhancedProxy(config.services.corporateServiceUrl, {
  '^/api/corporate': '/api',
});

const loyaltyProxy = createEnhancedProxy(config.services.loyaltyServiceUrl, {
  '^/api/loyalty': '/api',
});

// Define routes with proxy middleware
app.use('/api/auth', authProxy);
app.use('/api/trips', authenticateWithRefresh, rideProxy);
app.use('/api/payments', authenticateWithRefresh, paymentProxy);
app.use('/api/dispatch', authenticateWithRefresh, dispatchProxy);
app.use('/api/wallet', authenticateWithRefresh, walletProxy);
app.use('/api/notifications', authenticateWithRefresh, notificationProxy);
app.use('/api/fraud', authenticateWithRefresh, fraudProxy);
app.use('/api/analytics', authenticateWithRefresh, analyticsProxy);
app.use('/api/corporate', authenticateWithRefresh, corporateProxy);
app.use('/api/loyalty', authenticateWithRefresh, loyaltyProxy);

// Global error handler
app.use((err, req, res, next) => {
  gatewayLogger.error('Gateway error occurred', {
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

// Start the server with graceful shutdown
const PORT = process.env.PORT || 5000;
const server = http.createServer(app);

// Initialize Socket.IO with sticky sessions for scaling
const io = new Server(server, {
  cors: {
    origin: config.corsOrigin,
    methods: ['GET', 'POST']
  },
  transports: ['websocket', 'polling'],
  // For sticky sessions in clustered environments
  cookie: {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict'
  }
});

io.on('connection', (socket) => {
  gatewayLogger.info('New socket connection', {
    socketId: socket.id,
    correlationId: 'socket-connect'
  });

  socket.on('disconnect', (reason) => {
    gatewayLogger.info('Socket disconnected', {
      socketId: socket.id,
      reason,
      correlationId: 'socket-disconnect'
    });
  });
});

server.listen(PORT, () => {
  logger.logWithContext('info', `Gateway service running`, {
    port: PORT,
    environment: config.environment,
    timestamp: new Date().toISOString()
  });
});

// Initialize graceful shutdown
const gracefulShutdown = new GracefulShutdown(app, server);
gracefulShutdown.init();

// Start system monitoring
systemMonitor.startMonitoring();

export default app;