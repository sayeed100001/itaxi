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
const walletLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20, // limit each IP to 20 requests per windowMs
  message: 'Too many wallet requests, please try again later',
  standardHeaders: true,
  legacyHeaders: false,
});

// Add correlation ID middleware
app.use(addCorrelationId);

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'OK',
    service: 'Wallet Service',
    timestamp: new Date().toISOString(),
    correlationId: req.correlationId
  });
});

// Metrics endpoint
app.get('/metrics', (req, res) => {
  res.status(200).json({
    status: 'OK',
    service: 'Wallet Service',
    metrics: {
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      activeWallets: 0, // Placeholder
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
      logger.logWithContext('error', 'Wallet service not ready', {
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

// Get wallet balance endpoint
app.get('/api/balance', authenticate, async (req, res) => {
  try {
    if (prisma.wallet?.upsert) {
      // Find or create wallet for user when wallet model exists.
      const wallet = await prisma.wallet.upsert({
        where: { userId: req.user.id },
        update: {},
        create: { userId: req.user.id, balance: 0 }
      });

      return res.json({
        success: true,
        data: {
          balance: wallet.balance,
          currency: 'USD',
          userId: req.user.id
        }
      });
    }

    // Fallback for schemas without Wallet model: derive balance from transactions.
    const aggregate = await prisma.transaction.aggregate({
      where: { userId: req.user.id, status: 'COMPLETED' },
      _sum: { amount: true }
    });

    res.json({
      success: true,
      data: {
        balance: aggregate._sum.amount || 0,
        currency: 'USD',
        userId: req.user.id
      }
    });
  } catch (error) {
    logger.logWithContext('error', 'Error getting wallet balance', {
      correlationId: req.correlationId,
      error: error.message,
      userId: req.user.id
    });
    res.status(500).json({ error: 'Failed to get wallet balance' });
  }
});

// Add funds to wallet endpoint
app.post('/api/add-funds', authenticate, requireRider, walletLimiter, async (req, res) => {
  try {
    const { amount } = req.body;

    if (!amount || amount <= 0) {
      return res.status(400).json({ error: 'Valid amount is required' });
    }

    // Add funds via payment service checkout session
    try {
      const paymentResponse = await axios.post(`${config.services.paymentServiceUrl}/api/create-session`, {
        amount,
        currency: 'usd',
        userId: req.user.id
      }, {
        headers: {
          'Authorization': req.headers.authorization,
          'X-Correlation-ID': req.correlationId
        }
      });

      res.json({
        success: true,
        data: paymentResponse.data
      });
    } catch (paymentError) {
      logger.logWithContext('error', 'Error initiating payment for wallet funding', {
        correlationId: req.correlationId,
        error: paymentError.message,
        userId: req.user.id,
        amount
      });
      res.status(500).json({ error: 'Failed to initiate payment' });
    }
  } catch (error) {
    logger.logWithContext('error', 'Error adding funds to wallet', {
      correlationId: req.correlationId,
      error: error.message,
      userId: req.user.id
    });
    res.status(500).json({ error: 'Failed to add funds to wallet' });
  }
});

// Process trip payment endpoint (internal use)
app.post('/api/process-trip-payment', authenticate, async (req, res) => {
  try {
    const { tripId, riderId, amount } = req.body;

    // Only internal services should call this endpoint
    // In a real system, you'd have stricter internal authentication
    
    // Find the trip
    const trip = await prisma.trip.findUnique({
      where: { id: tripId }
    });

    if (!trip) {
      return res.status(404).json({ error: 'Trip not found' });
    }

    // Check if trip is completed
    if (trip.status !== 'COMPLETED') {
      return res.status(400).json({ error: 'Trip must be completed for payment' });
    }

    // Find rider's wallet
    const wallet = await prisma.wallet.findUnique({
      where: { userId: riderId }
    });

    if (!wallet || wallet.balance < amount) {
      return res.status(400).json({ error: 'Insufficient funds in wallet' });
    }

    // Begin transaction
    const transaction = await prisma.$transaction(async (tx) => {
      // Deduct amount from rider's wallet
      const updatedRiderWallet = await tx.wallet.update({
        where: { userId: riderId },
        data: { balance: { decrement: amount } }
      });

      // Calculate platform commission (e.g., 20%)
      const platformCommission = amount * 0.2;
      const driverEarnings = amount - platformCommission;

      // Add earnings to escrow account for driver
      const escrowTransaction = await tx.escrowTransaction.create({
        data: {
          tripId,
          riderId,
          driverId: trip.driverId,
          amount,
          platformCommission,
          driverShare: driverEarnings,
          status: 'HELD'
        }
      });

      // Record the transaction
      const transactionRecord = await tx.transaction.create({
        data: {
          userId: riderId,
          amount: amount * -1, // Negative for debit
          type: 'DEBIT',
          status: 'COMPLETED',
          description: `Trip payment for trip ${tripId}`,
          relatedEntity: 'TRIP',
          relatedEntityId: tripId
        }
      });

      return {
        updatedRiderWallet,
        escrowTransaction,
        transactionRecord
      };
    });

    logger.logWithContext('info', 'Trip payment processed', {
      correlationId: req.correlationId,
      tripId,
      riderId,
      amount,
      driverEarnings: transaction.escrowTransaction.driverShare
    });

    res.json({
      success: true,
      data: {
        riderWalletBalance: transaction.updatedRiderWallet.balance,
        escrowTransaction: transaction.escrowTransaction
      }
    });
  } catch (error) {
    logger.logWithContext('error', 'Error processing trip payment', {
      correlationId: req.correlationId,
      error: error.message,
      tripId: req.body.tripId
    });
    res.status(500).json({ error: 'Failed to process trip payment' });
  }
});

// Process driver payout endpoint
app.post('/api/process-payout', authenticate, async (req, res) => {
  try {
    // Only internal services should call this (like payment service)
    const { driverId, amount } = req.body;

    // Find driver
    const driver = await prisma.driver.findUnique({
      where: { id: driverId }
    });

    if (!driver) {
      return res.status(404).json({ error: 'Driver not found' });
    }

    // Find driver's wallet
    const wallet = await prisma.wallet.findUnique({
      where: { userId: driver.userId }
    });

    if (!wallet || wallet.balance < amount) {
      return res.status(400).json({ error: 'Insufficient funds in wallet for payout' });
    }

    // Begin transaction
    const transaction = await prisma.$transaction(async (tx) => {
      // Deduct amount from platform wallet
      const updatedWallet = await tx.wallet.update({
        where: { userId: driver.userId },
        data: { balance: { decrement: amount } }
      });

      // Create payout record
      const payout = await tx.payout.create({
        data: {
          driverId: driver.id,
          amount,
          status: 'COMPLETED',
          processedBy: req.user.id
        }
      });

      // Record the transaction
      const transactionRecord = await tx.transaction.create({
        data: {
          userId: driver.userId,
          amount: amount * -1, // Negative for debit
          type: 'DEBIT',
          status: 'COMPLETED',
          description: `Payout to driver ${driverId}`,
          relatedEntity: 'PAYOUT',
          relatedEntityId: payout.id
        }
      });

      return {
        updatedWallet,
        payout,
        transactionRecord
      };
    });

    logger.logWithContext('info', 'Driver payout processed', {
      correlationId: req.correlationId,
      driverId,
      amount
    });

    res.json({
      success: true,
      data: {
        walletBalance: transaction.updatedWallet.balance,
        payout: transaction.payout
      }
    });
  } catch (error) {
    logger.logWithContext('error', 'Error processing driver payout', {
      correlationId: req.correlationId,
      error: error.message,
      driverId: req.body.driverId
    });
    res.status(500).json({ error: 'Failed to process driver payout' });
  }
});

// Transfer funds between wallets (for internal use)
app.post('/api/transfer', authenticate, async (req, res) => {
  try {
    // Only internal services should call this
    const { fromUserId, toUserId, amount, description } = req.body;

    if (!fromUserId || !toUserId || !amount || amount <= 0) {
      return res.status(400).json({ error: 'Valid fromUserId, toUserId, and amount required' });
    }

    // Begin transaction
    const transaction = await prisma.$transaction(async (tx) => {
      // Check sender's balance
      const senderWallet = await tx.wallet.findUnique({
        where: { userId: fromUserId }
      });

      if (!senderWallet || senderWallet.balance < amount) {
        throw new Error('Insufficient funds');
      }

      // Transfer funds
      const updatedSenderWallet = await tx.wallet.update({
        where: { userId: fromUserId },
        data: { balance: { decrement: amount } }
      });

      const updatedRecipientWallet = await tx.wallet.update({
        where: { userId: toUserId },
        data: { balance: { increment: amount } }
      });

      // Record debit transaction for sender
      const debitTx = await tx.transaction.create({
        data: {
          userId: fromUserId,
          amount: amount * -1,
          type: 'DEBIT',
          status: 'COMPLETED',
          description: description || 'Transfer to another user',
          relatedEntity: 'TRANSFER',
          relatedEntityId: `${fromUserId}_to_${toUserId}`
        }
      });

      // Record credit transaction for recipient
      const creditTx = await tx.transaction.create({
        data: {
          userId: toUserId,
          amount,
          type: 'CREDIT',
          status: 'COMPLETED',
          description: description || 'Transfer from another user',
          relatedEntity: 'TRANSFER',
          relatedEntityId: `${fromUserId}_to_${toUserId}`
        }
      });

      return {
        senderWallet: updatedSenderWallet,
        recipientWallet: updatedRecipientWallet,
        debitTransaction: debitTx,
        creditTransaction: creditTx
      };
    });

    logger.logWithContext('info', 'Funds transferred', {
      correlationId: req.correlationId,
      fromUserId,
      toUserId,
      amount
    });

    res.json({
      success: true,
      data: {
        senderBalance: transaction.senderWallet.balance,
        recipientBalance: transaction.recipientWallet.balance
      }
    });
  } catch (error) {
    logger.logWithContext('error', 'Error transferring funds', {
      correlationId: req.correlationId,
      error: error.message,
      fromUserId: req.body.fromUserId,
      toUserId: req.body.toUserId
    });
    res.status(500).json({ error: 'Failed to transfer funds' });
  }
});

// Update wallet balance (for external payments to be reflected)
app.post('/api/update-balance', authenticate, async (req, res) => {
  try {
    // This endpoint is typically called by payment service after successful payment
    const { userId, amount, transactionId } = req.body;

    if (!userId || !amount || amount <= 0) {
      return res.status(400).json({ error: 'Valid userId and positive amount required' });
    }

    // Find or create wallet
    const wallet = await prisma.wallet.upsert({
      where: { userId },
      update: { balance: { increment: amount } },
      create: { userId, balance: amount }
    });

    // Record the transaction
    const transaction = await prisma.transaction.create({
      data: {
        userId,
        amount,
        type: 'CREDIT',
        status: 'COMPLETED',
        description: 'Payment received',
        relatedEntity: 'PAYMENT',
        relatedEntityId: transactionId
      }
    });

    logger.logWithContext('info', 'Wallet balance updated', {
      correlationId: req.correlationId,
      userId,
      amount,
      newBalance: wallet.balance
    });

    res.json({
      success: true,
      data: {
        balance: wallet.balance,
        transaction: transaction
      }
    });
  } catch (error) {
    logger.logWithContext('error', 'Error updating wallet balance', {
      correlationId: req.correlationId,
      error: error.message,
      userId: req.body.userId
    });
    res.status(500).json({ error: 'Failed to update wallet balance' });
  }
});

// Get wallet transaction history
app.get('/api/transactions', authenticate, async (req, res) => {
  try {
    const { limit = 50, offset = 0 } = req.query;

    const transactions = await prisma.transaction.findMany({
      where: { userId: req.user.id },
      orderBy: { createdAt: 'desc' },
      take: parseInt(limit),
      skip: parseInt(offset)
    });

    const totalCount = await prisma.transaction.count({
      where: { userId: req.user.id }
    });

    res.json({
      success: true,
      data: {
        transactions,
        pagination: {
          limit: parseInt(limit),
          offset: parseInt(offset),
          total: totalCount
        }
      }
    });
  } catch (error) {
    logger.logWithContext('error', 'Error getting wallet transactions', {
      correlationId: req.correlationId,
      error: error.message,
      userId: req.user.id
    });
    res.status(500).json({ error: 'Failed to get wallet transactions' });
  }
});

// Release escrow funds endpoint (for admin or automated system)
app.post('/api/release-escrow', authenticate, async (req, res) => {
  try {
    // Only admin can release escrow manually
    if (req.user.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const { escrowId, reason = 'Manual release by admin' } = req.body;

    // Get escrow transaction
    const escrow = await prisma.escrowTransaction.findUnique({
      where: { id: escrowId }
    });

    if (!escrow || escrow.status !== 'HELD') {
      return res.status(400).json({ error: 'Escrow transaction not found or already processed' });
    }

    // Begin transaction
    const result = await prisma.$transaction(async (tx) => {
      // Transfer driver's share to driver's wallet
      const driverWallet = await tx.wallet.upsert({
        where: { userId: escrow.driverId },
        update: { balance: { increment: escrow.driverShare } },
        create: { userId: escrow.driverId, balance: escrow.driverShare }
      });

      // Update escrow status
      const updatedEscrow = await tx.escrowTransaction.update({
        where: { id: escrowId },
        data: { 
          status: 'RELEASED',
          releasedAt: new Date(),
          releaseReason: reason
        }
      });

      // Record the credit transaction for driver
      const creditTx = await tx.transaction.create({
        data: {
          userId: escrow.driverId,
          amount: escrow.driverShare,
          type: 'CREDIT',
          status: 'COMPLETED',
          description: `Escrow release for trip ${escrow.tripId}: ${reason}`,
          relatedEntity: 'ESCROW_RELEASE',
          relatedEntityId: escrowId
        }
      });

      return {
        driverWallet,
        updatedEscrow,
        creditTransaction: creditTx
      };
    });

    logger.logWithContext('info', 'Escrow funds released', {
      correlationId: req.correlationId,
      escrowId,
      driverId: escrow.driverId,
      amount: escrow.driverShare,
      reason
    });

    res.json({
      success: true,
      data: {
        driverBalance: result.driverWallet.balance,
        escrow: result.updatedEscrow
      }
    });
  } catch (error) {
    logger.logWithContext('error', 'Error releasing escrow funds', {
      correlationId: req.correlationId,
      error: error.message,
      escrowId: req.body.escrowId
    });
    res.status(500).json({ error: 'Failed to release escrow funds' });
  }
});

// Global error handler
app.use((err, req, res, next) => {
  logger.logWithContext('error', 'Wallet service error occurred', {
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
const PORT = process.env.PORT || 5005;
app.listen(PORT, () => {
  logger.logWithContext('info', `Wallet service running`, {
    port: PORT,
    environment: config.environment,
    timestamp: new Date().toISOString()
  });
});

export default app;
