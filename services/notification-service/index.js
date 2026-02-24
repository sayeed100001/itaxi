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
const hasNotificationModel = () => Boolean(prisma.notification?.findMany);
const hasNotificationSettingsModel = () => Boolean(prisma.notificationSetting?.findUnique);

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
const notificationLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many notification requests, please try again later',
  standardHeaders: true,
  legacyHeaders: false,
});

// Add correlation ID middleware
app.use(addCorrelationId);

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'OK',
    service: 'Notification Service',
    timestamp: new Date().toISOString(),
    correlationId: req.correlationId
  });
});

// Metrics endpoint
app.get('/metrics', async (req, res) => {
  try {
    const sentNotifications = hasNotificationModel()
      ? await prisma.notification.count({ where: { status: 'DELIVERED' } })
      : await prisma.rideNotification.count({ where: { status: 'SENT' } });

    res.status(200).json({
      status: 'OK',
      service: 'Notification Service',
      metrics: {
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        sentNotifications,
        timestamp: new Date().toISOString()
      },
      correlationId: req.correlationId
    });
  } catch (error) {
    logger.logWithContext('error', 'Failed to build notification metrics', {
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
      logger.logWithContext('error', 'Notification service not ready', {
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

// Send notification endpoint
app.post('/api/notifications/send', authenticate, notificationLimiter, async (req, res) => {
  try {
    const { recipient, type, message, tripId, priority = 'NORMAL' } = req.body;

    if (!recipient || !type || !message) {
      return res.status(400).json({ error: 'Recipient, type, and message are required' });
    }

    // Find recipient user
    const user = await prisma.user.findUnique({
      where: { id: recipient }
    });

    if (!user) {
      return res.status(404).json({ error: 'Recipient not found' });
    }

    // Persist notification in database.
    let notification;
    if (hasNotificationModel()) {
      notification = await prisma.notification.create({
        data: {
          userId: user.id,
          type,
          message,
          tripId,
          priority,
          status: 'PENDING'
        }
      });
    } else {
      // Fallback path for deployments that only have ride notifications schema.
      const driver = await prisma.driver.findUnique({
        where: { userId: user.id }
      });

      if (!tripId || !driver) {
        return res.status(503).json({
          error: 'Notification storage model is not configured for generic notifications'
        });
      }

      notification = await prisma.rideNotification.create({
        data: {
          tripId,
          driverId: driver.id,
          status: 'PENDING'
        }
      });
    }

    // Attempt to send notification via multiple channels
    const results = await Promise.allSettled([
      // Push notification (would connect to FCM/APNs in real implementation)
      sendPushNotification(user, notification),
      
      // WhatsApp notification
      sendWhatsAppNotification(user, notification),
      
      // Email notification (if email exists)
      user.email ? sendEmailNotification(user, notification) : Promise.resolve({ skipped: 'No email' })
    ]);

    // Update notification status based on results
    const successfulChannels = results.filter(result => 
      result.status === 'fulfilled' && !result.value.skipped
    ).length;

    const newStatus = successfulChannels > 0 ? 'DELIVERED' : 'FAILED';

    if (hasNotificationModel()) {
      await prisma.notification.update({
        where: { id: notification.id },
        data: { status: newStatus }
      });
    } else if (prisma.rideNotification?.update) {
      await prisma.rideNotification.update({
        where: { id: notification.id },
        data: {
          status: newStatus === 'DELIVERED' ? 'SENT' : 'FAILED',
          sentAt: newStatus === 'DELIVERED' ? new Date() : null,
          error: newStatus === 'DELIVERED' ? null : 'DELIVERY_FAILED'
        }
      });
    }

    logger.logWithContext('info', 'Notification sent', {
      correlationId: req.correlationId,
      notificationId: notification.id,
      recipient: user.id,
      type,
      channelsAttempted: results.length,
      channelsSuccessful: successfulChannels
    });

    res.json({
      success: true,
      data: {
        notificationId: notification.id,
        status: newStatus,
        channels: results.map((result, index) => ({
          channel: ['push', 'whatsapp', 'email'][index],
          success: result.status === 'fulfilled' && !result.value?.skipped,
          error: result.status === 'rejected' ? result.reason : undefined
        }))
      }
    });
  } catch (error) {
    logger.logWithContext('error', 'Error sending notification', {
      correlationId: req.correlationId,
      error: error.message
    });
    res.status(500).json({ error: 'Failed to send notification' });
  }
});

// Get user notifications endpoint
app.get('/api/notifications', authenticate, async (req, res) => {
  try {
    const { limit = 20, offset = 0, type, status } = req.query;

    let notifications = [];
    let totalCount = 0;

    if (hasNotificationModel()) {
      const filters = {
        userId: req.user.id
      };

      if (type) filters.type = type;
      if (status) filters.status = status;

      notifications = await prisma.notification.findMany({
        where: filters,
        orderBy: { createdAt: 'desc' },
        take: parseInt(limit),
        skip: parseInt(offset)
      });

      totalCount = await prisma.notification.count({
        where: filters
      });
    } else {
      const driver = await prisma.driver.findUnique({
        where: { userId: req.user.id }
      });

      if (driver) {
        notifications = await prisma.rideNotification.findMany({
          where: {
            driverId: driver.id,
            ...(status ? { status } : {})
          },
          orderBy: { createdAt: 'desc' },
          take: parseInt(limit),
          skip: parseInt(offset),
          include: { trip: true }
        });

        totalCount = await prisma.rideNotification.count({
          where: {
            driverId: driver.id,
            ...(status ? { status } : {})
          }
        });
      }
    }

    res.json({
      success: true,
      data: {
        notifications,
        pagination: {
          limit: parseInt(limit),
          offset: parseInt(offset),
          total: totalCount
        }
      }
    });
  } catch (error) {
    logger.logWithContext('error', 'Error getting notifications', {
      correlationId: req.correlationId,
      error: error.message,
      userId: req.user.id
    });
    res.status(500).json({ error: 'Failed to get notifications' });
  }
});

// Compatibility endpoint used by integration tests
app.get('/api/user/:userId', authenticate, async (req, res) => {
  try {
    const { userId } = req.params;

    if (hasNotificationModel()) {
      const notifications = await prisma.notification.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: 50
      });
      return res.json({ success: true, data: notifications });
    }

    const driver = await prisma.driver.findUnique({
      where: { userId }
    });

    if (!driver) {
      return res.json({ success: true, data: [] });
    }

    const offers = await prisma.rideNotification.findMany({
      where: { driverId: driver.id },
      orderBy: { createdAt: 'desc' },
      take: 50,
      include: { trip: true }
    });

    return res.json({ success: true, data: offers });
  } catch (error) {
    logger.logWithContext('error', 'Error getting user notifications by userId', {
      correlationId: req.correlationId,
      error: error.message,
      userId: req.params.userId
    });
    res.status(500).json({ error: 'Failed to get user notifications' });
  }
});

// Mark notification as read endpoint
app.patch('/api/notifications/:id/read', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    if (!hasNotificationModel()) {
      return res.status(503).json({
        error: 'Read/unread notifications requires Notification model'
      });
    }

    const notification = await prisma.notification.findUnique({
      where: { id }
    });

    if (!notification) {
      return res.status(404).json({ error: 'Notification not found' });
    }

    if (notification.userId !== req.user.id) {
      return res.status(403).json({ error: 'Forbidden: Not your notification' });
    }

    const updatedNotification = await prisma.notification.update({
      where: { id },
      data: { readAt: new Date(), status: 'READ' }
    });

    res.json({
      success: true,
      data: updatedNotification
    });
  } catch (error) {
    logger.logWithContext('error', 'Error marking notification as read', {
      correlationId: req.correlationId,
      error: error.message,
      notificationId: req.params.id
    });
    res.status(500).json({ error: 'Failed to mark notification as read' });
  }
});

// Bulk notification endpoint
app.post('/api/notifications/bulk-send', authenticate, async (req, res) => {
  try {
    // Only admin can send bulk notifications
    if (req.user.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const { recipients, type, message, priority = 'NORMAL' } = req.body;

    if (!recipients || !Array.isArray(recipients) || recipients.length === 0) {
      return res.status(400).json({ error: 'Recipients array is required' });
    }

    if (!type || !message) {
      return res.status(400).json({ error: 'Type and message are required' });
    }

    if (!hasNotificationModel()) {
      return res.status(503).json({
        error: 'Bulk notifications require Notification model'
      });
    }

    // Create notifications for all recipients
    const notifications = [];
    for (const recipientId of recipients) {
      const notification = await prisma.notification.create({
        data: {
          userId: recipientId,
          type,
          message,
          priority,
          status: 'PENDING'
        }
      });
      notifications.push(notification);
    }

    // Process notifications asynchronously
    const processPromises = notifications.map(notification => 
      processNotification(notification)
    );

    await Promise.allSettled(processPromises);

    logger.logWithContext('info', 'Bulk notifications sent', {
      correlationId: req.correlationId,
      count: notifications.length,
      type,
      sender: req.user.id
    });

    res.json({
      success: true,
      data: {
        sentCount: notifications.length,
        notifications: notifications.map(n => ({ id: n.id, userId: n.userId }))
      }
    });
  } catch (error) {
    logger.logWithContext('error', 'Error sending bulk notifications', {
      correlationId: req.correlationId,
      error: error.message
    });
    res.status(500).json({ error: 'Failed to send bulk notifications' });
  }
});

// Get notification settings endpoint
app.get('/api/settings', authenticate, async (req, res) => {
  try {
    if (!hasNotificationSettingsModel()) {
      return res.json({
        success: true,
        data: {
          userId: req.user.id,
          pushEnabled: false,
          whatsappEnabled: true,
          emailEnabled: false,
          smsEnabled: false,
          notificationTypes: {
            TRIP_UPDATES: true,
            PROMOTIONS: false,
            SYSTEM_ALERTS: true,
            MESSAGES: true
          }
        }
      });
    }

    const settings = await prisma.notificationSetting.findUnique({
      where: { userId: req.user.id }
    });

    if (!settings) {
      // Return default settings
      res.json({
        success: true,
        data: {
          userId: req.user.id,
          pushEnabled: true,
          whatsappEnabled: true,
          emailEnabled: !!req.user.email,
          smsEnabled: true,
          notificationTypes: {
            TRIP_UPDATES: true,
            PROMOTIONS: true,
            SYSTEM_ALERTS: true,
            MESSAGES: true
          }
        }
      });
      return;
    }

    res.json({
      success: true,
      data: settings
    });
  } catch (error) {
    logger.logWithContext('error', 'Error getting notification settings', {
      correlationId: req.correlationId,
      error: error.message,
      userId: req.user.id
    });
    res.status(500).json({ error: 'Failed to get notification settings' });
  }
});

// Update notification settings endpoint
app.put('/api/settings', authenticate, async (req, res) => {
  try {
    const settingsData = req.body;
    if (!hasNotificationSettingsModel()) {
      return res.status(503).json({
        error: 'Notification settings model is not configured'
      });
    }

    const settings = await prisma.notificationSetting.upsert({
      where: { userId: req.user.id },
      update: settingsData,
      create: { userId: req.user.id, ...settingsData }
    });

    res.json({
      success: true,
      data: settings
    });
  } catch (error) {
    logger.logWithContext('error', 'Error updating notification settings', {
      correlationId: req.correlationId,
      error: error.message,
      userId: req.user.id
    });
    res.status(500).json({ error: 'Failed to update notification settings' });
  }
});

// Helper function to send push notification
async function sendPushNotification(user, notification) {
  // No fake push delivery. Skip unless a real provider integration is configured.
  return { skipped: 'Push provider not configured' };
}

// Helper function to send WhatsApp notification
async function sendWhatsAppNotification(user, notification) {
  if (!config.whatsapp.accessToken || !user.phone) {
    return { skipped: 'WhatsApp not configured or no phone number' };
  }

  try {
    const response = await axios.post(
      `https://graph.facebook.com/v18.0/${config.whatsapp.phoneNumberId}/messages`,
      {
        messaging_product: 'whatsapp',
        to: user.phone,
        type: 'text',
        text: { body: notification.message }
      },
      {
        headers: {
          Authorization: `Bearer ${config.whatsapp.accessToken}`,
          'Content-Type': 'application/json',
        },
        timeout: 10000,
      }
    );

    logger.logWithContext('info', 'WhatsApp notification sent', {
      userId: user.id,
      notificationId: notification.id,
      messageId: response.data.messages?.[0]?.id
    });

    return { success: true, channel: 'whatsapp', messageId: response.data.messages?.[0]?.id };
  } catch (error) {
    logger.logWithContext('error', 'Failed to send WhatsApp notification', {
      userId: user.id,
      notificationId: notification.id,
      error: error.message
    });
    
    return { success: false, channel: 'whatsapp', error: error.message };
  }
}

// Helper function to send email notification
async function sendEmailNotification(user, notification) {
  // No fake email delivery. Skip unless a real provider integration is configured.
  return { skipped: 'Email provider not configured' };
}

// Helper function to process a single notification
async function processNotification(notification) {
  try {
    const user = await prisma.user.findUnique({
      where: { id: notification.userId }
    });

    if (!user) {
      throw new Error('User not found');
    }

    // Get user's notification settings
    const settings = hasNotificationSettingsModel()
      ? (await prisma.notificationSetting.findUnique({
          where: { userId: user.id }
        }) || {
          pushEnabled: false,
          whatsappEnabled: true,
          emailEnabled: false,
          smsEnabled: false
        })
      : {
          pushEnabled: false,
          whatsappEnabled: true,
          emailEnabled: false,
          smsEnabled: false
        };

    // Determine which channels to use based on settings and notification type
    const channelsToSend = [];
    
    if (settings.pushEnabled) {
      channelsToSend.push(sendPushNotification(user, notification));
    }
    
    if (settings.whatsappEnabled && user.phone) {
      channelsToSend.push(sendWhatsAppNotification(user, notification));
    }
    
    if (settings.emailEnabled && user.email) {
      channelsToSend.push(sendEmailNotification(user, notification));
    }

    // Execute all channels
    const results = await Promise.allSettled(channelsToSend);
    
    // Update notification status
    const successfulChannels = results.filter(result => result.status === 'fulfilled').length;
    const newStatus = successfulChannels > 0 ? 'DELIVERED' : 'FAILED';

    if (hasNotificationModel()) {
      await prisma.notification.update({
        where: { id: notification.id },
        data: { status: newStatus }
      });
    } else if (prisma.rideNotification?.update) {
      await prisma.rideNotification.update({
        where: { id: notification.id },
        data: {
          status: newStatus === 'DELIVERED' ? 'SENT' : 'FAILED',
          error: newStatus === 'DELIVERED' ? null : 'DELIVERY_FAILED'
        }
      });
    }

    return { notificationId: notification.id, status: newStatus, channels: results.length };
  } catch (error) {
    logger.logWithContext('error', 'Error processing notification', {
      notificationId: notification.id,
      error: error.message
    });

    // Update notification status as failed
    if (hasNotificationModel()) {
      await prisma.notification.update({
        where: { id: notification.id },
        data: { status: 'FAILED' }
      });
    } else if (prisma.rideNotification?.update) {
      await prisma.rideNotification.update({
        where: { id: notification.id },
        data: { status: 'FAILED', error: error.message }
      });
    }

    throw error;
  }
}

// Global error handler
app.use((err, req, res, next) => {
  logger.logWithContext('error', 'Notification service error occurred', {
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
const PORT = process.env.PORT || 5006;
app.listen(PORT, () => {
  logger.logWithContext('info', `Notification service running`, {
    port: PORT,
    environment: config.environment,
    timestamp: new Date().toISOString()
  });
});

export default app;
