import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import axios from 'axios';
import { PrismaClient } from '@prisma/client';
import { config } from '@shared/config';
import { logger, addCorrelationId } from '@shared/logger';
import { authenticate, requireRider, requireDriver } from '@shared/auth';

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
const rideLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20, // limit each IP to 20 requests per windowMs
  message: 'Too many ride requests, please try again later',
  standardHeaders: true,
  legacyHeaders: false,
});

// Add correlation ID middleware
app.use(addCorrelationId);

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'OK',
    service: 'Ride Service',
    timestamp: new Date().toISOString(),
    correlationId: req.correlationId
  });
});

// Metrics endpoint
app.get('/metrics', (req, res) => {
  res.status(200).json({
    status: 'OK',
    service: 'Ride Service',
    metrics: {
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      activeRides: 0, // Placeholder
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
      logger.logWithContext('error', 'Ride service not ready', {
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

// Create trip endpoint
app.post('/api/', authenticate, requireRider, rideLimiter, async (req, res) => {
  try {
    const { pickupLat, pickupLng, dropLat, dropLng, fare, distance, duration, serviceType, stops, metadata, scheduledTime } = req.body;

    // Validate inputs
    if (!pickupLat || !pickupLng || !dropLat || !dropLng || !fare) {
      return res.status(400).json({ error: 'Required fields missing' });
    }

    // Validate service type
    const validServiceTypes = ['TAXI', 'FOOD', 'PACKAGE', 'CARPOOL'];
    if (serviceType && !validServiceTypes.includes(serviceType)) {
      return res.status(400).json({ error: 'Invalid service type' });
    }

    // Check corporate policy if user belongs to a company
    let companyAccess = null;
    if (prisma.userCompanyAccess?.findFirst) {
      companyAccess = await prisma.userCompanyAccess.findFirst({
        where: { userId: req.user.id },
        include: { policy: true }
      });
    }

    if (companyAccess && companyAccess.policy) {
      const policy = companyAccess.policy;
      
      // Check max fare per ride
      if (policy.maxFarePerRide && fare > policy.maxFarePerRide) {
        return res.status(400).json({ error: `Fare exceeds company policy limit of $${policy.maxFarePerRide}` });
      }
      
      // Check allowed vehicle types
      if (policy.allowedVehicleTypes && !policy.allowedVehicleTypes.includes(serviceType.toLowerCase())) {
        return res.status(400).json({ error: 'Service type not allowed by company policy' });
      }
      
      // Check time restrictions
      if (policy.timeRestrictions) {
        const now = new Date();
        const hour = now.getHours();
        
        // Simple check for time restrictions
        if (policy.timeRestrictions.disallowedHours && 
            policy.timeRestrictions.disallowedHours.includes(hour)) {
          return res.status(400).json({ error: 'Ride not allowed at this time by company policy' });
        }
      }
    }

    // Calculate surge pricing
    const surgeMultiplier = await calculateSurgeMultiplier(pickupLat, pickupLng, req.correlationId);
    const adjustedFare = fare * surgeMultiplier;

    // Create trip record
    const trip = await prisma.trip.create({
      data: {
        riderId: req.user.id,
        pickupLat,
        pickupLng,
        dropLat,
        dropLng,
        fare: adjustedFare,
        distance,
        duration,
        serviceType: serviceType || 'TAXI',
        status: 'REQUESTED'
      },
      include: { rider: true }
    });

    // If trip is scheduled, don't dispatch immediately
    if (!scheduledTime) {
      // Notify dispatch service to find a driver
      try {
        await axios.post(`${config.services.dispatchServiceUrl}/api/dispatch/find-and-offer-drivers`, {
          tripId: trip.id,
          pickupLat,
          pickupLng,
          serviceType: serviceType || 'TAXI'
        }, {
          headers: {
            'Authorization': req.headers.authorization,
            'X-Correlation-ID': req.correlationId
          }
        });
      } catch (dispatchError) {
        logger.logWithContext('error', 'Failed to dispatch trip', {
          correlationId: req.correlationId,
          tripId: trip.id,
          error: dispatchError.message
        });
      }
    }

    logger.logWithContext('info', 'Trip created successfully', {
      correlationId: req.correlationId,
      tripId: trip.id,
      riderId: req.user.id,
      fare: adjustedFare,
      surgeMultiplier,
      serviceType: serviceType || 'TAXI'
    });

    res.status(201).json({
      success: true,
      data: trip
    });
  } catch (error) {
    logger.logWithContext('error', 'Error creating trip', {
      correlationId: req.correlationId,
      error: error.message
    });
    res.status(500).json({ error: 'Failed to create trip' });
  }
});

// Accept trip endpoint
app.post('/api/:tripId/accept', authenticate, requireDriver, async (req, res) => {
  try {
    const { tripId } = req.params;

    // Verify driver exists
    const driver = await prisma.driver.findUnique({
      where: { userId: req.user.id }
    });

    if (!driver) {
      return res.status(404).json({ error: 'Driver not found' });
    }

    // Try to accept the trip (using updateMany to ensure atomicity)
    const result = await prisma.trip.updateMany({
      where: {
        id: tripId,
        status: 'REQUESTED'
      },
      data: {
        driverId: driver.id,
        status: 'ACCEPTED'
      }
    });

    if (result.count === 0) {
      return res.status(400).json({ error: 'Trip already accepted or not in requested state' });
    }

    // Get the updated trip
    const trip = await prisma.trip.findUnique({
      where: { id: tripId },
      include: { rider: true, driver: { include: { user: true } } }
    });

    // Notify rider about driver acceptance
    try {
      await axios.post(`${config.services.notificationServiceUrl}/api/notifications/send`, {
        recipient: trip.riderId,
        type: 'TRIP_ACCEPTED',
        message: `Your trip has been accepted by driver ${driver.id}`,
        tripId: trip.id
      }, {
        headers: {
          'Authorization': req.headers.authorization,
          'X-Correlation-ID': req.correlationId
        }
      });
    } catch (notificationError) {
      logger.logWithContext('warn', 'Failed to send trip accepted notification', {
        correlationId: req.correlationId,
        tripId,
        error: notificationError.message
      });
    }

    logger.logWithContext('info', 'Trip accepted successfully', {
      correlationId: req.correlationId,
      tripId,
      driverId: driver.id
    });

    res.json({
      success: true,
      data: trip
    });
  } catch (error) {
    logger.logWithContext('error', 'Error accepting trip', {
      correlationId: req.correlationId,
      error: error.message
    });
    res.status(500).json({ error: 'Failed to accept trip' });
  }
});

// Update trip status endpoint
app.patch('/api/:tripId/status', authenticate, async (req, res) => {
  try {
    const { tripId } = req.params;
    const { status } = req.body;

    // Verify user has permission to update this trip
    const trip = await prisma.trip.findUnique({
      where: { id: tripId }
    });

    if (!trip) {
      return res.status(404).json({ error: 'Trip not found' });
    }

    // Check permissions: rider can only update their own trips, driver can update assigned trips
    if (req.user.role === 'RIDER') {
      if (trip.riderId !== req.user.id) {
        return res.status(403).json({ error: 'Forbidden: Not your trip' });
      }
    } else if (req.user.role === 'DRIVER') {
      const driver = await prisma.driver.findUnique({
        where: { userId: req.user.id }
      });

      if (!driver || trip.driverId !== driver.id) {
        return res.status(403).json({ error: 'Forbidden: Not your assigned trip' });
      }
    }

    // Validate status transition
    const allowedTransitions = {
      'REQUESTED': ['ACCEPTED', 'CANCELLED'],
      'ACCEPTED': ['ARRIVED', 'CANCELLED'],
      'ARRIVED': ['IN_PROGRESS', 'CANCELLED'],
      'IN_PROGRESS': ['COMPLETED', 'CANCELLED'],
      'COMPLETED': [],
      'CANCELLED': []
    };

    if (!allowedTransitions[trip.status]?.includes(status)) {
      return res.status(400).json({ error: `Invalid status transition: ${trip.status} -> ${status}` });
    }

    // Update trip status
    const updatedTrip = await prisma.trip.update({
      where: { id: tripId },
      data: { status },
      include: { rider: true, driver: { include: { user: true } } }
    });

    logger.logWithContext('info', 'Trip status updated', {
      correlationId: req.correlationId,
      tripId,
      oldStatus: trip.status,
      newStatus: status,
      updatedBy: req.user.id
    });

    res.json({
      success: true,
      data: updatedTrip
    });
  } catch (error) {
    logger.logWithContext('error', 'Error updating trip status', {
      correlationId: req.correlationId,
      error: error.message
    });
    res.status(500).json({ error: 'Failed to update trip status' });
  }
});

// Get trip by ID endpoint
app.get('/api/:tripId', authenticate, async (req, res) => {
  try {
    const { tripId } = req.params;

    const trip = await prisma.trip.findUnique({
      where: { id: tripId },
      include: { rider: true, driver: { include: { user: true } } }
    });

    if (!trip) {
      return res.status(404).json({ error: 'Trip not found' });
    }

    // Check permissions
    if (req.user.role !== 'ADMIN') {
      const isRider = trip.riderId === req.user.id;
      const isDriver = trip.driverId && trip.driver.userId === req.user.id;
      if (!isRider && !isDriver) {
        return res.status(403).json({ error: 'Forbidden: Not your trip' });
      }
    }

    res.json({
      success: true,
      data: trip
    });
  } catch (error) {
    logger.logWithContext('error', 'Error getting trip', {
      correlationId: req.correlationId,
      error: error.message
    });
    res.status(500).json({ error: 'Failed to get trip' });
  }
});

// Get user trips endpoint
app.get('/api/', authenticate, async (req, res) => {
  try {
    let trips;

    if (req.user.role === 'RIDER') {
      trips = await prisma.trip.findMany({
        where: { riderId: req.user.id },
        orderBy: { createdAt: 'desc' },
        include: { driver: { include: { user: true } } }
      });
    } else if (req.user.role === 'DRIVER') {
      const driver = await prisma.driver.findUnique({ where: { userId: req.user.id } });
      if (!driver) {
        return res.status(404).json({ error: 'Driver not found' });
      }
      
      trips = await prisma.trip.findMany({
        where: { driverId: driver.id },
        orderBy: { createdAt: 'desc' },
        include: { rider: true }
      });
    } else {
      // Admin can see all trips
      trips = await prisma.trip.findMany({
        orderBy: { createdAt: 'desc' },
        include: { rider: true, driver: { include: { user: true } } }
      });
    }

    res.json({
      success: true,
      data: trips
    });
  } catch (error) {
    logger.logWithContext('error', 'Error getting user trips', {
      correlationId: req.correlationId,
      error: error.message
    });
    res.status(500).json({ error: 'Failed to get trips' });
  }
});

// Trigger SOS endpoint
app.post('/api/:tripId/sos', authenticate, async (req, res) => {
  try {
    const { tripId } = req.params;

    const trip = await prisma.trip.findUnique({
      where: { id: tripId },
      include: { rider: true, driver: { include: { user: true } } }
    });

    if (!trip) {
      return res.status(404).json({ error: 'Trip not found' });
    }

    if (trip.riderId !== req.user.id && trip.driver?.userId !== req.user.id) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    // Log SOS event
    await prisma.auditLog.create({
      data: {
        userId: req.user.id,
        action: 'SOS_TRIGGERED',
        details: JSON.stringify({
          tripId,
          riderId: trip.riderId,
          driverId: trip.driverId,
          location: { lat: trip.pickupLat, lng: trip.pickupLng },
          status: trip.status
        }),
        ipAddress: req.ip,
        userAgent: req.get('user-agent')
      }
    });

    // Send WhatsApp alert to admin
    if (config.whatsapp.accessToken) {
      try {
        const admin = await prisma.user.findFirst({ where: { role: 'ADMIN' } });
        if (admin?.phone) {
          const message = `🚨 EMERGENCY SOS ALERT

Trip ID: ${tripId}
Rider: ${trip.rider.name} (${trip.rider.phone})
Driver: ${trip.driver?.user.name || 'N/A'} (${trip.driver?.user.phone || 'N/A'})
Status: ${trip.status}
Location: ${trip.pickupLat}, ${trip.pickupLng}

Immediate action required!`;
          
          await axios.post(
            `https://graph.facebook.com/v18.0/${config.whatsapp.phoneNumberId}/messages`,
            {
              messaging_product: 'whatsapp',
              to: admin.phone,
              type: 'text',
              text: { body: message }
            },
            {
              headers: {
                Authorization: `Bearer ${config.whatsapp.accessToken}`,
                'Content-Type': 'application/json',
              },
              timeout: 10000,
            }
          );
        }
      } catch (whatsappError) {
        logger.logWithContext('error', 'Failed to send SOS WhatsApp alert', {
          correlationId: req.correlationId,
          error: whatsappError.message
        });
      }
    }

    // Notify fraud service
    try {
      await axios.post(`${config.services.fraudServiceUrl}/api/fraud/sos-triggered`, {
        tripId,
        userId: req.user.id,
        location: { lat: trip.pickupLat, lng: trip.pickupLng }
      }, {
        headers: {
          'Authorization': req.headers.authorization,
          'X-Correlation-ID': req.correlationId
        }
      });
    } catch (fraudError) {
      logger.logWithContext('warn', 'Failed to notify fraud service of SOS', {
        correlationId: req.correlationId,
        error: fraudError.message
      });
    }

    logger.logWithContext('warn', 'SOS triggered', {
      correlationId: req.correlationId,
      tripId,
      userId: req.user.id
    });

    res.json({
      success: true,
      data: { message: 'Emergency alert sent', tripId }
    });
  } catch (error) {
    logger.logWithContext('error', 'Error triggering SOS', {
      correlationId: req.correlationId,
      error: error.message
    });
    res.status(500).json({ error: 'Failed to trigger SOS' });
  }
});

// Mark payment collected endpoint
app.post('/api/:tripId/payment-collected', authenticate, requireDriver, async (req, res) => {
  try {
    const { tripId } = req.params;
    const { paymentMethod = 'CASH' } = req.body;

    const trip = await prisma.trip.findUnique({ where: { id: tripId } });
    if (!trip) {
      return res.status(404).json({ error: 'Trip not found' });
    }

    if (trip.status !== 'COMPLETED') {
      return res.status(400).json({ error: 'Trip not completed' });
    }

    const updatedTrip = await prisma.trip.update({
      where: { id: tripId },
      data: {
        paymentMethod,
        paymentStatus: paymentMethod === 'CASH' ? 'CASH_COLLECTED' : 'PAID'
      }
    });

    logger.logWithContext('info', 'Payment collected marked', {
      correlationId: req.correlationId,
      tripId,
      paymentMethod,
      driverId: req.user.id
    });

    res.json({
      success: true,
      data: updatedTrip
    });
  } catch (error) {
    logger.logWithContext('error', 'Error marking payment collected', {
      correlationId: req.correlationId,
      error: error.message
    });
    res.status(500).json({ error: 'Failed to mark payment collected' });
  }
});

// Settle trip endpoint
app.post('/api/:tripId/settle', authenticate, async (req, res) => {
  try {
    const { tripId } = req.params;

    const trip = await prisma.trip.findUnique({ where: { id: tripId } });
    if (!trip) {
      return res.status(404).json({ error: 'Trip not found' });
    }

    if (trip.status !== 'COMPLETED') {
      return res.status(400).json({ error: 'Trip must be completed before settlement' });
    }

    // Only admin or assigned driver can settle
    if (req.user.role !== 'ADMIN') {
      const driver = await prisma.driver.findFirst({
        where: { id: trip.driverId, userId: req.user.id }
      });
      if (!driver) {
        return res.status(403).json({ error: 'Only assigned driver or admin can settle trip' });
      }
    }

    // Update payment status
    const settledTrip = await prisma.trip.update({
      where: { id: tripId },
      data: { paymentStatus: trip.paymentMethod === 'CASH' ? 'CASH_COLLECTED' : 'PAID' }
    });

    // If payment method is wallet, process the payment
    if (trip.paymentMethod === 'WALLET') {
      try {
        await axios.post(`${config.services.walletServiceUrl}/api/wallet/process-trip-payment`, {
          tripId: trip.id,
          riderId: trip.riderId,
          amount: trip.fare
        }, {
          headers: {
            'Authorization': req.headers.authorization,
            'X-Correlation-ID': req.correlationId
          }
        });
      } catch (walletError) {
        logger.logWithContext('error', 'Failed to process wallet payment', {
          correlationId: req.correlationId,
          tripId,
          error: walletError.message
        });
      }
    }

    logger.logWithContext('info', 'Trip settled', {
      correlationId: req.correlationId,
      tripId,
      settledBy: req.user.id
    });

    res.json({
      success: true,
      data: settledTrip
    });
  } catch (error) {
    logger.logWithContext('error', 'Error settling trip', {
      correlationId: req.correlationId,
      error: error.message
    });
    res.status(500).json({ error: 'Failed to settle trip' });
  }
});

// Helper function to calculate surge pricing
async function calculateSurgeMultiplier(lat, lng, correlationId) {
  try {
    const response = await axios.get(`${config.services.analyticsServiceUrl}/api/analytics/surge-factor`, {
      params: { lat, lng },
      headers: { 'X-Correlation-ID': correlationId || 'ride-surge-check' }
    });
    const multiplier = response.data?.data?.surgeMultiplier ?? response.data?.multiplier;
    return typeof multiplier === 'number' && multiplier > 0 ? multiplier : 1.0;
  } catch (error) {
    logger.logWithContext('warn', 'Failed to get surge factor, using default', {
      correlationId: correlationId || 'ride-surge-check',
      error: error.message
    });
    return 1.0;
  }
}

// Create scheduled ride endpoint
app.post('/api/scheduled', authenticate, requireRider, rideLimiter, async (req, res) => {
  try {
    const { pickupLat, pickupLng, dropLat, dropLng, scheduledTime, serviceType, fare } = req.body;

    // Validate inputs
    if (!pickupLat || !pickupLng || !dropLat || !dropLng || !scheduledTime) {
      return res.status(400).json({ error: 'Required fields missing' });
    }

    // Check corporate policy if user belongs to a company
    const companyAccess = await prisma.userCompanyAccess.findUnique({
      where: { userId: req.user.id },
      include: { company: true, policy: true }
    });

    if (companyAccess && companyAccess.policy) {
      const policy = companyAccess.policy;
      
      // Check max fare per ride
      if (policy.maxFarePerRide && fare > policy.maxFarePerRide) {
        return res.status(400).json({ error: `Fare exceeds company policy limit of $${policy.maxFarePerRide}` });
      }
      
      // Check time restrictions
      if (policy.timeRestrictions) {
        const scheduledDate = new Date(scheduledTime);
        const hour = scheduledDate.getHours();
        const dayOfWeek = scheduledDate.getDay();
        
        // Simple check for time restrictions
        if (policy.timeRestrictions.disallowedHours && 
            policy.timeRestrictions.disallowedHours.includes(hour)) {
          return res.status(400).json({ error: 'Scheduled time not allowed by company policy' });
        }
      }
    }

    // Create scheduled ride
    const scheduledRide = await prisma.scheduledRide.create({
      data: {
        userId: req.user.id,
        serviceTypeId: serviceType || 'TAXI',
        pickupLat,
        pickupLng,
        dropLat,
        dropLng,
        scheduledTime: new Date(scheduledTime),
        fareEstimate: fare,
        status: 'PENDING'
      }
    });

    logger.logWithContext('info', 'Scheduled ride created', {
      correlationId: req.correlationId,
      scheduledRideId: scheduledRide.id,
      userId: req.user.id,
      scheduledTime: scheduledTime
    });

    res.status(201).json({
      success: true,
      data: scheduledRide
    });
  } catch (error) {
    logger.logWithContext('error', 'Error creating scheduled ride', {
      correlationId: req.correlationId,
      error: error.message
    });
    res.status(500).json({ error: 'Failed to create scheduled ride' });
  }
});

// Get scheduled rides endpoint
app.get('/api/scheduled', authenticate, async (req, res) => {
  try {
    const { status } = req.query;
    
    const filters = { userId: req.user.id };
    if (status) filters.status = status;
    
    const scheduledRides = await prisma.scheduledRide.findMany({
      where: filters,
      include: { serviceType: true },
      orderBy: { scheduledTime: 'asc' }
    });

    res.json({
      success: true,
      data: scheduledRides
    });
  } catch (error) {
    logger.logWithContext('error', 'Error getting scheduled rides', {
      correlationId: req.correlationId,
      error: error.message
    });
    res.status(500).json({ error: 'Failed to get scheduled rides' });
  }
});

// Create recurring ride endpoint
app.post('/api/recurring', authenticate, requireRider, rideLimiter, async (req, res) => {
  try {
    const { pickupLat, pickupLng, dropLat, dropLng, recurrenceRule, startTime, serviceType, endDate, fare } = req.body;

    // Validate inputs
    if (!pickupLat || !pickupLng || !dropLat || !dropLng || !recurrenceRule || !startTime) {
      return res.status(400).json({ error: 'Required fields missing' });
    }

    // Create recurring ride
    const recurringRide = await prisma.recurringRide.create({
      data: {
        userId: req.user.id,
        serviceTypeId: serviceType || 'TAXI',
        pickupLat,
        pickupLng,
        dropLat,
        dropLng,
        recurrenceRule,
        startTime: new Date(startTime),
        endDate: endDate ? new Date(endDate) : null,
        fareEstimate: fare,
        status: 'ACTIVE'
      }
    });

    logger.logWithContext('info', 'Recurring ride created', {
      correlationId: req.correlationId,
      recurringRideId: recurringRide.id,
      userId: req.user.id
    });

    res.status(201).json({
      success: true,
      data: recurringRide
    });
  } catch (error) {
    logger.logWithContext('error', 'Error creating recurring ride', {
      correlationId: req.correlationId,
      error: error.message
    });
    res.status(500).json({ error: 'Failed to create recurring ride' });
  }
});

// Get recurring rides endpoint
app.get('/api/recurring', authenticate, async (req, res) => {
  try {
    const { status } = req.query;
    
    const filters = { userId: req.user.id };
    if (status) filters.status = status;
    
    const recurringRides = await prisma.recurringRide.findMany({
      where: filters,
      include: { serviceType: true },
      orderBy: { createdAt: 'desc' }
    });

    res.json({
      success: true,
      data: recurringRides
    });
  } catch (error) {
    logger.logWithContext('error', 'Error getting recurring rides', {
      correlationId: req.correlationId,
      error: error.message
    });
    res.status(500).json({ error: 'Failed to get recurring rides' });
  }
});

// Cancel scheduled ride endpoint
app.delete('/api/scheduled/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    
    const scheduledRide = await prisma.scheduledRide.findUnique({
      where: { id }
    });
    
    if (!scheduledRide) {
      return res.status(404).json({ error: 'Scheduled ride not found' });
    }
    
    if (scheduledRide.userId !== req.user.id && req.user.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Forbidden: Not your scheduled ride' });
    }
    
    const updatedRide = await prisma.scheduledRide.update({
      where: { id },
      data: { status: 'CANCELLED' }
    });
    
    res.json({
      success: true,
      data: updatedRide
    });
  } catch (error) {
    logger.logWithContext('error', 'Error cancelling scheduled ride', {
      correlationId: req.correlationId,
      error: error.message
    });
    res.status(500).json({ error: 'Failed to cancel scheduled ride' });
  }
});

// Cancel recurring ride endpoint
app.delete('/api/recurring/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    
    const recurringRide = await prisma.recurringRide.findUnique({
      where: { id }
    });
    
    if (!recurringRide) {
      return res.status(404).json({ error: 'Recurring ride not found' });
    }
    
    if (recurringRide.userId !== req.user.id && req.user.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Forbidden: Not your recurring ride' });
    }
    
    const updatedRide = await prisma.recurringRide.update({
      where: { id },
      data: { status: 'INACTIVE' }
    });
    
    res.json({
      success: true,
      data: updatedRide
    });
  } catch (error) {
    logger.logWithContext('error', 'Error cancelling recurring ride', {
      correlationId: req.correlationId,
      error: error.message
    });
    res.status(500).json({ error: 'Failed to cancel recurring ride' });
  }
});

// Global error handler
app.use((err, req, res, next) => {
  logger.logWithContext('error', 'Ride service error occurred', {
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
const PORT = process.env.PORT || 5002;
app.listen(PORT, () => {
  logger.logWithContext('info', `Ride service running`, {
    port: PORT,
    environment: config.environment,
    timestamp: new Date().toISOString()
  });
});

export default app;
