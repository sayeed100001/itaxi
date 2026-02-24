import { createRequire } from 'module';
const require = createRequire(import.meta.url);

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const axios = require('axios');
const http = require('http');
const { randomUUID, randomInt } = require('crypto');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Environment configuration
const config = {
  corsOrigin: process.env.CLIENT_URL || 'http://localhost:3000',
  environment: process.env.NODE_ENV || 'development',
  whatsapp: {
    accessToken: process.env.WHATSAPP_ACCESS_TOKEN,
    phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID,
    appSecret: process.env.WHATSAPP_APP_SECRET,
    verifyToken: process.env.WHATSAPP_VERIFY_TOKEN
  },
  services: {
    dispatchServiceUrl: process.env.DISPATCH_SERVICE_URL || 'http://localhost:5004',
    notificationServiceUrl: process.env.NOTIFICATION_SERVICE_URL || 'http://localhost:5006',
    fraudServiceUrl: process.env.FRAUD_SERVICE_URL || 'http://localhost:5007',
    analyticsServiceUrl: process.env.ANALYTICS_SERVICE_URL || 'http://localhost:5008',
    loyaltyServiceUrl: process.env.LOYALTY_SERVICE_URL || 'http://localhost:5010'
  }
};

// Logger implementation
const logger = {
  logWithContext: (level, message, context) => {
    console.log(`[${level.toUpperCase()}] ${message}`, context || '');
  }
};

// Add correlation ID middleware
const addCorrelationId = (req, res, next) => {
  req.correlationId = req.headers['x-correlation-id'] || randomUUID();
  next();
};

// Authentication middleware
const authenticate = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) {
    return res.status(401).json({ error: 'No token provided' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Invalid token' });
  }
};

const requireRider = (req, res, next) => {
  if (req.user.role !== 'RIDER') {
    return res.status(403).json({ error: 'Rider access required' });
  }
  next();
};

const requireDriver = (req, res, next) => {
  if (req.user.role !== 'DRIVER') {
    return res.status(403).json({ error: 'Driver access required' });
  }
  next();
};

// Import CommonJS module with dynamic import for compatibility
const { default: securityModule } = await import('../../shared/middleware/security.cjs');
const {
  securityHeaders,
  globalRateLimiter,
  loginLimiter,
  slowDownMiddleware,
  deviceFingerprint,
  securityCheck,
  sanitizeInput,
  validateInput,
  refreshAccessToken,
  generateSecureTokens,
  corsOptions,
  validateSecrets,
  maskPhone
} = securityModule;

import { centralizedLogging } from '../../shared/utils/log-rotation.js';
import { systemMonitor } from '../../shared/utils/system-monitor.js';
import GracefulShutdown from '../../shared/utils/graceful-shutdown.js';
import { RetryHandler, generateIdempotencyKey, processWithIdempotency } from '../../shared/utils/retry.js';

const app = express();
const authServiceLogger = centralizedLogging.getLogger('auth-service');

// Validate secrets at startup
validateSecrets();

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
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

app.use(cors({
  origin: config.corsOrigin,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Correlation-ID', 'X-Device-Fingerprint']
}));

// Enhanced rate limiting for auth endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: process.env.NODE_ENV === 'production' ? 5 : 1000,
  message: 'Too many authentication attempts, please try again later',
  standardHeaders: true,
  legacyHeaders: false,
});

// Enhanced OTP rate limiting
const otpLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: process.env.NODE_ENV === 'production' ? 10 : 20,
  keyGenerator: (req) => `${req.ip}:${req.body?.phone || 'unknown'}`,
  message: 'Too many OTP requests, please try again later',
  standardHeaders: true,
  legacyHeaders: false,
});

// Add correlation ID middleware
app.use(addCorrelationId);

// Health check endpoint
app.get('/health', async (req, res) => {
  try {
    // Check database connectivity
    await prisma.$queryRaw`SELECT 1`;

    // Get system health status
    const healthStatus = await systemMonitor.getHealthStatus();

    res.status(200).json({
      service: 'auth-service',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      ...healthStatus,
      status: 'OK'
    });
  } catch (error) {
    authServiceLogger.error('Health check failed', {
      correlationId: req.correlationId,
      error: error.message
    });
    res.status(503).json({
      status: 'unhealthy',
      service: 'auth-service',
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
      service: 'auth-service',
      process: systemMonitor.getProcessMetrics()
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
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
      logger.logWithContext('error', 'Auth service not ready', {
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

// Request OTP endpoint with enhanced security
app.post('/api/request-otp', otpLimiter, async (req, res) => {
  try {
    const { phone, name, role = 'RIDER', captchaToken } = req.body;
    const idempotencyKey = req.headers['idempotency-key'];

    // Process with idempotency if key provided
    if (idempotencyKey) {
      return processWithIdempotency(idempotencyKey, async () => {
        return processOTPRequest(req, res);
      });
    } else {
      return processOTPRequest(req, res);
    }
  } catch (error) {
    logger.logWithContext('error', 'Error requesting OTP', {
      correlationId: req.correlationId,
      error: error.message
    });
    res.status(500).json({ error: 'Failed to send OTP' });
  }
});

// Helper function for OTP processing
async function processOTPRequest(req, res) {
  const { phone, name, role = 'RIDER', captchaToken } = req.body;

  // Validate input
  if (!phone || phone.length < 10) {
    return res.status(400).json({ error: 'Valid phone number required' });
  }

  // reCAPTCHA verification if enabled
  if (config.whatsapp.verifyToken && captchaToken) {
    const retryHandler = new RetryHandler({ maxRetries: 3 });
    try {
      const recaptchaResponse = await retryHandler.execute(async () => {
        return await axios.post(
          'https://www.google.com/recaptcha/api/siteverify',
          null,
          {
            params: {
              secret: config.whatsapp.appSecret,
              response: captchaToken,
            },
          }
        );
      });

      if (!recaptchaResponse.data.success) {
        return res.status(400).json({ success: false, message: 'CAPTCHA verification failed' });
      }
    } catch (error) {
      logger.logWithContext('error', 'reCAPTCHA verification failed', {
        correlationId: req.correlationId,
        error: error.message
      });
      return res.status(400).json({ success: false, message: 'CAPTCHA verification failed' });
    }
  }

  // Generate a real one-time code for all environments.
  const code = randomInt(100000, 1000000).toString();
  const expiry = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes

  // Save OTP to database.
  // The schema has no composite unique key on (phone, verified), so we update
  // the latest unverified OTP row if it exists, otherwise create a new one.
  const existingOtp = await prisma.oTP.findFirst({
    where: {
      phone,
      verified: false
    },
    orderBy: {
      createdAt: 'desc'
    }
  });

  const otpRecord = existingOtp
    ? await prisma.oTP.update({
      where: { id: existingOtp.id },
      data: {
        code,
        expiresAt: expiry,
        verified: false,
        deliveryStatus: 'PENDING',
        messageId: null
      }
    })
    : await prisma.oTP.create({
      data: {
        phone,
        code,
        expiresAt: expiry
      }
    });

  // Send OTP via WhatsApp with retry logic
  if (config.whatsapp.accessToken) {
    const retryHandler = new RetryHandler({ maxRetries: 3 });
    try {
      const message = `Your iTaxi verification code is: ${code}`;
      const response = await retryHandler.execute(async () => {
        return await axios.post(
          `https://graph.facebook.com/v18.0/${config.whatsapp.phoneNumberId}/messages`,
          {
            messaging_product: 'whatsapp',
            to: phone,
            type: 'template',
            template: {
              name: 'otp_template',
              language: { code: 'en_US' },
              components: [
                {
                  type: 'body',
                  parameters: [{ type: 'text', text: code }]
                }
              ]
            }
          },
          {
            headers: {
              Authorization: `Bearer ${config.whatsapp.accessToken}`,
              'Content-Type': 'application/json',
            },
            timeout: 10000,
          }
        );
      });

      const messageId = response.data.messages?.[0]?.id;
      if (messageId) {
        await prisma.oTP.update({
          where: { id: otpRecord.id },
          data: { messageId, deliveryStatus: 'SENT' }
        });
      }
    } catch (error) {
      logger.logWithContext('error', 'Failed to send OTP via WhatsApp', {
        correlationId: req.correlationId,
        phone: maskPhone(phone),
        error: error.message
      });
      // Still return success to prevent enumeration attacks
    }
  }

  logger.logWithContext('info', 'OTP requested', {
    correlationId: req.correlationId,
    phone: maskPhone(phone),
    role
  });

  res.json({ success: true, message: 'OTP sent successfully' });
}

// Verify OTP endpoint with refresh token support
app.post('/api/verify-otp', async (req, res) => {
  try {
    const { phone, code } = req.body;

    if (!phone || !code) {
      return res.status(400).json({ error: 'Phone and code required' });
    }

    // Find OTP record
    const otpRecord = await prisma.oTP.findFirst({
      where: {
        phone,
        code,
        expiresAt: { gt: new Date() },
        verified: false
      }
    });

    if (!otpRecord) {
      return res.status(400).json({ error: 'Invalid or expired OTP' });
    }

    // Mark OTP as verified
    await prisma.oTP.update({
      where: { id: otpRecord.id },
      data: { verified: true }
    });

    // Find or create user
    let user = await prisma.user.findUnique({ where: { phone } });

    if (!user) {
      user = await prisma.user.create({
        data: {
          phone,
          name: req.body.name || `User-${phone.substring(phone.length - 4)}`,
          role: req.body.role || 'RIDER'
        }
      });

      // If user is a driver, create driver record
      if (req.body.role === 'DRIVER') {
        await prisma.driver.create({
          data: {
            userId: user.id,
            vehicleType: 'sedan',
            plateNumber: 'UNKNOWN'
          }
        });
      }
    }

    // Generate secure tokens with refresh token
    const { accessToken, refreshToken } = generateSecureTokens({
      id: user.id,
      role: user.role
    });

    logger.logWithContext('info', 'OTP verified successfully', {
      correlationId: req.correlationId,
      userId: user.id,
      role: user.role
    });

    res.json({
      success: true,
      data: {
        accessToken,
        refreshToken, // Include refresh token
        user: {
          id: user.id,
          name: user.name,
          phone: maskPhone(user.phone), // Mask phone in response
          role: user.role
        }
      }
    });
  } catch (error) {
    logger.logWithContext('error', 'Error verifying OTP', {
      correlationId: req.correlationId,
      error: error.message
    });
    res.status(500).json({ error: 'Failed to verify OTP' });
  }
});

// Refresh token endpoint
app.post('/api/refresh-token', async (req, res) => {
  try {
    const { refreshToken, userId } = req.body;

    if (!refreshToken || !userId) {
      return res.status(400).json({ error: 'Refresh token and user ID required' });
    }

    const newAccessToken = await refreshAccessToken(refreshToken, userId);

    res.json({
      success: true,
      data: {
        accessToken: newAccessToken
      }
    });
  } catch (error) {
    logger.logWithContext('error', 'Error refreshing token', {
      correlationId: req.correlationId,
      error: error.message
    });
    res.status(401).json({ error: 'Invalid refresh token' });
  }
});

// Admin login endpoint with enhanced security
app.post('/api/admin-login', authLimiter, async (req, res) => {
  try {
    const { phone, password } = req.body;

    if (!phone || !password) {
      return res.status(400).json({ error: 'Phone and password required' });
    }

    const user = await prisma.user.findUnique({ where: { phone } });

    if (!user || user.role !== 'ADMIN') {
      return res.status(401).json({ error: 'Invalid credentials or not an admin' });
    }

    if (!user.password) {
      return res.status(401).json({ error: 'Invalid credentials or not an admin' });
    }

    const passwordValid = await bcrypt.compare(password, user.password);
    if (!passwordValid) {
      return res.status(401).json({ error: 'Invalid credentials or not an admin' });
    }

    const { accessToken, refreshToken } = generateSecureTokens({
      id: user.id,
      role: user.role
    });

    res.json({
      success: true,
      data: {
        accessToken,
        refreshToken,
        user: {
          id: user.id,
          name: user.name,
          phone: maskPhone(user.phone),
          role: user.role
        }
      }
    });
  } catch (error) {
    logger.logWithContext('error', 'Error in admin login', {
      correlationId: req.correlationId,
      error: error.message
    });
    res.status(500).json({ error: 'Failed to login' });
  }
});

// Validate token endpoint (used by gateway and other services)
app.get('/api/validate', authenticate, (req, res) => {
  res.json({
    success: true,
    user: {
      ...req.user,
      phone: maskPhone(req.user.phone) // Mask phone in validation response
    }
  });
});

// Global error handler
app.use((err, req, res, next) => {
  logger.logWithContext('error', 'Auth service error occurred', {
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
const PORT = process.env.PORT || 5001;
const server = http.createServer(app);

server.listen(PORT, () => {
  logger.logWithContext('info', `Auth service running`, {
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
