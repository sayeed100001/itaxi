import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import axios from 'axios';
import { PrismaClient } from '@prisma/client';
import { config } from '@shared/config';
import { logger, addCorrelationId } from '@shared/logger';
import { authenticate, requireRider } from '@shared/auth';

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
const loyaltyLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20, // limit each IP to 20 requests per windowMs
  message: 'Too many loyalty requests, please try again later',
  standardHeaders: true,
  legacyHeaders: false,
});

// Add correlation ID middleware
app.use(addCorrelationId);

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'OK',
    service: 'Loyalty Service',
    timestamp: new Date().toISOString(),
    correlationId: req.correlationId
  });
});

// Metrics endpoint
app.get('/metrics', (req, res) => {
  res.status(200).json({
    status: 'OK',
    service: 'Loyalty Service',
    metrics: {
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      activeUsers: 0, // Placeholder
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
      logger.logWithContext('error', 'Loyalty service not ready', {
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

// Get user loyalty profile endpoint
app.get('/api/profile', authenticate, async (req, res) => {
  try {
    const userLoyalty = await prisma.userLoyaltyProgram.findFirst({
      where: {
        userId: req.user.id,
        isActive: true
      },
      include: {
        currentTier: true,
        loyaltyProgram: true
      }
    });

    if (!userLoyalty) {
      // Return default profile
      res.json({
        success: true,
        data: {
          userId: req.user.id,
          points: 0,
          totalEarnedPoints: 0,
          currentTier: null,
          enrolledPrograms: []
        }
      });
      return;
    }

    res.json({
      success: true,
      data: userLoyalty
    });
  } catch (error) {
    logger.logWithContext('error', 'Error getting loyalty profile', {
      correlationId: req.correlationId,
      error: error.message,
      userId: req.user.id
    });
    res.status(500).json({ error: 'Failed to get loyalty profile' });
  }
});

// Get available rewards endpoint
app.get('/api/rewards', authenticate, async (req, res) => {
  try {
    const { programId } = req.query;

    const filters = {
      isActive: true
    };

    if (programId) {
      filters.loyaltyProgramId = programId;
    }

    const rewards = await prisma.loyaltyReward.findMany({
      where: filters,
      include: {
        program: true
      },
      orderBy: { pointsRequired: 'asc' }
    });

    // Add availability status
    const enrichedRewards = await Promise.all(rewards.map(async (reward) => {
      const userLoyalty = await prisma.userLoyaltyProgram.findFirst({
        where: {
          userId: req.user.id,
          loyaltyProgramId: reward.loyaltyProgramId
        }
      });

      return {
        ...reward,
        available: userLoyalty && userLoyalty.points >= reward.pointsRequired,
        userPoints: userLoyalty?.points || 0
      };
    }));

    res.json({
      success: true,
      data: enrichedRewards
    });
  } catch (error) {
    logger.logWithContext('error', 'Error getting rewards', {
      correlationId: req.correlationId,
      error: error.message
    });
    res.status(500).json({ error: 'Failed to get rewards' });
  }
});

// Redeem reward endpoint
app.post('/api/rewards/:rewardId/redeem', authenticate, requireRider, async (req, res) => {
  try {
    const { rewardId } = req.params;

    const reward = await prisma.loyaltyReward.findUnique({
      where: { id: rewardId },
      include: { program: true }
    });

    if (!reward || !reward.isActive) {
      return res.status(404).json({ error: 'Reward not found or inactive' });
    }

    // Check if user has enough points
    const userLoyalty = await prisma.userLoyaltyProgram.findFirst({
      where: {
        userId: req.user.id,
        loyaltyProgramId: reward.loyaltyProgramId
      }
    });

    if (!userLoyalty || userLoyalty.points < reward.pointsRequired) {
      return res.status(400).json({ error: 'Insufficient points to redeem reward' });
    }

    // Check if reward has remaining redemptions
    if (reward.remainingRedemptions !== null && reward.remainingRedemptions <= 0) {
      return res.status(400).json({ error: 'Reward is no longer available' });
    }

    // Begin transaction
    const result = await prisma.$transaction(async (tx) => {
      // Deduct points from user
      const updatedUserLoyalty = await tx.userLoyaltyProgram.update({
        where: {
          userId_loyaltyProgramId: {
            userId: req.user.id,
            loyaltyProgramId: reward.loyaltyProgramId
          }
        },
        data: {
          points: { decrement: reward.pointsRequired },
          totalEarnedPoints: { decrement: 0 } // Don't decrement total earned
        }
      });

      // Create redemption record
      const redemption = await tx.loyaltyRewardRedemption.create({
        data: {
          userId: req.user.id,
          rewardId,
          pointsUsed: reward.pointsRequired,
          status: 'COMPLETED'
        }
      });

      // Update reward remaining redemptions if applicable
      if (reward.remainingRedemptions !== null) {
        await tx.loyaltyReward.update({
          where: { id: rewardId },
          data: {
            remainingRedemptions: { decrement: 1 }
          }
        });
      }

      // Create point transaction record
      await tx.loyaltyPointTransaction.create({
        data: {
          userId: req.user.id,
          transactionType: 'REDEEMED',
          points: -reward.pointsRequired,
          reason: `Redeemed reward: ${reward.name}`,
          relatedEntity: 'LOYALTY_REWARD',
          relatedEntityId: rewardId,
          balanceAfter: updatedUserLoyalty.points
        }
      });

      return {
        updatedUserLoyalty,
        redemption,
        reward
      };
    });

    logger.logWithContext('info', 'Reward redeemed successfully', {
      correlationId: req.correlationId,
      userId: req.user.id,
      rewardId,
      pointsUsed: reward.pointsRequired
    });

    res.json({
      success: true,
      data: {
        redemption: result.redemption,
        newBalance: result.updatedUserLoyalty.points
      }
    });
  } catch (error) {
    logger.logWithContext('error', 'Error redeeming reward', {
      correlationId: req.correlationId,
      error: error.message,
      rewardId: req.params.rewardId
    });
    res.status(500).json({ error: 'Failed to redeem reward' });
  }
});

// Get user's redemption history endpoint
app.get('/api/redemptions', authenticate, async (req, res) => {
  try {
    const { limit = 20, offset = 0 } = req.query;

    const redemptions = await prisma.loyaltyRewardRedemption.findMany({
      where: { userId: req.user.id },
      include: {
        reward: {
          include: { program: true }
        }
      },
      orderBy: { redemptionDate: 'desc' },
      take: parseInt(limit),
      skip: parseInt(offset)
    });

    const totalCount = await prisma.loyaltyRewardRedemption.count({
      where: { userId: req.user.id }
    });

    res.json({
      success: true,
      data: {
        redemptions,
        pagination: {
          limit: parseInt(limit),
          offset: parseInt(offset),
          total: totalCount
        }
      }
    });
  } catch (error) {
    logger.logWithContext('error', 'Error getting redemption history', {
      correlationId: req.correlationId,
      error: error.message,
      userId: req.user.id
    });
    res.status(500).json({ error: 'Failed to get redemption history' });
  }
});

// Get user's point transaction history endpoint
app.get('/api/points/history', authenticate, async (req, res) => {
  try {
    const { limit = 20, offset = 0, type } = req.query;

    const filters = { userId: req.user.id };
    if (type) filters.transactionType = type;

    const transactions = await prisma.loyaltyPointTransaction.findMany({
      where: filters,
      orderBy: { createdAt: 'desc' },
      take: parseInt(limit),
      skip: parseInt(offset)
    });

    const totalCount = await prisma.loyaltyPointTransaction.count({
      where: filters
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
    logger.logWithContext('error', 'Error getting point transaction history', {
      correlationId: req.correlationId,
      error: error.message,
      userId: req.user.id
    });
    res.status(500).json({ error: 'Failed to get point transaction history' });
  }
});

// Earn points for completed trip endpoint (internal use)
app.post('/api/trips/:tripId/earn-points', authenticate, async (req, res) => {
  try {
    // Only internal services should call this endpoint
    const { tripId } = req.params;
    const { points, reason } = req.body;

    const trip = await prisma.trip.findUnique({
      where: { id: tripId },
      include: { rider: true }
    });

    if (!trip) {
      return res.status(404).json({ error: 'Trip not found' });
    }

    if (trip.status !== 'COMPLETED') {
      return res.status(400).json({ error: 'Trip must be completed to earn points' });
    }

    // Get or create user loyalty profile
    let userLoyalty = await prisma.userLoyaltyProgram.findFirst({
      where: {
        userId: trip.riderId,
        loyaltyProgramId: 'default-program' // Using default program for now
      }
    });

    if (!userLoyalty) {
      // Create user in default loyalty program
      const defaultProgram = await prisma.loyaltyProgram.findFirst({
        where: { name: 'Default Loyalty Program' }
      });

      if (!defaultProgram) {
        // Create default program if it doesn't exist
        const program = await prisma.loyaltyProgram.create({
          data: {
            name: 'Default Loyalty Program',
            description: 'Default loyalty program for all users',
            isActive: true,
            startDate: new Date()
          }
        });

        const tiers = await Promise.all([
          prisma.loyaltyTier.create({
            data: {
              name: 'BRONZE',
              minPoints: 0,
              benefits: { discountPercent: 5 },
              discountPercent: 5,
              program: { connect: { id: program.id } }
            }
          }),
          prisma.loyaltyTier.create({
            data: {
              name: 'SILVER',
              minPoints: 500,
              benefits: { discountPercent: 10 },
              discountPercent: 10,
              program: { connect: { id: program.id } }
            }
          }),
          prisma.loyaltyTier.create({
            data: {
              name: 'GOLD',
              minPoints: 1500,
              benefits: { discountPercent: 15, prioritySupport: true },
              discountPercent: 15,
              prioritySupport: true,
              program: { connect: { id: program.id } }
            }
          }),
          prisma.loyaltyTier.create({
            data: {
              name: 'PLATINUM',
              minPoints: 3000,
              benefits: { discountPercent: 20, prioritySupport: true, freeDelivery: true },
              discountPercent: 20,
              prioritySupport: true,
              program: { connect: { id: program.id } }
            }
          })
        ]);

        userLoyalty = await prisma.userLoyaltyProgram.create({
          data: {
            userId: trip.riderId,
            loyaltyProgramId: program.id,
            currentTierId: tiers[0].id, // Bronze by default
            points: 0,
            totalEarnedPoints: 0
          }
        });
      } else {
        userLoyalty = await prisma.userLoyaltyProgram.create({
          data: {
            userId: trip.riderId,
            loyaltyProgramId: defaultProgram.id,
            currentTierId: (await prisma.loyaltyTier.findFirst({
              where: { loyaltyProgramId: defaultProgram.id },
              orderBy: { minPoints: 'asc' }
            })).id,
            points: 0,
            totalEarnedPoints: 0
          }
        });
      }
    }

    // Add points to user
    const result = await prisma.$transaction(async (tx) => {
      // Update user's points
      const updatedUserLoyalty = await tx.userLoyaltyProgram.update({
        where: {
          userId_loyaltyProgramId: {
            userId: trip.riderId,
            loyaltyProgramId: userLoyalty.loyaltyProgramId
          }
        },
        data: {
          points: { increment: points },
          totalEarnedPoints: { increment: points }
        },
        include: {
          currentTier: true,
          loyaltyProgram: true
        }
      });

      // Check if user qualifies for a new tier
      const allTiers = await tx.loyaltyTier.findMany({
        where: { loyaltyProgramId: userLoyalty.loyaltyProgramId },
        orderBy: { minPoints: 'desc' }
      });

      let newTier = allTiers[0]; // Start with highest tier
      for (const tier of allTiers) {
        if (updatedUserLoyalty.points >= tier.minPoints) {
          newTier = tier;
          break;
        }
      }

      // Update tier if different
      if (newTier.id !== updatedUserLoyalty.currentTierId) {
        await tx.userLoyaltyProgram.update({
          where: {
            userId_loyaltyProgramId: {
              userId: trip.riderId,
              loyaltyProgramId: userLoyalty.loyaltyProgramId
            }
          },
          data: { currentTierId: newTier.id }
        });

        // Notify user about tier upgrade
        try {
          await axios.post(`${config.services.notificationServiceUrl}/api/notifications/send`, {
            recipient: trip.riderId,
            type: 'TIER_UPGRADE',
            message: `Congratulations! You've been upgraded to ${newTier.name} tier with ${newTier.benefits.discountPercent}% discount benefit.`,
            priority: 'HIGH'
          }, {
            headers: {
              'Authorization': req.headers.authorization,
              'X-Correlation-ID': req.correlationId
            }
          });
        } catch (notificationError) {
          logger.logWithContext('warn', 'Failed to send tier upgrade notification', {
            correlationId: req.correlationId,
            error: notificationError.message,
            userId: trip.riderId
          });
        }
      }

      // Create point transaction record
      await tx.loyaltyPointTransaction.create({
        data: {
          userId: trip.riderId,
          transactionType: 'EARNED',
          points,
          reason: reason || 'Completed trip',
          relatedEntity: 'TRIP',
          relatedEntityId: tripId,
          balanceAfter: updatedUserLoyalty.points
        }
      });

      return updatedUserLoyalty;
    });

    logger.logWithContext('info', 'Points awarded for trip', {
      correlationId: req.correlationId,
      tripId,
      userId: trip.riderId,
      pointsAwarded: points
    });

    res.json({
      success: true,
      data: {
        newBalance: result.points,
        tierUpgraded: result.currentTierId !== userLoyalty.currentTierId
      }
    });
  } catch (error) {
    logger.logWithContext('error', 'Error awarding points for trip', {
      correlationId: req.correlationId,
      error: error.message,
      tripId: req.params.tripId
    });
    res.status(500).json({ error: 'Failed to award points for trip' });
  }
});

// Get active referral programs endpoint
app.get('/api/referrals/programs', authenticate, async (req, res) => {
  try {
    const programs = await prisma.referralProgram.findMany({
      where: { isActive: true },
      orderBy: { startDate: 'desc' }
    });

    res.json({
      success: true,
      data: programs
    });
  } catch (error) {
    logger.logWithContext('error', 'Error getting referral programs', {
      correlationId: req.correlationId,
      error: error.message
    });
    res.status(500).json({ error: 'Failed to get referral programs' });
  }
});

// Create referral endpoint
app.post('/api/referrals', authenticate, async (req, res) => {
  try {
    const { refereePhone, programId } = req.body;

    // Find the referral program
    const program = await prisma.referralProgram.findUnique({
      where: { id: programId }
    });

    if (!program || !program.isActive) {
      return res.status(404).json({ error: 'Referral program not found or inactive' });
    }

    // Find referee by phone
    const referee = await prisma.user.findUnique({
      where: { phone: refereePhone }
    });

    if (!referee) {
      return res.status(404).json({ error: 'Referee user not found' });
    }

    // Check if referral already exists
    const existingReferral = await prisma.referral.findFirst({
      where: {
        referrerId: req.user.id,
        refereeId: referee.id
      }
    });

    if (existingReferral) {
      return res.status(400).json({ error: 'Referral already exists' });
    }

    // Create referral
    const referral = await prisma.referral.create({
      data: {
        referrerId: req.user.id,
        refereeId: referee.id,
        programId,
        status: 'PENDING'
      }
    });

    // Send notification to referee
    try {
      await axios.post(`${config.services.notificationServiceUrl}/api/notifications/send`, {
        recipient: referee.id,
        type: 'REFERRAL_RECEIVED',
        message: `You've been referred by ${req.user.name}. Sign up now to claim your ${program.rewardValue} ${program.rewardType} reward!`,
        priority: 'HIGH'
      }, {
        headers: {
          'Authorization': req.headers.authorization,
          'X-Correlation-ID': req.correlationId
        }
      });
    } catch (notificationError) {
      logger.logWithContext('warn', 'Failed to send referral notification', {
        correlationId: req.correlationId,
        error: notificationError.message,
        refereeId: referee.id
      });
    }

    logger.logWithContext('info', 'Referral created', {
      correlationId: req.correlationId,
      referrerId: req.user.id,
      refereeId: referee.id,
      programId
    });

    res.json({
      success: true,
      data: referral
    });
  } catch (error) {
    logger.logWithContext('error', 'Error creating referral', {
      correlationId: req.correlationId,
      error: error.message
    });
    res.status(500).json({ error: 'Failed to create referral' });
  }
});

// Get user's referrals endpoint
app.get('/api/referrals', authenticate, async (req, res) => {
  try {
    const { status } = req.query;

    const filters = {
      OR: [
        { referrerId: req.user.id },
        { refereeId: req.user.id }
      ]
    };

    if (status) {
      filters.status = status;
    }

    const referrals = await prisma.referral.findMany({
      where: filters,
      include: {
        referrer: { select: { name: true, phone: true } },
        referee: { select: { name: true, phone: true } },
        program: true
      },
      orderBy: { createdAt: 'desc' }
    });

    res.json({
      success: true,
      data: referrals
    });
  } catch (error) {
    logger.logWithContext('error', 'Error getting referrals', {
      correlationId: req.correlationId,
      error: error.message,
      userId: req.user.id
    });
    res.status(500).json({ error: 'Failed to get referrals' });
  }
});

// Claim referral reward endpoint
app.post('/api/referrals/:referralId/claim', authenticate, async (req, res) => {
  try {
    const { referralId } = req.params;

    const referral = await prisma.referral.findUnique({
      where: { id: referralId },
      include: { program: true }
    });

    if (!referral) {
      return res.status(404).json({ error: 'Referral not found' });
    }

    // Check if the current user is the referee
    if (referral.refereeId !== req.user.id) {
      return res.status(403).json({ error: 'Only the referee can claim this reward' });
    }

    if (referral.status !== 'PENDING') {
      return res.status(400).json({ error: 'Referral is not eligible for reward' });
    }

    // Update referral status
    const updatedReferral = await prisma.referral.update({
      where: { id: referralId },
      data: {
        status: 'COMPLETED',
        completedAt: new Date(),
        rewardGiven: true
      }
    });

    // Award points/money to both referrer and referee
    if (referral.program.rewardType === 'POINTS') {
      // Award points to both users
      await Promise.all([
        // Award to referrer
        awardPoints(referral.referrerId, referral.program.rewardValue, 'Referral bonus'),
        // Award to referee
        awardPoints(referral.refereeId, referral.program.rewardValue, 'Referral signup bonus')
      ]);
    }

    logger.logWithContext('info', 'Referral reward claimed', {
      correlationId: req.correlationId,
      referralId,
      referrerId: referral.referrerId,
      refereeId: referral.refereeId
    });

    res.json({
      success: true,
      data: updatedReferral
    });
  } catch (error) {
    logger.logWithContext('error', 'Error claiming referral reward', {
      correlationId: req.correlationId,
      error: error.message,
      referralId: req.params.referralId
    });
    res.status(500).json({ error: 'Failed to claim referral reward' });
  }
});

// Helper function to award points
async function awardPoints(userId, points, reason) {
  try {
    // Get user's loyalty profile
    let userLoyalty = await prisma.userLoyaltyProgram.findFirst({
      where: {
        userId,
        isActive: true
      }
    });

    if (!userLoyalty) {
      // Create user in default loyalty program if not exists
      const defaultProgram = await prisma.loyaltyProgram.findFirst({
        where: { name: 'Default Loyalty Program' }
      });

      if (defaultProgram) {
        userLoyalty = await prisma.userLoyaltyProgram.create({
          data: {
            userId,
            loyaltyProgramId: defaultProgram.id,
            currentTierId: (await prisma.loyaltyTier.findFirst({
              where: { loyaltyProgramId: defaultProgram.id },
              orderBy: { minPoints: 'asc' }
            })).id,
            points: 0,
            totalEarnedPoints: 0
          }
        });
      } else {
        // If no default program exists, return without awarding points
        return;
      }
    }

    // Update user's points
    const updatedUserLoyalty = await prisma.userLoyaltyProgram.update({
      where: {
        userId_loyaltyProgramId: {
          userId,
          loyaltyProgramId: userLoyalty.loyaltyProgramId
        }
      },
      data: {
        points: { increment: points },
        totalEarnedPoints: { increment: points }
      }
    });

    // Create point transaction record
    await prisma.loyaltyPointTransaction.create({
      data: {
        userId,
        transactionType: 'EARNED',
        points,
        reason,
        relatedEntity: 'REFERRAL',
        relatedEntityId: userLoyalty.id,
        balanceAfter: updatedUserLoyalty.points
      }
    });
  } catch (error) {
    logger.logWithContext('error', 'Error awarding points', {
      userId,
      points,
      reason,
      error: error.message
    });
  }
}

// Global error handler
app.use((err, req, res, next) => {
  logger.logWithContext('error', 'Loyalty service error occurred', {
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
const PORT = process.env.PORT || 5010;
app.listen(PORT, () => {
  logger.logWithContext('info', `Loyalty service running`, {
    port: PORT,
    environment: config.environment,
    timestamp: new Date().toISOString()
  });
});

export default app;
