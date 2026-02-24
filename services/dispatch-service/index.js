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
const dispatchLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 50, // limit each IP to 50 requests per windowMs
  message: 'Too many dispatch requests, please try again later',
  standardHeaders: true,
  legacyHeaders: false,
});

// Add correlation ID middleware
app.use(addCorrelationId);

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'OK',
    service: 'Dispatch Service',
    timestamp: new Date().toISOString(),
    correlationId: req.correlationId
  });
});

// Metrics endpoint
app.get('/metrics', async (req, res) => {
  try {
    const [requestedTrips, acceptedTrips, completedTrips] = await Promise.all([
      prisma.trip.count({ where: { status: 'REQUESTED' } }),
      prisma.trip.count({ where: { status: 'ACCEPTED' } }),
      prisma.trip.count({ where: { status: 'COMPLETED' } })
    ]);

    res.status(200).json({
      status: 'OK',
      service: 'Dispatch Service',
      metrics: {
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        requestedTrips,
        acceptedTrips,
        completedTrips,
        timestamp: new Date().toISOString()
      },
      correlationId: req.correlationId
    });
  } catch (error) {
    logger.logWithContext('error', 'Failed to build dispatch metrics', {
      correlationId: req.correlationId,
      error: error.message
    });

    res.status(500).json({
      error: 'Failed to build metrics',
      correlationId: req.correlationId
    });
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
      logger.logWithContext('error', 'Dispatch service not ready', {
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

// Find and offer drivers endpoint
app.post('/api/dispatch/find-and-offer-drivers', authenticate, dispatchLimiter, async (req, res) => {
  try {
    const { tripId, pickupLat, pickupLng, serviceType = 'city' } = req.body;

    if (!tripId || !pickupLat || !pickupLng) {
      return res.status(400).json({ error: 'Trip ID and pickup coordinates required' });
    }

    // Get trip details
    const trip = await prisma.trip.findUnique({
      where: { id: tripId },
      include: { rider: true }
    });

    if (!trip) {
      return res.status(404).json({ error: 'Trip not found' });
    }

    if (trip.status !== 'REQUESTED') {
      // Keep dispatch endpoint idempotent for integration flows where the trip
      // may already be assigned or progressed by the time this endpoint is called.
      return res.json({
        success: true,
        message: `Trip is already in ${trip.status} state`,
        data: {
          tripId,
          tripStatus: trip.status,
          accepted: trip.status === 'ACCEPTED'
        }
      });
    }

    // Find nearby available drivers
    const nearbyDrivers = await findNearbyAvailableDrivers(
      pickupLat,
      pickupLng,
      serviceType,
      req.correlationId
    );

    if (nearbyDrivers.length === 0) {
      logger.logWithContext('info', 'No available drivers found for trip', {
        correlationId: req.correlationId,
        tripId,
        pickupLat,
        pickupLng
      });

      // Notify rider about no drivers available
      try {
        await axios.post(`${config.services.notificationServiceUrl}/api/notifications/send`, {
          recipient: trip.riderId,
          type: 'NO_DRIVERS_AVAILABLE',
          message: 'No drivers available in your area. Please try again later.',
          tripId: trip.id
        }, {
          headers: {
            'Authorization': req.headers.authorization,
            'X-Correlation-ID': req.correlationId
          }
        });
      } catch (notificationError) {
        logger.logWithContext('warn', 'Failed to send no drivers available notification', {
          correlationId: req.correlationId,
          tripId,
          error: notificationError.message
        });
      }

      return res.json({
        success: true,
        message: 'No drivers available',
        data: {
          tripId,
          availableDrivers: 0,
          accepted: false,
          offerResults: []
        }
      });
    }

    // Score and rank drivers
    const scoredDrivers = await scoreDrivers(nearbyDrivers, trip, pickupLat, pickupLng, req.correlationId);

    // Send offers to top drivers (first 3)
    const topDrivers = scoredDrivers.slice(0, 3);
    const offerResults = [];
    for (const driver of topDrivers) {
      const offerResult = await sendDriverOffer(driver, trip, {
        authorization: req.headers.authorization,
        correlationId: req.correlationId
      });
      offerResults.push(offerResult);
    }

    const acceptedOffer = offerResults.find(result => result.accepted);
    if (acceptedOffer) {
      await prisma.trip.update({
        where: { id: tripId },
        data: {
          driverId: acceptedOffer.driverId,
          status: 'ACCEPTED'
        }
      });
    }

    logger.logWithContext('info', 'Dispatch process completed', {
      correlationId: req.correlationId,
      tripId,
      driversConsidered: nearbyDrivers.length,
      offersSent: topDrivers.length,
      accepted: offerResults.some(r => r.accepted)
    });

    res.json({
      success: true,
      data: {
        tripId,
        driversConsidered: nearbyDrivers.length,
        offersSent: topDrivers.length,
        accepted: offerResults.some(r => r.accepted),
        offerResults
      }
    });
  } catch (error) {
    logger.logWithContext('error', 'Error in dispatch process', {
      correlationId: req.correlationId,
      error: error.message
    });
    res.status(500).json({ error: 'Failed to dispatch trip' });
  }
});

// Manual dispatch endpoint (for admin use)
app.post('/api/dispatch/manual', authenticate, async (req, res) => {
  try {
    // Only admin can use manual dispatch
    if (req.user.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const { tripId, driverId } = req.body;

    if (!tripId || !driverId) {
      return res.status(400).json({ error: 'Trip ID and Driver ID required' });
    }

    // Verify trip is in REQUESTED state
    const trip = await prisma.trip.findUnique({
      where: { id: tripId }
    });

    if (!trip || trip.status !== 'REQUESTED') {
      return res.status(400).json({ error: 'Trip not found or not in requested state' });
    }

    // Verify driver is available
    const driver = await prisma.driver.findUnique({
      where: { id: driverId }
    });

    if (!driver || driver.status !== 'ONLINE') {
      return res.status(400).json({ error: 'Driver not found or not available' });
    }

    // Assign trip to driver
    const updatedTrip = await prisma.trip.update({
      where: { id: tripId },
      data: {
        driverId,
        status: 'ACCEPTED'
      },
      include: { rider: true, driver: { include: { user: true } } }
    });

    // Send notification to driver
    try {
      await axios.post(`${config.services.notificationServiceUrl}/api/notifications/send`, {
        recipient: driver.userId,
        type: 'MANUAL_ASSIGNMENT',
        message: `Trip manually assigned to you by admin. Pickup: ${updatedTrip.pickupLat}, ${updatedTrip.pickupLng}`,
        tripId: updatedTrip.id
      }, {
        headers: {
          'Authorization': req.headers.authorization,
          'X-Correlation-ID': req.correlationId
        }
      });
    } catch (notificationError) {
      logger.logWithContext('warn', 'Failed to send manual assignment notification', {
        correlationId: req.correlationId,
        tripId,
        driverId,
        error: notificationError.message
      });
    }

    logger.logWithContext('info', 'Manual dispatch completed', {
      correlationId: req.correlationId,
      tripId,
      driverId,
      assignedBy: req.user.id
    });

    res.json({
      success: true,
      data: updatedTrip
    });
  } catch (error) {
    logger.logWithContext('error', 'Error in manual dispatch', {
      correlationId: req.correlationId,
      error: error.message
    });
    res.status(500).json({ error: 'Failed to manually dispatch trip' });
  }
});

// Driver pending offers endpoint
app.get('/api/dispatch/offers', authenticate, async (req, res) => {
  try {
    if (req.user.role !== 'DRIVER') {
      return res.status(403).json({ error: 'Driver access required' });
    }

    const driver = await prisma.driver.findUnique({
      where: { userId: req.user.id }
    });

    if (!driver) {
      return res.status(404).json({ error: 'Driver profile not found' });
    }

    const offers = await prisma.rideNotification.findMany({
      where: {
        driverId: driver.id,
        status: { in: ['PENDING', 'SENT'] }
      },
      include: {
        trip: {
          include: { rider: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    res.json({
      success: true,
      data: offers
    });
  } catch (error) {
    logger.logWithContext('error', 'Error getting driver offers', {
      correlationId: req.correlationId,
      error: error.message,
      userId: req.user?.id
    });
    res.status(500).json({ error: 'Failed to get driver offers' });
  }
});

// Driver offer response endpoint
app.post('/api/dispatch/offers/:offerId/respond', authenticate, async (req, res) => {
  try {
    if (req.user.role !== 'DRIVER') {
      return res.status(403).json({ error: 'Driver access required' });
    }

    const { offerId } = req.params;
    const { response } = req.body;
    if (!['ACCEPT', 'REJECT'].includes(response)) {
      return res.status(400).json({ error: 'Response must be ACCEPT or REJECT' });
    }

    const driver = await prisma.driver.findUnique({
      where: { userId: req.user.id }
    });

    if (!driver) {
      return res.status(404).json({ error: 'Driver profile not found' });
    }

    const offer = await prisma.rideNotification.findUnique({
      where: { id: offerId },
      include: { trip: true }
    });

    if (!offer || offer.driverId !== driver.id) {
      return res.status(404).json({ error: 'Offer not found' });
    }

    if (response === 'REJECT') {
      const rejected = await prisma.rideNotification.update({
        where: { id: offer.id },
        data: {
          status: 'FAILED',
          error: 'REJECTED_BY_DRIVER'
        }
      });

      return res.json({
        success: true,
        data: {
          offerId: rejected.id,
          tripId: rejected.tripId,
          accepted: false
        }
      });
    }

    const assignmentResult = await prisma.$transaction(async (tx) => {
      const freshTrip = await tx.trip.findUnique({
        where: { id: offer.tripId }
      });

      if (!freshTrip || freshTrip.status !== 'REQUESTED') {
        await tx.rideNotification.update({
          where: { id: offer.id },
          data: {
            status: 'FAILED',
            error: 'TRIP_NO_LONGER_AVAILABLE'
          }
        });

        return {
          assigned: false,
          reason: 'Trip is no longer available'
        };
      }

      await tx.trip.update({
        where: { id: freshTrip.id },
        data: {
          driverId: driver.id,
          status: 'ACCEPTED'
        }
      });

      await tx.driver.update({
        where: { id: driver.id },
        data: { status: 'BUSY' }
      });

      await tx.rideNotification.update({
        where: { id: offer.id },
        data: {
          status: 'SENT',
          error: 'ACCEPTED_BY_DRIVER'
        }
      });

      await tx.rideNotification.updateMany({
        where: {
          tripId: offer.tripId,
          driverId: { not: driver.id },
          status: { in: ['PENDING', 'SENT'] }
        },
        data: {
          status: 'FAILED',
          error: 'CANCELLED_OTHER_DRIVER_ACCEPTED'
        }
      });

      return {
        assigned: true
      };
    });

    if (!assignmentResult.assigned) {
      return res.status(409).json({
        error: assignmentResult.reason
      });
    }

    res.json({
      success: true,
      data: {
        offerId: offer.id,
        tripId: offer.tripId,
        accepted: true,
        driverId: driver.id
      }
    });
  } catch (error) {
    logger.logWithContext('error', 'Error responding to offer', {
      correlationId: req.correlationId,
      error: error.message,
      offerId: req.params.offerId
    });
    res.status(500).json({ error: 'Failed to respond to offer' });
  }
});

// Get dispatch queue endpoint
app.get('/api/dispatch/queue', authenticate, async (req, res) => {
  try {
    // Only admin can view dispatch queue
    if (req.user.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const queuedTrips = await prisma.trip.findMany({
      where: {
        status: 'REQUESTED'
      },
      include: { rider: true },
      orderBy: { createdAt: 'asc' }
    });

    res.json({
      success: true,
      data: {
        queueSize: queuedTrips.length,
        trips: queuedTrips
      }
    });
  } catch (error) {
    logger.logWithContext('error', 'Error getting dispatch queue', {
      correlationId: req.correlationId,
      error: error.message
    });
    res.status(500).json({ error: 'Failed to get dispatch queue' });
  }
});

// Helper function to find nearby available drivers
async function findNearbyAvailableDrivers(lat, lng, serviceType, correlationId = 'dispatch-find-drivers') {
  try {
    // Calculate bounding box (approximately 5km radius)
    const latDelta = 0.045; // Approx 5km in latitude
    const lngDelta = 0.045; // Approx 5km in longitude
    const latNum = parseFloat(lat);
    const lngNum = parseFloat(lng);

    const drivers = await prisma.driver.findMany({
      where: {
        status: 'ONLINE',
        location: {
          is: {
            lat: { gte: latNum - latDelta, lte: latNum + latDelta },
            lng: { gte: lngNum - lngDelta, lte: lngNum + lngDelta }
          }
        }
      },
      include: {
        user: true,
        location: true
      }
    });

    // Filter by actual distance (more accurate than bounding box)
    const filteredDrivers = [];
    for (const driver of drivers) {
      const distance = calculateDistance(
        latNum,
        lngNum,
        driver.location?.lat,
        driver.location?.lng
      );

      if (distance <= 5000) { // Within 5km
        filteredDrivers.push({
          ...driver,
          distance
        });
      }
    }

    return filteredDrivers.sort((a, b) => a.distance - b.distance);
  } catch (error) {
    logger.logWithContext('error', 'Error finding nearby drivers', {
      correlationId,
      error: error.message,
      lat,
      lng
    });
    return [];
  }
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

// Helper function to score drivers
async function scoreDrivers(drivers, trip, pickupLat, pickupLng, correlationId = 'dispatch-score') {
  const scoredDrivers = [];

  for (const driver of drivers) {
    let score = 0;

    // Distance factor (closer is better)
    const distanceFactor = Math.max(0, 100 - (driver.distance / 100)); // Up to 100 points for distance
    
    // Rating factor (higher rating is better)
    const ratingFactor = (driver.rating || 4.5) * 10; // Up to 50 points for rating
    
    // Acceptance rate factor
    const acceptanceRate = await getDriverAcceptanceRate(driver.id, correlationId);
    const acceptanceFactor = acceptanceRate * 30; // Up to 30 points for acceptance rate
    
    // Online time factor (prefer recently active drivers)
    const onlineDuration = Date.now() - new Date(driver.updatedAt).getTime();
    const onlineFactor = Math.min(20, onlineDuration / (1000 * 60 * 30)); // Up to 20 points for being online 30+ mins

    score = distanceFactor * 0.4 + ratingFactor * 0.3 + acceptanceFactor * 0.2 + onlineFactor * 0.1;

    scoredDrivers.push({
      ...driver,
      score: Math.round(score * 100) / 100
    });
  }

  return scoredDrivers.sort((a, b) => b.score - a.score);
}

// Helper function to get driver acceptance rate
async function getDriverAcceptanceRate(driverId, correlationId = 'dispatch-driver-stats') {
  try {
    const [totalTrips, acceptedTrips] = await Promise.all([
      prisma.trip.count({
        where: { driverId }
      }),
      prisma.trip.count({
        where: {
          driverId,
          status: {
            in: ['ACCEPTED', 'ARRIVED', 'IN_PROGRESS', 'COMPLETED']
          }
        }
      })
    ]);

    if (!totalTrips) return 0.8; // Default to 80% if no history
    return acceptedTrips / totalTrips;
  } catch (error) {
    logger.logWithContext('warn', 'Error getting driver acceptance rate', {
      correlationId,
      error: error.message,
      driverId
    });
    return 0.8; // Default to 80%
  }
}

// Helper function to send offer to driver
async function sendDriverOffer(driver, trip, { authorization, correlationId } = {}) {
  let offerRecord;
  try {
    offerRecord = await prisma.rideNotification.create({
      data: {
        tripId: trip.id,
        driverId: driver.id,
        status: 'PENDING',
        retries: 0
      }
    });

    await axios.post(`${config.services.notificationServiceUrl}/api/notifications/send`, {
      recipient: driver.userId,
      type: 'TRIP_OFFER',
      message: `New trip offer: From ${trip.pickupLat},${trip.pickupLng} to ${trip.dropLat},${trip.dropLng}. Fare: $${trip.fare}. Accept within 30 seconds.`,
      tripId: trip.id,
      priority: 'HIGH'
    }, {
      headers: {
        'Authorization': authorization,
        'X-Correlation-ID': correlationId || 'dispatch-offer'
      }
    });

    await prisma.rideNotification.update({
      where: { id: offerRecord.id },
      data: {
        status: 'SENT',
        sentAt: new Date(),
        error: null
      }
    });

    return {
      offerId: offerRecord.id,
      driverId: driver.id,
      accepted: false,
      score: driver.score,
      response: 'PENDING_DRIVER_RESPONSE'
    };
  } catch (error) {
    if (offerRecord?.id) {
      await prisma.rideNotification.update({
        where: { id: offerRecord.id },
        data: {
          status: 'FAILED',
          error: error.message
        }
      }).catch(() => null);
    }

    logger.logWithContext('error', 'Error sending driver offer', {
      correlationId: correlationId || 'dispatch-offer',
      error: error.message,
      driverId: driver.id,
      tripId: trip.id
    });
    
    return {
      offerId: offerRecord?.id,
      driverId: driver.id,
      accepted: false,
      score: driver.score,
      response: 'FAILED',
      error: error.message
    };
  }
}

// Helper function to cancel pending offers
async function cancelPendingOffers(drivers, tripId, { authorization, correlationId } = {}) {
  try {
    for (const driver of drivers) {
      await prisma.rideNotification.updateMany({
        where: {
          tripId,
          driverId: driver.id,
          status: { in: ['PENDING', 'SENT'] }
        },
        data: {
          status: 'FAILED',
          error: 'CANCELLED'
        }
      });

      await axios.post(`${config.services.notificationServiceUrl}/api/notifications/send`, {
        recipient: driver.userId,
        type: 'OFFER_CANCELLED',
        message: `Trip offer cancelled. Another driver has accepted the trip.`,
        tripId: tripId
      }, {
        headers: {
          'Authorization': authorization,
          'X-Correlation-ID': correlationId || 'dispatch-cancel-offer'
        }
      });
    }
  } catch (error) {
    logger.logWithContext('warn', 'Error cancelling pending offers', {
      correlationId: correlationId || 'dispatch-cancel-offer',
      error: error.message,
      tripId
    });
  }
}

// Global error handler
app.use((err, req, res, next) => {
  logger.logWithContext('error', 'Dispatch service error occurred', {
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
const PORT = process.env.PORT || 5004;
app.listen(PORT, () => {
  logger.logWithContext('info', `Dispatch service running`, {
    port: PORT,
    environment: config.environment,
    timestamp: new Date().toISOString()
  });
});

export default app;
