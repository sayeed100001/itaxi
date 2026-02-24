import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import axios from 'axios';
import { PrismaClient } from '@prisma/client';
import { config } from '@shared/config';
import { logger, addCorrelationId } from '@shared/logger';
import { authenticate } from '@shared/auth';

const app = express();
const prisma = new PrismaClient();

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
const fraudLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20, // limit each IP to 20 requests per windowMs
  message: 'Too many fraud detection requests, please try again later',
  standardHeaders: true,
  legacyHeaders: false,
});

// Add correlation ID middleware
app.use(addCorrelationId);

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'OK',
    service: 'Fraud Service',
    timestamp: new Date().toISOString(),
    correlationId: req.correlationId
  });
});

// Metrics endpoint
app.get('/metrics', (req, res) => {
  res.status(200).json({
    status: 'OK',
    service: 'Fraud Service',
    metrics: {
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      detectedFrauds: 0, // Placeholder
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
      logger.logWithContext('error', 'Fraud service not ready', {
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

// Fraud detection endpoint
app.post('/api/detect', authenticate, fraudLimiter, async (req, res) => {
  try {
    const { userId, action, context } = req.body;

    if (!userId || !action) {
      return res.status(400).json({ error: 'User ID and action are required' });
    }

    // Run fraud detection rules
    const fraudCheckResult = await runFraudDetection(userId, action, context);

    logger.logWithContext('info', 'Fraud detection completed', {
      correlationId: req.correlationId,
      userId,
      action,
      riskScore: fraudCheckResult.totalRiskScore,
      violations: fraudCheckResult.violations.length
    });

    res.json({
      success: true,
      data: fraudCheckResult
    });
  } catch (error) {
    logger.logWithContext('error', 'Error in fraud detection', {
      correlationId: req.correlationId,
      error: error.message
    });
    res.status(500).json({ error: 'Failed to run fraud detection' });
  }
});

// SOS triggered endpoint (internal use)
app.post('/api/fraud/sos-triggered', authenticate, async (req, res) => {
  try {
    const { tripId, userId, location } = req.body;

    // Log this as a high-risk event
    const fraudEvent = await prisma.fraudEvent.create({
      data: {
        userId,
        tripId,
        type: 'SOS_TRIGGERED',
        description: 'SOS emergency button triggered',
        severity: 'HIGH',
        location: {
          latitude: location.lat,
          longitude: location.lng
        },
        riskScore: 90,
        status: 'PENDING_REVIEW'
      }
    });

    // Send alert to admin
    try {
      await axios.post(`${config.services.notificationServiceUrl}/api/notifications/bulk-send`, {
        recipients: [(await prisma.user.findFirst({ where: { role: 'ADMIN' } }))?.id].filter(Boolean),
        type: 'FRAUD_ALERT',
        message: `🚨 HIGH RISK EVENT: SOS triggered by user ${userId} for trip ${tripId} at location ${location.lat}, ${location.lng}`,
        priority: 'HIGH'
      }, {
        headers: {
          'Authorization': req.headers.authorization,
          'X-Correlation-ID': req.correlationId
        }
      });
    } catch (notificationError) {
      logger.logWithContext('warn', 'Failed to send fraud alert notification', {
        correlationId: req.correlationId,
        error: notificationError.message
      });
    }

    logger.logWithContext('warn', 'SOS fraud event logged', {
      correlationId: req.correlationId,
      userId,
      tripId,
      riskScore: 90
    });

    res.json({
      success: true,
      data: fraudEvent
    });
  } catch (error) {
    logger.logWithContext('error', 'Error handling SOS fraud event', {
      correlationId: req.correlationId,
      error: error.message
    });
    res.status(500).json({ error: 'Failed to handle SOS fraud event' });
  }
});

// Get fraud events endpoint
app.get('/api/events', authenticate, async (req, res) => {
  try {
    // Only admin can view all fraud events
    if (req.user.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const { limit = 50, offset = 0, severity, status, type } = req.query;

    const filters = {};
    if (severity) filters.severity = severity;
    if (status) filters.status = status;
    if (type) filters.type = type;

    const events = await prisma.fraudEvent.findMany({
      where: filters,
      orderBy: { createdAt: 'desc' },
      take: parseInt(limit),
      skip: parseInt(offset)
    });

    const totalCount = await prisma.fraudEvent.count({
      where: filters
    });

    res.json({
      success: true,
      data: {
        events,
        pagination: {
          limit: parseInt(limit),
          offset: parseInt(offset),
          total: totalCount
        }
      }
    });
  } catch (error) {
    logger.logWithContext('error', 'Error getting fraud events', {
      correlationId: req.correlationId,
      error: error.message
    });
    res.status(500).json({ error: 'Failed to get fraud events' });
  }
});

// Update fraud event status endpoint
app.patch('/api/events/:eventId/status', authenticate, async (req, res) => {
  try {
    // Only admin can update fraud event status
    if (req.user.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const { eventId } = req.params;
    const { status, resolutionNotes } = req.body;

    if (!['PENDING_REVIEW', 'UNDER_INVESTIGATION', 'CONFIRMED_FRAUD', 'CLEARED'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }

    const updatedEvent = await prisma.fraudEvent.update({
      where: { id: eventId },
      data: {
        status,
        resolutionNotes,
        resolvedAt: status !== 'PENDING_REVIEW' ? new Date() : undefined,
        resolvedBy: status !== 'PENDING_REVIEW' ? req.user.id : undefined
      }
    });

    logger.logWithContext('info', 'Fraud event status updated', {
      correlationId: req.correlationId,
      eventId,
      newStatus: status,
      updatedBy: req.user.id
    });

    res.json({
      success: true,
      data: updatedEvent
    });
  } catch (error) {
    logger.logWithContext('error', 'Error updating fraud event status', {
      correlationId: req.correlationId,
      error: error.message,
      eventId: req.params.eventId
    });
    res.status(500).json({ error: 'Failed to update fraud event status' });
  }
});

// Get user risk profile endpoint
app.get('/api/risk-profile/:userId', authenticate, async (req, res) => {
  try {
    // Only admin can view user risk profiles
    if (req.user.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const { userId } = req.params;

    // Get user fraud history
    const fraudEvents = await prisma.fraudEvent.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' }
    });

    // Calculate risk score
    const totalRiskScore = fraudEvents.reduce((sum, event) => sum + event.riskScore, 0);
    const confirmedFrauds = fraudEvents.filter(event => event.status === 'CONFIRMED_FRAUD').length;

    const riskProfile = {
      userId,
      totalRiskScore,
      confirmedFrauds,
      totalEvents: fraudEvents.length,
      recentEvents: fraudEvents.slice(0, 5),
      status: totalRiskScore > 100 ? 'HIGH_RISK' : totalRiskScore > 50 ? 'MEDIUM_RISK' : 'LOW_RISK',
      lastUpdated: new Date()
    };

    res.json({
      success: true,
      data: riskProfile
    });
  } catch (error) {
    logger.logWithContext('error', 'Error getting user risk profile', {
      correlationId: req.correlationId,
      error: error.message,
      userId: req.params.userId
    });
    res.status(500).json({ error: 'Failed to get user risk profile' });
  }
});

// Run fraud detection rules
async function runFraudDetection(userId, action, context) {
  // Get user's recent activity
  const recentActivity = await prisma.auditLog.findMany({
    where: {
      userId,
      createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } // Last 24 hours
    },
    orderBy: { createdAt: 'desc' },
    take: 100
  });

  const violations = [];
  let totalRiskScore = 0;

  // Rule 1: OTP abuse detection
  if (action === 'REQUEST_OTP') {
    const otpRequests = recentActivity.filter(log => log.action === 'REQUEST_OTP');
    if (otpRequests.length > 10) {
      violations.push({
        rule: 'OTP_ABUSE',
        description: 'Too many OTP requests in 24 hours',
        riskScore: 20,
        severity: 'MEDIUM'
      });
      totalRiskScore += 20;
    }
  }

  // Rule 2: Location spoofing detection
  if (context && context.location) {
    const locationChanges = recentActivity.filter(log => 
      log.details?.location && 
      calculateDistance(
        log.details.location.latitude, 
        log.details.location.longitude,
        context.location.lat,
        context.location.lng
      ) > 100000 // More than 100km in short time
    );

    if (locationChanges.length > 0) {
      violations.push({
        rule: 'LOCATION_SPOOFING',
        description: 'Suspicious location changes detected',
        riskScore: 30,
        severity: 'HIGH'
      });
      totalRiskScore += 30;
    }
  }

  // Rule 3: Trip cancellation pattern
  if (action === 'CANCEL_TRIP') {
    const cancellations = recentActivity.filter(log => 
      log.action === 'CANCEL_TRIP' && 
      log.createdAt > new Date(Date.now() - 60 * 60 * 1000) // In last hour
    );
    
    if (cancellations.length >= 3) {
      violations.push({
        rule: 'EXCESSIVE_CANCELLATIONS',
        description: 'Multiple trip cancellations in short period',
        riskScore: 25,
        severity: 'MEDIUM'
      });
      totalRiskScore += 25;
    }
  }

  // Rule 4: Same rider-driver pattern
  if (context && context.driverId) {
    const sameDriverTrips = await prisma.trip.findMany({
      where: {
        riderId: userId,
        driverId: context.driverId,
        createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } // Last 7 days
      }
    });

    if (sameDriverTrips.length > 10) {
      violations.push({
        rule: 'SAME_DRIVER_PATTERN',
        description: 'Unusually high number of trips with same driver',
        riskScore: 40,
        severity: 'HIGH'
      });
      totalRiskScore += 40;
    }
  }

  // Rule 5: Speed anomaly detection
  if (context && context.speed) {
    if (context.speed > 200) { // More than 200 km/h
      violations.push({
        rule: 'SPEED_ANOMALY',
        description: 'Unrealistic speed detected',
        riskScore: 50,
        severity: 'HIGH'
      });
      totalRiskScore += 50;
    }
  }

  // Rule 6: Device fingerprinting
  if (context && context.deviceId) {
    const otherAccounts = await prisma.user.findMany({
      where: {
        deviceId: context.deviceId,
        id: { not: userId }
      }
    });

    if (otherAccounts.length > 0) {
      violations.push({
        rule: 'MULTIPLE_ACCOUNTS_SAME_DEVICE',
        description: 'Multiple accounts using same device',
        riskScore: 35,
        severity: 'MEDIUM'
      });
      totalRiskScore += 35;
    }
  }

  // Rule 7: Refund abuse
  if (action === 'REQUEST_REFUND') {
    const refundRequests = recentActivity.filter(log => log.action === 'REQUEST_REFUND');
    if (refundRequests.length > 3) {
      violations.push({
        rule: 'REFUND_ABUSE',
        description: 'Excessive refund requests',
        riskScore: 30,
        severity: 'MEDIUM'
      });
      totalRiskScore += 30;
    }
  }

  // Determine overall risk level
  let riskLevel = 'LOW';
  if (totalRiskScore >= 100) riskLevel = 'HIGH';
  else if (totalRiskScore >= 50) riskLevel = 'MEDIUM';

  // Create fraud event if risk score is high enough
  if (totalRiskScore >= 50) {
    await prisma.fraudEvent.create({
      data: {
        userId,
        type: 'AUTOMATIC_DETECTION',
        description: `Automatically detected suspicious activity: ${violations.map(v => v.rule).join(', ')}`,
        severity: riskLevel,
        riskScore: totalRiskScore,
        status: 'PENDING_REVIEW',
        details: {
          action,
          context,
          violations: violations.map(v => v.rule)
        }
      }
    });
  }

  return {
    userId,
    action,
    totalRiskScore,
    riskLevel,
    violations,
    isFraudulent: riskLevel !== 'LOW',
    recommendedAction: getRecommendedAction(riskLevel, violations)
  };
}

// Helper function to calculate distance between two points (in meters)
function calculateDistance(lat1, lon1, lat2, lon2) {
  if (!lat1 || !lon1 || !lat2 || !lon2) return Infinity;

  const R = 6371e3; // Earth radius in meters
  const φ1 = lat1 * Math.PI/180;
  const φ2 = lat2 * Math.PI/180;
  const Δφ = (lat2-lat1) * Math.PI/180;
  const Δλ = (lon2-lon1) * Math.PI/180;

  const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
          Math.cos(φ1) * Math.cos(φ2) *
          Math.sin(Δλ/2) * Math.sin(Δλ/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

  return R * c; // Distance in meters
}

// Helper function to get recommended action based on risk level
function getRecommendedAction(riskLevel, violations) {
  if (riskLevel === 'HIGH') {
    return 'BLOCK_USER_TEMPORARILY';
  } else if (riskLevel === 'MEDIUM') {
    return 'MONITOR_CLOSELY';
  } else {
    return 'ALLOW_TRANSACTION';
  }
}

// Global error handler
app.use((err, req, res, next) => {
  logger.logWithContext('error', 'Fraud service error occurred', {
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
const PORT = process.env.PORT || 5007;
app.listen(PORT, () => {
  logger.logWithContext('info', `Fraud service running`, {
    port: PORT,
    environment: config.environment,
    timestamp: new Date().toISOString()
  });
});

export default app;
