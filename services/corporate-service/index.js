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
const corporateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20, // limit each IP to 20 requests per windowMs
  message: 'Too many corporate requests, please try again later',
  standardHeaders: true,
  legacyHeaders: false,
});

// Add correlation ID middleware
app.use(addCorrelationId);

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'OK',
    service: 'Corporate Service',
    timestamp: new Date().toISOString(),
    correlationId: req.correlationId
  });
});

// Metrics endpoint
app.get('/metrics', (req, res) => {
  res.status(200).json({
    status: 'OK',
    service: 'Corporate Service',
    metrics: {
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      activeCompanies: 0, // Placeholder
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
      logger.logWithContext('error', 'Corporate service not ready', {
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

// Create corporate account endpoint
app.post('/api/companies', authenticate, corporateLimiter, async (req, res) => {
  try {
    // Only admin can create corporate accounts
    if (req.user.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const { name, contactEmail, contactPhone, address, billingInfo } = req.body;

    if (!name || !contactEmail) {
      return res.status(400).json({ error: 'Company name and contact email are required' });
    }

    // Create corporate account
    const company = await prisma.company.create({
      data: {
        name,
        contactEmail,
        contactPhone,
        address,
        billingInfo,
        status: 'ACTIVE',
        createdBy: req.user.id
      }
    });

    logger.logWithContext('info', 'Corporate account created', {
      correlationId: req.correlationId,
      companyId: company.id,
      adminId: req.user.id
    });

    res.status(201).json({
      success: true,
      data: company
    });
  } catch (error) {
    logger.logWithContext('error', 'Error creating corporate account', {
      correlationId: req.correlationId,
      error: error.message
    });
    res.status(500).json({ error: 'Failed to create corporate account' });
  }
});

// Get corporate account endpoint
app.get('/api/companies/:companyId', authenticate, async (req, res) => {
  try {
    const { companyId } = req.params;

    // Check permissions - admin or company admin can access
    const company = await prisma.company.findUnique({
      where: { id: companyId }
    });

    if (!company) {
      return res.status(404).json({ error: 'Company not found' });
    }

    if (req.user.role !== 'ADMIN') {
      const userCompanyAccess = await prisma.userCompanyAccess.findFirst({
        where: {
          userId: req.user.id,
          companyId,
          role: 'COMPANY_ADMIN'
        }
      });

      if (!userCompanyAccess) {
        return res.status(403).json({ error: 'Access denied' });
      }
    }

    res.json({
      success: true,
      data: company
    });
  } catch (error) {
    logger.logWithContext('error', 'Error getting corporate account', {
      correlationId: req.correlationId,
      error: error.message,
      companyId: req.params.companyId
    });
    res.status(500).json({ error: 'Failed to get corporate account' });
  }
});

// Update corporate account endpoint
app.put('/api/companies/:companyId', authenticate, async (req, res) => {
  try {
    const { companyId } = req.params;
    const updateData = req.body;

    // Check permissions - admin or company admin can update
    const company = await prisma.company.findUnique({
      where: { id: companyId }
    });

    if (!company) {
      return res.status(404).json({ error: 'Company not found' });
    }

    if (req.user.role !== 'ADMIN') {
      const userCompanyAccess = await prisma.userCompanyAccess.findFirst({
        where: {
          userId: req.user.id,
          companyId,
          role: 'COMPANY_ADMIN'
        }
      });

      if (!userCompanyAccess) {
        return res.status(403).json({ error: 'Access denied' });
      }
    }

    const updatedCompany = await prisma.company.update({
      where: { id: companyId },
      data: updateData
    });

    logger.logWithContext('info', 'Corporate account updated', {
      correlationId: req.correlationId,
      companyId,
      updatedBy: req.user.id
    });

    res.json({
      success: true,
      data: updatedCompany
    });
  } catch (error) {
    logger.logWithContext('error', 'Error updating corporate account', {
      correlationId: req.correlationId,
      error: error.message,
      companyId: req.params.companyId
    });
    res.status(500).json({ error: 'Failed to update corporate account' });
  }
});

// Create corporate user endpoint
app.post('/api/companies/:companyId/users', authenticate, async (req, res) => {
  try {
    const { companyId } = req.params;
    const { email, name, role = 'EMPLOYEE' } = req.body;

    // Check permissions - admin or company admin can create corporate users
    if (req.user.role !== 'ADMIN') {
      const userCompanyAccess = await prisma.userCompanyAccess.findFirst({
        where: {
          userId: req.user.id,
          companyId,
          role: 'COMPANY_ADMIN'
        }
      });

      if (!userCompanyAccess) {
        return res.status(403).json({ error: 'Access denied' });
      }
    }

    if (!email || !name) {
      return res.status(400).json({ error: 'Email and name are required' });
    }

    // Find or create user
    let user = await prisma.user.findUnique({
      where: { email }
    });

    if (!user) {
      user = await prisma.user.create({
        data: {
          email,
          name,
          phone: req.body.phone || '',
          role: 'RIDER' // Corporate users are still RIDERs in the main system
        }
      });
    }

    // Grant corporate access
    const companyAccess = await prisma.userCompanyAccess.create({
      data: {
        userId: user.id,
        companyId,
        role,
        grantedBy: req.user.id
      }
    });

    logger.logWithContext('info', 'Corporate user created', {
      correlationId: req.correlationId,
      companyId,
      userId: user.id,
      role,
      grantedBy: req.user.id
    });

    res.status(201).json({
      success: true,
      data: {
        user,
        companyAccess
      }
    });
  } catch (error) {
    logger.logWithContext('error', 'Error creating corporate user', {
      correlationId: req.correlationId,
      error: error.message,
      companyId: req.params.companyId
    });
    res.status(500).json({ error: 'Failed to create corporate user' });
  }
});

// Get corporate users endpoint
app.get('/api/companies/:companyId/users', authenticate, async (req, res) => {
  try {
    const { companyId } = req.params;

    // Check permissions - admin or company admin can view corporate users
    if (req.user.role !== 'ADMIN') {
      const userCompanyAccess = await prisma.userCompanyAccess.findFirst({
        where: {
          userId: req.user.id,
          companyId,
          role: { in: ['COMPANY_ADMIN', 'COMPANY_MANAGER'] }
        }
      });

      if (!userCompanyAccess) {
        return res.status(403).json({ error: 'Access denied' });
      }
    }

    const companyUsers = await prisma.userCompanyAccess.findMany({
      where: { companyId },
      include: {
        user: true
      },
      orderBy: { createdAt: 'desc' }
    });

    res.json({
      success: true,
      data: companyUsers
    });
  } catch (error) {
    logger.logWithContext('error', 'Error getting corporate users', {
      correlationId: req.correlationId,
      error: error.message,
      companyId: req.params.companyId
    });
    res.status(500).json({ error: 'Failed to get corporate users' });
  }
});

// Create corporate trip endpoint
app.post('/api/companies/:companyId/trips', authenticate, async (req, res) => {
  try {
    const { companyId } = req.params;
    const { pickupLat, pickupLng, dropLat, dropLng, fare, employeeId, purpose } = req.body;

    // Check permissions - admin, company admin, or authorized employee can create corporate trips
    const userCompanyAccess = await prisma.userCompanyAccess.findFirst({
      where: {
        userId: req.user.id,
        companyId,
        role: { in: ['COMPANY_ADMIN', 'COMPANY_MANAGER', 'EMPLOYEE'] }
      }
    });

    if (!userCompanyAccess) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // If employee is creating trip for themselves, verify it's their ID
    if (userCompanyAccess.role === 'EMPLOYEE' && employeeId && employeeId !== req.user.id) {
      return res.status(403).json({ error: 'Cannot create trip for other employees' });
    }

    // Validate inputs
    if (!pickupLat || !pickupLng || !dropLat || !dropLng || !fare) {
      return res.status(400).json({ error: 'Required fields missing' });
    }

    // Create trip with corporate flag
    const trip = await prisma.trip.create({
      data: {
        riderId: employeeId || req.user.id,
        pickupLat,
        pickupLng,
        dropLat,
        dropLng,
        fare,
        serviceType: 'CORPORATE',
        status: 'REQUESTED',
        corporateInfo: {
          companyId,
          purpose,
          authorizedBy: req.user.id
        }
      },
      include: { rider: true }
    });

    // Notify dispatch service to find a driver
    try {
      await axios.post(`${config.services.dispatchServiceUrl}/api/dispatch/find-and-offer-drivers`, {
        tripId: trip.id,
        pickupLat,
        pickupLng,
        serviceType: 'CORPORATE'
      }, {
        headers: {
          'Authorization': req.headers.authorization,
          'X-Correlation-ID': req.correlationId
        }
      });
    } catch (dispatchError) {
      logger.logWithContext('error', 'Failed to dispatch corporate trip', {
        correlationId: req.correlationId,
        tripId: trip.id,
        error: dispatchError.message
      });
    }

    logger.logWithContext('info', 'Corporate trip created', {
      correlationId: req.correlationId,
      tripId: trip.id,
      companyId,
      employeeId: employeeId || req.user.id
    });

    res.status(201).json({
      success: true,
      data: trip
    });
  } catch (error) {
    logger.logWithContext('error', 'Error creating corporate trip', {
      correlationId: req.correlationId,
      error: error.message,
      companyId: req.params.companyId
    });
    res.status(500).json({ error: 'Failed to create corporate trip' });
  }
});

// Get corporate trips endpoint
app.get('/api/companies/:companyId/trips', authenticate, async (req, res) => {
  try {
    const { companyId } = req.params;
    const { employeeId, from, to } = req.query;

    // Check permissions - admin or company admin can view corporate trips
    if (req.user.role !== 'ADMIN') {
      const userCompanyAccess = await prisma.userCompanyAccess.findFirst({
        where: {
          userId: req.user.id,
          companyId,
          role: { in: ['COMPANY_ADMIN', 'COMPANY_MANAGER'] }
        }
      });

      if (!userCompanyAccess) {
        return res.status(403).json({ error: 'Access denied' });
      }
    }

    const filters = {
      corporateInfo: { path: ['companyId'], equals: companyId }
    };

    if (employeeId) {
      filters.riderId = employeeId;
    }

    if (from || to) {
      filters.createdAt = {};
      if (from) filters.createdAt.gte = new Date(from);
      if (to) filters.createdAt.lte = new Date(to);
    }

    const corporateTrips = await prisma.trip.findMany({
      where: filters,
      include: { 
        rider: true, 
        driver: { include: { user: true } } 
      },
      orderBy: { createdAt: 'desc' }
    });

    res.json({
      success: true,
      data: corporateTrips
    });
  } catch (error) {
    logger.logWithContext('error', 'Error getting corporate trips', {
      correlationId: req.correlationId,
      error: error.message,
      companyId: req.params.companyId
    });
    res.status(500).json({ error: 'Failed to get corporate trips' });
  }
});

// Get corporate billing endpoint
app.get('/api/companies/:companyId/billing', authenticate, async (req, res) => {
  try {
    const { companyId } = req.params;
    const { from, to } = req.query;

    // Check permissions - admin or company admin can view billing
    if (req.user.role !== 'ADMIN') {
      const userCompanyAccess = await prisma.userCompanyAccess.findFirst({
        where: {
          userId: req.user.id,
          companyId,
          role: { in: ['COMPANY_ADMIN', 'COMPANY_MANAGER'] }
        }
      });

      if (!userCompanyAccess) {
        return res.status(403).json({ error: 'Access denied' });
      }
    }

    const startDate = from ? new Date(from) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const endDate = to ? new Date(to) : new Date();

    // Get corporate trip data for billing
    const corporateTrips = await prisma.trip.findMany({
      where: {
        corporateInfo: { path: ['companyId'], equals: companyId },
        createdAt: { gte: startDate, lte: endDate },
        status: 'COMPLETED'
      },
      select: {
        id: true,
        fare: true,
        createdAt: true,
        rider: {
          select: { name: true, email: true }
        }
      }
    });

    // Calculate billing summary
    const billingSummary = {
      companyId,
      period: { start: startDate, end: endDate },
      totalTrips: corporateTrips.length,
      totalAmount: corporateTrips.reduce((sum, trip) => sum + (trip.fare || 0), 0),
      trips: corporateTrips
    };

    res.json({
      success: true,
      data: billingSummary
    });
  } catch (error) {
    logger.logWithContext('error', 'Error getting corporate billing', {
      correlationId: req.correlationId,
      error: error.message,
      companyId: req.params.companyId
    });
    res.status(500).json({ error: 'Failed to get corporate billing' });
  }
});

// Get corporate analytics endpoint
app.get('/api/companies/:companyId/analytics', authenticate, async (req, res) => {
  try {
    const { companyId } = req.params;
    const { from, to } = req.query;

    // Check permissions - admin or company admin can view analytics
    if (req.user.role !== 'ADMIN') {
      const userCompanyAccess = await prisma.userCompanyAccess.findFirst({
        where: {
          userId: req.user.id,
          companyId,
          role: { in: ['COMPANY_ADMIN', 'COMPANY_MANAGER'] }
        }
      });

      if (!userCompanyAccess) {
        return res.status(403).json({ error: 'Access denied' });
      }
    }

    const startDate = from ? new Date(from) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const endDate = to ? new Date(to) : new Date();

    // Get corporate analytics
    const [
      tripStats,
      userStats,
      expenseStats
    ] = await Promise.all([
      prisma.trip.groupBy({
        by: ['riderId'],
        where: {
          corporateInfo: { path: ['companyId'], equals: companyId },
          createdAt: { gte: startDate, lte: endDate },
          status: 'COMPLETED'
        },
        _count: true,
        _sum: { fare: true }
      }),
      prisma.userCompanyAccess.count({
        where: { companyId }
      }),
      prisma.trip.aggregate({
        where: {
          corporateInfo: { path: ['companyId'], equals: companyId },
          createdAt: { gte: startDate, lte: endDate },
          status: 'COMPLETED'
        },
        _sum: { fare: true },
        _count: true
      })
    ]);

    const analytics = {
      companyId,
      period: { start: startDate, end: endDate },
      keyMetrics: {
        totalEmployees: userStats,
        totalTrips: expenseStats._count,
        totalExpenses: expenseStats._sum.fare || 0,
        avgTripCost: expenseStats._count > 0 ? expenseStats._sum.fare / expenseStats._count : 0
      },
      byEmployee: tripStats,
      expenseTrend: [] // Would implement trend calculation
    };

    res.json({
      success: true,
      data: analytics
    });
  } catch (error) {
    logger.logWithContext('error', 'Error getting corporate analytics', {
      correlationId: req.correlationId,
      error: error.message,
      companyId: req.params.companyId
    });
    res.status(500).json({ error: 'Failed to get corporate analytics' });
  }
});

// Create corporate policy endpoint
app.post('/api/companies/:companyId/policies', authenticate, async (req, res) => {
  try {
    const { companyId } = req.params;
    const {
      name,
      description,
      maxFarePerRide,
      maxRidesPerDay,
      maxRidesPerWeek,
      allowedZones,
      timeRestrictions,
      allowedVehicleTypes,
      isActive
    } = req.body;

    // Check permissions - only admin or company admin can create policies
    if (req.user.role !== 'ADMIN') {
      const userCompanyAccess = await prisma.userCompanyAccess.findFirst({
        where: {
          userId: req.user.id,
          companyId,
          role: 'COMPANY_ADMIN'
        }
      });

      if (!userCompanyAccess) {
        return res.status(403).json({ error: 'Access denied' });
      }
    }

    const policy = await prisma.corporatePolicy.create({
      data: {
        name,
        description,
        companyId,
        maxFarePerRide,
        maxRidesPerDay,
        maxRidesPerWeek,
        allowedZones,
        timeRestrictions,
        allowedVehicleTypes,
        isActive
      }
    });

    logger.logWithContext('info', 'Corporate policy created', {
      correlationId: req.correlationId,
      companyId,
      policyId: policy.id
    });

    res.status(201).json({
      success: true,
      data: policy
    });
  } catch (error) {
    logger.logWithContext('error', 'Error creating corporate policy', {
      correlationId: req.correlationId,
      error: error.message,
      companyId: req.params.companyId
    });
    res.status(500).json({ error: 'Failed to create corporate policy' });
  }
});

// Get corporate policies endpoint
app.get('/api/companies/:companyId/policies', authenticate, async (req, res) => {
  try {
    const { companyId } = req.params;

    // Check permissions - admin or company admin/manager can view policies
    if (req.user.role !== 'ADMIN') {
      const userCompanyAccess = await prisma.userCompanyAccess.findFirst({
        where: {
          userId: req.user.id,
          companyId,
          role: { in: ['COMPANY_ADMIN', 'COMPANY_MANAGER'] }
        }
      });

      if (!userCompanyAccess) {
        return res.status(403).json({ error: 'Access denied' });
      }
    }

    const policies = await prisma.corporatePolicy.findMany({
      where: { companyId },
      orderBy: { createdAt: 'desc' }
    });

    res.json({
      success: true,
      data: policies
    });
  } catch (error) {
    logger.logWithContext('error', 'Error getting corporate policies', {
      correlationId: req.correlationId,
      error: error.message,
      companyId: req.params.companyId
    });
    res.status(500).json({ error: 'Failed to get corporate policies' });
  }
});

// Update corporate policy endpoint
app.put('/api/companies/:companyId/policies/:policyId', authenticate, async (req, res) => {
  try {
    const { companyId, policyId } = req.params;
    const updateData = req.body;

    // Check permissions - only admin or company admin can update policy
    if (req.user.role !== 'ADMIN') {
      const userCompanyAccess = await prisma.userCompanyAccess.findFirst({
        where: {
          userId: req.user.id,
          companyId,
          role: 'COMPANY_ADMIN'
        }
      });

      if (!userCompanyAccess) {
        return res.status(403).json({ error: 'Access denied' });
      }
    }

    const policy = await prisma.corporatePolicy.update({
      where: { id: policyId },
      data: updateData
    });

    logger.logWithContext('info', 'Corporate policy updated', {
      correlationId: req.correlationId,
      policyId,
      updatedBy: req.user.id
    });

    res.json({
      success: true,
      data: policy
    });
  } catch (error) {
    logger.logWithContext('error', 'Error updating corporate policy', {
      correlationId: req.correlationId,
      error: error.message,
      policyId: req.params.policyId
    });
    res.status(500).json({ error: 'Failed to update corporate policy' });
  }
});

// Get corporate wallet balance endpoint
app.get('/api/companies/:companyId/wallet', authenticate, async (req, res) => {
  try {
    const { companyId } = req.params;

    // Check permissions - admin or company admin/manager can view wallet
    if (req.user.role !== 'ADMIN') {
      const userCompanyAccess = await prisma.userCompanyAccess.findFirst({
        where: {
          userId: req.user.id,
          companyId,
          role: { in: ['COMPANY_ADMIN', 'COMPANY_MANAGER'] }
        }
      });

      if (!userCompanyAccess) {
        return res.status(403).json({ error: 'Access denied' });
      }
    }

    const company = await prisma.company.findUnique({
      where: { id: companyId },
      select: { walletBalance: true }
    });

    res.json({
      success: true,
      data: {
        companyId,
        balance: company.walletBalance
      }
    });
  } catch (error) {
    logger.logWithContext('error', 'Error getting corporate wallet', {
      correlationId: req.correlationId,
      error: error.message,
      companyId: req.params.companyId
    });
    res.status(500).json({ error: 'Failed to get corporate wallet' });
  }
});

// Add funds to corporate wallet endpoint
app.post('/api/companies/:companyId/wallet/add-funds', authenticate, async (req, res) => {
  try {
    const { companyId } = req.params;
    const { amount, paymentMethod } = req.body;

    // Check permissions - only admin or company admin can add funds
    if (req.user.role !== 'ADMIN') {
      const userCompanyAccess = await prisma.userCompanyAccess.findFirst({
        where: {
          userId: req.user.id,
          companyId,
          role: 'COMPANY_ADMIN'
        }
      });

      if (!userCompanyAccess) {
        return res.status(403).json({ error: 'Access denied' });
      }
    }

    if (!amount || amount <= 0) {
      return res.status(400).json({ error: 'Valid amount is required' });
    }

    // Update company wallet balance
    const updatedCompany = await prisma.company.update({
      where: { id: companyId },
      data: { walletBalance: { increment: amount } }
    });

    logger.logWithContext('info', 'Funds added to corporate wallet', {
      correlationId: req.correlationId,
      companyId,
      amount,
      newBalance: updatedCompany.walletBalance
    });

    res.json({
      success: true,
      data: {
        balance: updatedCompany.walletBalance,
        amountAdded: amount
      }
    });
  } catch (error) {
    logger.logWithContext('error', 'Error adding funds to corporate wallet', {
      correlationId: req.correlationId,
      error: error.message,
      companyId: req.params.companyId
    });
    res.status(500).json({ error: 'Failed to add funds to corporate wallet' });
  }
});

// Generate corporate invoice endpoint
app.post('/api/companies/:companyId/invoices/generate', authenticate, async (req, res) => {
  try {
    const { companyId } = req.params;
    const { periodStart, periodEnd, description } = req.body;

    // Check permissions - only admin or company admin can generate invoice
    if (req.user.role !== 'ADMIN') {
      const userCompanyAccess = await prisma.userCompanyAccess.findFirst({
        where: {
          userId: req.user.id,
          companyId,
          role: 'COMPANY_ADMIN'
        }
      });

      if (!userCompanyAccess) {
        return res.status(403).json({ error: 'Access denied' });
      }
    }

    // Get trip data for the period
    const trips = await prisma.trip.findMany({
      where: {
        corporateInfo: { path: ['companyId'], equals: companyId },
        createdAt: { gte: new Date(periodStart), lte: new Date(periodEnd) },
        status: 'COMPLETED'
      },
      include: { rider: true }
    });

    // Calculate total amount
    const totalAmount = trips.reduce((sum, trip) => sum + (trip.fare || 0), 0);

    // Create invoice
    const invoice = await prisma.corporateInvoice.create({
      data: {
        companyId,
        invoiceNumber: `INV-${companyId.substring(0, 8)}-${Date.now()}`,
        periodStart: new Date(periodStart),
        periodEnd: new Date(periodEnd),
        totalAmount,
        issuedDate: new Date(),
        dueDate: new Date(new Date().setDate(new Date().getDate() + 30)), // 30 days from today
        items: {
          trips: trips.map(trip => ({
            id: trip.id,
            riderName: trip.rider.name,
            pickup: `${trip.pickupLat},${trip.pickupLng}`,
            drop: `${trip.dropLat},${trip.dropLng}`,
            fare: trip.fare,
            date: trip.createdAt
          })),
          total: totalAmount
        }
      }
    });

    logger.logWithContext('info', 'Corporate invoice generated', {
      correlationId: req.correlationId,
      invoiceId: invoice.id,
      companyId,
      totalAmount
    });

    res.status(201).json({
      success: true,
      data: invoice
    });
  } catch (error) {
    logger.logWithContext('error', 'Error generating corporate invoice', {
      correlationId: req.correlationId,
      error: error.message,
      companyId: req.params.companyId
    });
    res.status(500).json({ error: 'Failed to generate corporate invoice' });
  }
});

// Get corporate invoices endpoint
app.get('/api/companies/:companyId/invoices', authenticate, async (req, res) => {
  try {
    const { companyId } = req.params;
    const { status, from, to } = req.query;

    // Check permissions - admin or company admin/manager can view invoices
    if (req.user.role !== 'ADMIN') {
      const userCompanyAccess = await prisma.userCompanyAccess.findFirst({
        where: {
          userId: req.user.id,
          companyId,
          role: { in: ['COMPANY_ADMIN', 'COMPANY_MANAGER'] }
        }
      });

      if (!userCompanyAccess) {
        return res.status(403).json({ error: 'Access denied' });
      }
    }

    const filters = { companyId };
    if (status) filters.status = status;
    if (from || to) {
      filters.issuedDate = {};
      if (from) filters.issuedDate.gte = new Date(from);
      if (to) filters.issuedDate.lte = new Date(to);
    }

    const invoices = await prisma.corporateInvoice.findMany({
      where: filters,
      orderBy: { issuedDate: 'desc' }
    });

    res.json({
      success: true,
      data: invoices
    });
  } catch (error) {
    logger.logWithContext('error', 'Error getting corporate invoices', {
      correlationId: req.correlationId,
      error: error.message,
      companyId: req.params.companyId
    });
    res.status(500).json({ error: 'Failed to get corporate invoices' });
  }
});

// Get corporate invoice by ID endpoint
app.get('/api/companies/:companyId/invoices/:invoiceId', authenticate, async (req, res) => {
  try {
    const { companyId, invoiceId } = req.params;

    // Check permissions - admin or company admin/manager can view invoice
    if (req.user.role !== 'ADMIN') {
      const userCompanyAccess = await prisma.userCompanyAccess.findFirst({
        where: {
          userId: req.user.id,
          companyId,
          role: { in: ['COMPANY_ADMIN', 'COMPANY_MANAGER'] }
        }
      });

      if (!userCompanyAccess) {
        return res.status(403).json({ error: 'Access denied' });
      }
    }

    const invoice = await prisma.corporateInvoice.findUnique({
      where: { id: invoiceId },
      include: { company: true }
    });

    if (!invoice) {
      return res.status(404).json({ error: 'Invoice not found' });
    }

    if (invoice.companyId !== companyId) {
      return res.status(403).json({ error: 'Invoice does not belong to this company' });
    }

    res.json({
      success: true,
      data: invoice
    });
  } catch (error) {
    logger.logWithContext('error', 'Error getting corporate invoice', {
      correlationId: req.correlationId,
      error: error.message,
      invoiceId: req.params.invoiceId
    });
    res.status(500).json({ error: 'Failed to get corporate invoice' });
  }
});

// Global error handler
app.use((err, req, res, next) => {
  logger.logWithContext('error', 'Corporate service error occurred', {
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
const PORT = process.env.PORT || 5009;
app.listen(PORT, () => {
  logger.logWithContext('info', `Corporate service running`, {
    port: PORT,
    environment: config.environment,
    timestamp: new Date().toISOString()
  });
});

export default app;
