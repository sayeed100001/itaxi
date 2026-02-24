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
const analyticsLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 50, // limit each IP to 50 requests per windowMs
  message: 'Too many analytics requests, please try again later',
  standardHeaders: true,
  legacyHeaders: false,
});

// Add correlation ID middleware
app.use(addCorrelationId);

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'OK',
    service: 'Analytics Service',
    timestamp: new Date().toISOString(),
    correlationId: req.correlationId
  });
});

// Metrics endpoint
app.get('/metrics', (req, res) => {
  res.status(200).json({
    status: 'OK',
    service: 'Analytics Service',
    metrics: {
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      processedEvents: 0, // Placeholder
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
      logger.logWithContext('error', 'Analytics service not ready', {
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

// Get surge factor endpoint
app.get('/api/analytics/surge-factor', authenticate, async (req, res) => {
  try {
    const { lat, lng } = req.query;

    if (!lat || !lng) {
      return res.status(400).json({ error: 'Latitude and longitude required' });
    }

    // Calculate demand/supply ratio for the area
    const surgeData = await calculateSurgeFactor(parseFloat(lat), parseFloat(lng));

    res.json({
      success: true,
      data: surgeData
    });
  } catch (error) {
    logger.logWithContext('error', 'Error calculating surge factor', {
      correlationId: req.correlationId,
      error: error.message
    });
    res.status(500).json({ error: 'Failed to calculate surge factor' });
  }
});

// Get dashboard analytics endpoint
app.get('/api/analytics/dashboard', authenticate, async (req, res) => {
  try {
    // Only admin can access dashboard
    if (req.user.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const { from, to } = req.query;

    // Get date range
    const startDate = from ? new Date(from) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // 30 days ago
    const endDate = to ? new Date(to) : new Date();

    // Get various metrics
    const [
      dailyTrips,
      revenueData,
      userGrowth,
      driverStats,
      ratingStats
    ] = await Promise.all([
      // Daily trips
      prisma.trip.groupBy({
        by: ['date'],
        where: {
          createdAt: { gte: startDate, lte: endDate }
        },
        _count: true,
        _sum: { fare: true }
      }),
      
      // Revenue data
      prisma.transaction.aggregate({
        where: {
          createdAt: { gte: startDate, lte: endDate },
          type: 'CREDIT',
          status: 'COMPLETED'
        },
        _sum: { amount: true }
      }),
      
      // User growth
      prisma.user.groupBy({
        by: ['createdAt'],
        where: {
          createdAt: { gte: startDate, lte: endDate }
        },
        _count: true
      }),
      
      // Driver stats
      prisma.driver.aggregate({
        where: {
          createdAt: { gte: startDate, lte: endDate }
        },
        _count: true
      }),
      
      // Average ratings
      prisma.trip.aggregate({
        where: {
          createdAt: { gte: startDate, lte: endDate },
          rating: { not: null }
        },
        _avg: { rating: true },
        _count: true
      })
    ]);

    const dashboardData = {
      period: {
        start: startDate,
        end: endDate
      },
      keyMetrics: {
        totalTrips: dailyTrips.reduce((sum, day) => sum + day._count, 0),
        totalRevenue: revenueData._sum.amount || 0,
        totalUsers: userGrowth.reduce((sum, day) => sum + day._count, 0),
        totalDrivers: driverStats._count,
        avgRating: ratingStats._avg.rating || 0,
        tripCompletionRate: 0 // Would calculate from total vs completed trips
      },
      dailyTrips: dailyTrips,
      revenue: revenueData._sum.amount,
      userGrowth: userGrowth,
      driverStats: driverStats
    };

    res.json({
      success: true,
      data: dashboardData
    });
  } catch (error) {
    logger.logWithContext('error', 'Error getting dashboard analytics', {
      correlationId: req.correlationId,
      error: error.message
    });
    res.status(500).json({ error: 'Failed to get dashboard analytics' });
  }
});

// Get location-based analytics endpoint
app.get('/api/analytics/location/:geohash', authenticate, async (req, res) => {
  try {
    // Only admin can access location analytics
    if (req.user.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const { geohash } = req.params;

    // Get analytics for the specific geohash area
    const locationData = await getLocationAnalytics(geohash);

    res.json({
      success: true,
      data: locationData
    });
  } catch (error) {
    logger.logWithContext('error', 'Error getting location analytics', {
      correlationId: req.correlationId,
      error: error.message,
      geohash: req.params.geohash
    });
    res.status(500).json({ error: 'Failed to get location analytics' });
  }
});

// Get user analytics endpoint
app.get('/api/analytics/users/:userId', authenticate, async (req, res) => {
  try {
    const { userId } = req.params;

    // Check permissions - users can only access their own data
    if (req.user.role !== 'ADMIN' && req.user.id !== userId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const userData = await getUserAnalytics(userId);

    res.json({
      success: true,
      data: userData
    });
  } catch (error) {
    logger.logWithContext('error', 'Error getting user analytics', {
      correlationId: req.correlationId,
      error: error.message,
      userId: req.params.userId
    });
    res.status(500).json({ error: 'Failed to get user analytics' });
  }
});

// Get driver analytics endpoint
app.get('/api/analytics/drivers/:driverId', authenticate, async (req, res) => {
  try {
    const { driverId } = req.params;

    // Check permissions - drivers can only access their own data
    if (req.user.role !== 'ADMIN') {
      const driver = await prisma.driver.findUnique({
        where: { id: driverId }
      });
      if (!driver || driver.userId !== req.user.id) {
        return res.status(403).json({ error: 'Access denied' });
      }
    }

    const driverData = await getDriverAnalytics(driverId);

    res.json({
      success: true,
      data: driverData
    });
  } catch (error) {
    logger.logWithContext('error', 'Error getting driver analytics', {
      correlationId: req.correlationId,
      error: error.message,
      driverId: req.params.driverId
    });
    res.status(500).json({ error: 'Failed to get driver analytics' });
  }
});

// Get trip analytics endpoint
app.get('/api/analytics/trips', authenticate, async (req, res) => {
  try {
    // Only admin can access trip analytics
    if (req.user.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const { from, to, status, serviceType } = req.query;

    const startDate = from ? new Date(from) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const endDate = to ? new Date(to) : new Date();

    const filters = {
      createdAt: { gte: startDate, lte: endDate }
    };

    if (status) filters.status = status;
    if (serviceType) filters.serviceType = serviceType;

    const tripAnalytics = await prisma.trip.groupBy({
      by: ['status'],
      where: filters,
      _count: true,
      _sum: { fare: true, distance: true },
      _avg: { fare: true, distance: true, rating: true }
    });

    const totalTrips = tripAnalytics.reduce((sum, stat) => sum + stat._count, 0);
    const totalRevenue = tripAnalytics.reduce((sum, stat) => sum + (stat._sum.fare || 0), 0);

    res.json({
      success: true,
      data: {
        totalTrips,
        totalRevenue,
        byStatus: tripAnalytics,
        period: { start: startDate, end: endDate }
      }
    });
  } catch (error) {
    logger.logWithContext('error', 'Error getting trip analytics', {
      correlationId: req.correlationId,
      error: error.message
    });
    res.status(500).json({ error: 'Failed to get trip analytics' });
  }
});

// Calculate surge pricing factor
async function calculateSurgeFactor(lat, lng) {
  // For now, return a simple calculation based on demand vs supply in the area
  // In a real system, this would use geohash-based clustering and more complex logic

  try {
    // Calculate bounding box for the area (approximately 5km radius)
    const latDelta = 0.045; // Approx 5km in latitude
    const lngDelta = 0.045; // Approx 5km in longitude

    // Count active riders in the area
    const activeRiders = await prisma.trip.count({
      where: {
        AND: [
          { status: { in: ['REQUESTED', 'ACCEPTED', 'ARRIVED'] } },
          { pickupLat: { gte: lat - latDelta, lte: lat + latDelta } },
          { pickupLng: { gte: lng - lngDelta, lte: lng + lngDelta } }
        ]
      }
    });

    // Count available drivers in the area
    const availableDrivers = await prisma.driver.count({
      where: {
        AND: [
          { status: 'AVAILABLE' },
          { currentLat: { gte: lat - latDelta, lte: lat + latDelta } },
          { currentLng: { gte: lng - lngDelta, lte: lng + lngDelta } },
          { lastActive: { gte: new Date(Date.now() - 10 * 60 * 1000) } } // Active in last 10 mins
        ]
      }
    });

    // Calculate demand/supply ratio
    const demandSupplyRatio = availableDrivers > 0 ? activeRiders / availableDrivers : activeRiders > 0 ? 10 : 1;

    // Define surge thresholds
    const baseSurge = 1.0;
    const surgeThreshold = 1.5; // When to start applying surge
    const maxSurge = 3.0; // Maximum surge multiplier

    let surgeMultiplier = baseSurge;

    if (demandSupplyRatio > surgeThreshold) {
      // Apply surge based on excess demand
      surgeMultiplier = Math.min(maxSurge, baseSurge + (demandSupplyRatio - surgeThreshold) * 0.5);
    }

    // Store surge data for analytics
    await prisma.surgePricing.upsert({
      where: {
        geohash_time: {
          geohash: `${lat.toFixed(3)}_${lng.toFixed(3)}`, // Simplified geohash
          time: new Date(new Date().setHours(0, 0, 0, 0)) // Today
        }
      },
      update: {
        demand: activeRiders,
        supply: availableDrivers,
        surgeMultiplier
      },
      create: {
        geohash: `${lat.toFixed(3)}_${lng.toFixed(3)}`, // Simplified geohash
        time: new Date(new Date().setHours(0, 0, 0, 0)), // Today
        demand: activeRiders,
        supply: availableDrivers,
        surgeMultiplier
      }
    });

    return {
      surgeMultiplier: Math.round(surgeMultiplier * 100) / 100,
      demand: activeRiders,
      supply: availableDrivers,
      demandSupplyRatio: Math.round(demandSupplyRatio * 100) / 100,
      location: { lat, lng }
    };
  } catch (error) {
    logger.logWithContext('error', 'Error calculating surge factor', {
      correlationId: 'analytics-surge',
      error: error.message,
      lat,
      lng
    });
    
    // Return default surge multiplier in case of error
    return {
      surgeMultiplier: 1.0,
      demand: 0,
      supply: 0,
      demandSupplyRatio: 0,
      location: { lat, lng }
    };
  }
}

// Get location-based analytics
async function getLocationAnalytics(geohash) {
  const [latRaw, lngRaw] = String(geohash).split('_');
  const lat = Number(latRaw);
  const lng = Number(lngRaw);

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    throw new Error('Invalid geohash format. Expected "lat_lng"');
  }

  const latDelta = 0.01;
  const lngDelta = 0.01;
  const trips = await prisma.trip.findMany({
    where: {
      pickupLat: { gte: lat - latDelta, lte: lat + latDelta },
      pickupLng: { gte: lng - lngDelta, lte: lng + lngDelta }
    },
    select: {
      fare: true,
      createdAt: true,
      pickupLat: true,
      pickupLng: true,
      dropLat: true,
      dropLng: true
    }
  });

  const totalTrips = trips.length;
  const revenue = trips.reduce((sum, trip) => sum + (trip.fare || 0), 0);
  const avgFare = totalTrips ? revenue / totalTrips : 0;

  const hourCounts = new Map();
  for (const trip of trips) {
    const hour = new Date(trip.createdAt).getHours();
    hourCounts.set(hour, (hourCounts.get(hour) || 0) + 1);
  }
  const peakHours = Array.from(hourCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([hour, count]) => ({ hour, trips: count }));

  const routeCounts = new Map();
  for (const trip of trips) {
    const routeKey = `${trip.pickupLat.toFixed(3)},${trip.pickupLng.toFixed(3)} -> ${trip.dropLat.toFixed(3)},${trip.dropLng.toFixed(3)}`;
    routeCounts.set(routeKey, (routeCounts.get(routeKey) || 0) + 1);
  }
  const popularRoutes = Array.from(routeCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([route, tripsCount]) => ({ route, trips: tripsCount }));

  return {
    geohash,
    totalTrips,
    revenue,
    avgFare,
    peakHours,
    popularRoutes
  };
}

// Get user analytics
async function getUserAnalytics(userId) {
  const [
    tripStats,
    paymentStats,
    ratingStats
  ] = await Promise.all([
    prisma.trip.aggregate({
      where: { riderId: userId },
      _count: true,
      _sum: { fare: true },
      _avg: { fare: true, rating: true }
    }),
    prisma.transaction.aggregate({
      where: { 
        userId,
        type: 'DEBIT'
      },
      _sum: { amount: true }
    }),
    prisma.trip.groupBy({
      by: ['rating'],
      where: { 
        riderId: userId,
        rating: { not: null }
      },
      _count: true
    })
  ]);

  return {
    userId,
    tripStats: {
      totalTrips: tripStats._count,
      totalSpent: tripStats._sum.fare || 0,
      avgFare: tripStats._avg.fare || 0,
      avgRating: tripStats._avg.rating || 0
    },
    paymentStats: {
      totalPaid: paymentStats._sum.amount || 0
    },
    ratingDistribution: ratingStats
  };
}

// Get driver analytics
async function getDriverAnalytics(driverId) {
  const [
    tripStats,
    earningStats,
    ratingStats
  ] = await Promise.all([
    prisma.trip.aggregate({
      where: { driverId },
      _count: true,
      _sum: { fare: true },
      _avg: { fare: true, rating: true }
    }),
    prisma.transaction.aggregate({
      where: { 
        userId: (await prisma.driver.findUnique({ where: { id: driverId } })).userId,
        type: 'CREDIT'
      },
      _sum: { amount: true }
    }),
    prisma.trip.groupBy({
      by: ['rating'],
      where: { 
        driverId,
        rating: { not: null }
      },
      _count: true
    })
  ]);

  return {
    driverId,
    tripStats: {
      totalTrips: tripStats._count,
      totalEarnings: tripStats._sum.fare ? tripStats._sum.fare * 0.8 : 0, // Assuming 20% platform cut
      avgFare: tripStats._avg.fare || 0,
      avgRating: tripStats._avg.rating || 0
    },
    earningStats: {
      totalEarned: earningStats._sum.amount || 0
    },
    ratingDistribution: ratingStats
  };
}

// Global error handler
app.use((err, req, res, next) => {
  logger.logWithContext('error', 'Analytics service error occurred', {
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

// Daily revenue report endpoint
app.get('/api/analytics/revenue/daily', authenticate, async (req, res) => {
  try {
    if (req.user.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const { from, to } = req.query;
    const startDate = from ? new Date(from) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const endDate = to ? new Date(to) : new Date();

    const dailyRevenue = await prisma.$queryRaw`
      SELECT 
        DATE(createdAt) as date,
        COUNT(*) as trips,
        SUM(fare) as totalRevenue,
        AVG(fare) as avgFare,
        COUNT(CASE WHEN status = 'COMPLETED' THEN 1 END) as completedTrips
      FROM Trip 
      WHERE createdAt BETWEEN ${startDate} AND ${endDate}
      GROUP BY DATE(createdAt)
      ORDER BY DATE(createdAt) DESC
    `;

    res.json({
      success: true,
      data: dailyRevenue
    });
  } catch (error) {
    logger.logWithContext('error', 'Error getting daily revenue report', {
      correlationId: req.correlationId,
      error: error.message
    });
    res.status(500).json({ error: 'Failed to get daily revenue report' });
  }
});

// Zone performance report endpoint
app.get('/api/analytics/zones', authenticate, async (req, res) => {
  try {
    if (req.user.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const { from, to } = req.query;
    const startDate = from ? new Date(from) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const endDate = to ? new Date(to) : new Date();

    // This would use geohash-based zone analysis in a real implementation
    // For now, we'll use pickup lat/lng as a simple zone indicator
    const zonePerformance = await prisma.$queryRaw`
      SELECT 
        CONCAT(FLOOR(pickupLat * 1000), '_', FLOOR(pickupLng * 1000)) as zone,
        COUNT(*) as trips,
        SUM(fare) as totalRevenue,
        AVG(fare) as avgFare,
        AVG(distance) as avgDistance,
        AVG(duration) as avgDuration
      FROM Trip 
      WHERE createdAt BETWEEN ${startDate} AND ${endDate}
      GROUP BY CONCAT(FLOOR(pickupLat * 1000), '_', FLOOR(pickupLng * 1000))
      ORDER BY totalRevenue DESC
      LIMIT 50
    `;

    res.json({
      success: true,
      data: zonePerformance
    });
  } catch (error) {
    logger.logWithContext('error', 'Error getting zone performance report', {
      correlationId: req.correlationId,
      error: error.message
    });
    res.status(500).json({ error: 'Failed to get zone performance report' });
  }
});

// Driver earnings report endpoint
app.get('/api/analytics/drivers', authenticate, async (req, res) => {
  try {
    if (req.user.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const { from, to, driverId } = req.query;
    const startDate = from ? new Date(from) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const endDate = to ? new Date(to) : new Date();

    const filters = {
      createdAt: { gte: startDate, lte: endDate },
      status: 'COMPLETED'
    };

    if (driverId) filters.driverId = driverId;

    const driverEarnings = await prisma.trip.groupBy({
      by: ['driverId'],
      where: filters,
      _count: true,
      _sum: { fare: true },
      _avg: { fare: true }
    });

    // Get driver details
    const driverIds = driverEarnings.map(de => de.driverId);
    const drivers = await prisma.driver.findMany({
      where: { id: { in: driverIds } },
      include: { user: true }
    });

    const detailedEarnings = driverEarnings.map(de => {
      const driver = drivers.find(d => d.id === de.driverId);
      return {
        driverId: de.driverId,
        driverName: driver?.user.name || 'Unknown',
        totalTrips: de._count,
        totalEarnings: de._sum.fare,
        avgEarningPerTrip: de._avg.fare,
        platformCommission: de._sum.fare * 0.2, // Assuming 20% platform cut
        driverEarnings: de._sum.fare * 0.8
      };
    });

    res.json({
      success: true,
      data: detailedEarnings
    });
  } catch (error) {
    logger.logWithContext('error', 'Error getting driver earnings report', {
      correlationId: req.correlationId,
      error: error.message
    });
    res.status(500).json({ error: 'Failed to get driver earnings report' });
  }
});

// Cancellation trends endpoint
app.get('/api/analytics/cancellations', authenticate, async (req, res) => {
  try {
    if (req.user.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const { from, to } = req.query;
    const startDate = from ? new Date(from) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const endDate = to ? new Date(to) : new Date();

    const cancellationTrends = await prisma.trip.groupBy({
      by: ['DATE(createdAt)', 'cancelledBy'],
      where: {
        createdAt: { gte: startDate, lte: endDate },
        status: 'CANCELLED'
      },
      _count: true
    });

    const cancellationStats = await prisma.trip.aggregate({
      where: {
        createdAt: { gte: startDate, lte: endDate }
      },
      _count: { _all: true },
      _sum: { status: { equals: 'CANCELLED' } }
    });

    const overallCancellationRate = (cancellationStats._sum.status / cancellationStats._count) * 100;

    res.json({
      success: true,
      data: {
        overallCancellationRate,
        trends: cancellationTrends
      }
    });
  } catch (error) {
    logger.logWithContext('error', 'Error getting cancellation trends', {
      correlationId: req.correlationId,
      error: error.message
    });
    res.status(500).json({ error: 'Failed to get cancellation trends' });
  }
});

// Surge analytics endpoint
app.get('/api/analytics/surge', authenticate, async (req, res) => {
  try {
    if (req.user.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const { from, to } = req.query;
    const startDate = from ? new Date(from) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const endDate = to ? new Date(to) : new Date();

    const surgeAnalytics = await prisma.surgePricing.groupBy({
      by: ['DATE(time)'],
      where: {
        time: { gte: startDate, lte: endDate }
      },
      _avg: { surgeMultiplier: true },
      _max: { surgeMultiplier: true },
      _min: { surgeMultiplier: true }
    });

    res.json({
      success: true,
      data: surgeAnalytics
    });
  } catch (error) {
    logger.logWithContext('error', 'Error getting surge analytics', {
      correlationId: req.correlationId,
      error: error.message
    });
    res.status(500).json({ error: 'Failed to get surge analytics' });
  }
});

// Fraud statistics endpoint
app.get('/api/analytics/fraud', authenticate, async (req, res) => {
  try {
    if (req.user.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const { from, to } = req.query;
    const startDate = from ? new Date(from) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const endDate = to ? new Date(to) : new Date();

    const fraudStats = await prisma.fraudEvent.groupBy({
      by: ['severity', 'type'],
      where: {
        createdAt: { gte: startDate, lte: endDate }
      },
      _count: true
    });

    const totalFraudEvents = await prisma.fraudEvent.count({
      where: {
        createdAt: { gte: startDate, lte: endDate }
      }
    });

    const fraudStatusBreakdown = await prisma.fraudEvent.groupBy({
      by: ['status'],
      where: {
        createdAt: { gte: startDate, lte: endDate }
      },
      _count: true
    });

    res.json({
      success: true,
      data: {
        totalFraudEvents,
        bySeverity: fraudStats,
        byStatus: fraudStatusBreakdown
      }
    });
  } catch (error) {
    logger.logWithContext('error', 'Error getting fraud statistics', {
      correlationId: req.correlationId,
      error: error.message
    });
    res.status(500).json({ error: 'Failed to get fraud statistics' });
  }
});

// Corporate usage report endpoint
app.get('/api/analytics/corporate', authenticate, async (req, res) => {
  try {
    if (req.user.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const { from, to, companyId } = req.query;
    const startDate = from ? new Date(from) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const endDate = to ? new Date(to) : new Date();

    const filters = {
      createdAt: { gte: startDate, lte: endDate },
      corporateInfo: { not: null }
    };

    if (companyId) {
      filters.corporateInfo = { path: ['companyId'], equals: companyId };
    }

    const corporateUsage = await prisma.trip.groupBy({
      by: ['corporateInfo->>companyId'],
      where: filters,
      _count: true,
      _sum: { fare: true }
    });

    // Get company details
    const companyIds = corporateUsage.map(cu => cu['corporateInfo->>companyId']);
    const companies = await prisma.company.findMany({
      where: { id: { in: companyIds } }
    });

    const detailedUsage = corporateUsage.map(cu => {
      const company = companies.find(c => c.id === cu['corporateInfo->>companyId']);
      return {
        companyId: cu['corporateInfo->>companyId'],
        companyName: company?.name || 'Unknown',
        totalTrips: cu._count,
        totalSpent: cu._sum.fare,
        avgSpentPerTrip: cu._sum.fare / cu._count
      };
    });

    res.json({
      success: true,
      data: detailedUsage
    });
  } catch (error) {
    logger.logWithContext('error', 'Error getting corporate usage report', {
      correlationId: req.correlationId,
      error: error.message
    });
    res.status(500).json({ error: 'Failed to get corporate usage report' });
  }
});

// Export analytics as CSV endpoint
app.get('/api/analytics/export/:reportType', authenticate, async (req, res) => {
  try {
    if (req.user.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const { reportType } = req.params;
    const { from, to } = req.query;
    
    const startDate = from ? new Date(from) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const endDate = to ? new Date(to) : new Date();
    
    let data;
    let filename;
    
    switch(reportType) {
      case 'trips':
        data = await prisma.trip.findMany({
          where: {
            createdAt: { gte: startDate, lte: endDate }
          },
          include: { rider: true, driver: { include: { user: true } } }
        });
        filename = `trips-${startDate.toISOString().split('T')[0]}-${endDate.toISOString().split('T')[0]}.csv`;
        break;
        
      case 'drivers':
        data = await prisma.trip.groupBy({
          by: ['driverId'],
          where: {
            createdAt: { gte: startDate, lte: endDate },
            status: 'COMPLETED'
          },
          _count: true,
          _sum: { fare: true }
        });
        filename = `driver-earnings-${startDate.toISOString().split('T')[0]}-${endDate.toISOString().split('T')[0]}.csv`;
        break;
        
      case 'revenue':
        data = await prisma.$queryRaw`
          SELECT 
            DATE(createdAt) as date,
            COUNT(*) as trips,
            SUM(fare) as totalRevenue,
            AVG(fare) as avgFare
          FROM Trip 
          WHERE createdAt BETWEEN ${startDate} AND ${endDate}
          GROUP BY DATE(createdAt)
          ORDER BY DATE(createdAt)
        `;
        filename = `daily-revenue-${startDate.toISOString().split('T')[0]}-${endDate.toISOString().split('T')[0]}.csv`;
        break;
        
      default:
        return res.status(400).json({ error: 'Invalid report type' });
    }
    
    // Convert to CSV format
    if (data.length === 0) {
      return res.status(404).json({ error: 'No data found for the specified period' });
    }
    
    // Create CSV header
    const headers = Object.keys(data[0]);
    const csvHeader = headers.join(',');
    
    // Create CSV rows
    const csvRows = data.map(row => {
      return headers.map(header => {
        let value = row[header];
        if (typeof value === 'object' && value !== null) {
          value = JSON.stringify(value);
        }
        // Escape commas and wrap in quotes if needed
        return typeof value === 'string' && value.includes(',') ? `"${value}"` : value;
      }).join(',');
    });
    
    const csvContent = [csvHeader, ...csvRows].join('\n');
    
    res.header('Content-Type', 'text/csv');
    res.header('Content-Disposition', `attachment; filename=${filename}`);
    res.send(csvContent);
  } catch (error) {
    logger.logWithContext('error', 'Error exporting analytics', {
      correlationId: req.correlationId,
      error: error.message
    });
    res.status(500).json({ error: 'Failed to export analytics' });
  }
});

// Start the server
const PORT = process.env.PORT || 5008;
app.listen(PORT, () => {
  logger.logWithContext('info', `Analytics service running`, {
    port: PORT,
    environment: config.environment,
    timestamp: new Date().toISOString()
  });
});

export default app;
