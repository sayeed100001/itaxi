import { createClient } from 'redis';
import prisma from '../config/database';
import { WhatsAppService } from './whatsapp.service';
import logger from '../config/logger';

const REDIS_URL = process.env.REDIS_URL;
const MAX_RETRIES = 3;
const RATE_LIMIT_PER_PHONE = 20; // per hour
const RATE_LIMIT_GLOBAL = 100; // per hour

interface NotificationJob {
  id: string;
  tripId: string;
  driverId: string;
  phone: string;
  pickupAddress: string;
  distance: number;
  fare: number;
  retries: number;
}

class NotificationService {
  private whatsappService: WhatsAppService;
  private redisClient: ReturnType<typeof createClient> | null = null;
  private jobQueue: NotificationJob[] = [];
  private processing = false;

  constructor() {
    this.whatsappService = new WhatsAppService();
    
    if (REDIS_URL) {
      this.redisClient = createClient({ url: REDIS_URL });
      this.redisClient.connect().catch((err) => {
        logger.error('Redis connection failed, using in-memory queue', { error: err });
        this.redisClient = null;
      });
    }

    this.startProcessor();
  }

  async queueRideNotification(
    tripId: string,
    driverId: string,
    phone: string,
    pickupAddress: string,
    distance: number,
    fare: number
  ): Promise<string> {
    // Check rate limits
    if (!(await this.checkRateLimits(phone))) {
      logger.warn('Rate limit exceeded', { phone });
      throw new Error('Rate limit exceeded');
    }

    // Create notification record
    const notification = await prisma.rideNotification.create({
      data: {
        tripId,
        driverId,
        status: 'PENDING',
      },
    });

    const job: NotificationJob = {
      id: notification.id,
      tripId,
      driverId,
      phone,
      pickupAddress,
      distance,
      fare,
      retries: 0,
    };

    if (this.redisClient?.isOpen) {
      await this.redisClient.rPush('notification:queue', JSON.stringify(job));
    } else {
      this.jobQueue.push(job);
    }

    logger.info('Notification queued', { notificationId: notification.id, tripId });
    return notification.id;
  }

  private async checkRateLimits(phone: string): Promise<boolean> {
    const oneHourAgo = new Date(Date.now() - 3600 * 1000);

    if (this.redisClient?.isOpen) {
      // Redis rate limiting
      const phoneKey = `rate:phone:${phone}`;
      const globalKey = 'rate:global';

      const [phoneCount, globalCount] = await Promise.all([
        this.redisClient.incr(phoneKey),
        this.redisClient.incr(globalKey),
      ]);

      if (phoneCount === 1) await this.redisClient.expire(phoneKey, 3600);
      if (globalCount === 1) await this.redisClient.expire(globalKey, 3600);

      return phoneCount <= RATE_LIMIT_PER_PHONE && globalCount <= RATE_LIMIT_GLOBAL;
    } else {
      // DB fallback rate limiting
      const [phoneCount, globalCount] = await Promise.all([
        prisma.rideNotification.count({
          where: {
            driver: { whatsappNumber: phone },
            sentAt: { gte: oneHourAgo },
          },
        }),
        prisma.rideNotification.count({
          where: { sentAt: { gte: oneHourAgo } },
        }),
      ]);

      return phoneCount < RATE_LIMIT_PER_PHONE && globalCount < RATE_LIMIT_GLOBAL;
    }
  }

  private startProcessor() {
    setInterval(() => this.processQueue(), 1000);
  }

  private async processQueue() {
    if (this.processing) return;
    this.processing = true;

    try {
      let job: NotificationJob | null = null;

      if (this.redisClient?.isOpen) {
        const data = await this.redisClient.lPop('notification:queue');
        if (data) job = JSON.parse(data);
      } else if (this.jobQueue.length > 0) {
        job = this.jobQueue.shift()!;
      }

      if (job) {
        await this.processJob(job);
      }
    } catch (error) {
      logger.error('Queue processor error', { error });
    } finally {
      this.processing = false;
    }
  }

  private async processJob(job: NotificationJob) {
    try {
      const messageId = await this.whatsappService.sendRideRequest(
        job.phone,
        job.tripId,
        job.driverId,
        job.pickupAddress,
        job.distance,
        job.fare,
        job.id
      );

      if (messageId) {
        await prisma.rideNotification.update({
          where: { id: job.id },
          data: {
            status: 'SENT',
            messageId,
            retries: job.retries,
            sentAt: new Date(),
          },
        });
        logger.info('Notification sent successfully', { notificationId: job.id });
      } else {
        throw new Error('No messageId returned');
      }
    } catch (error: any) {
      await this.handleFailure(job, error);
    }
  }

  private async handleFailure(job: NotificationJob, error: any) {
    const retries = job.retries + 1;

    if (retries < MAX_RETRIES) {
      // Exponential backoff: 2^retries seconds
      const delay = Math.pow(2, retries) * 1000;
      
      logger.warn('Notification failed, retrying', {
        notificationId: job.id,
        retries,
        delay,
      });

      setTimeout(async () => {
        job.retries = retries;
        
        if (this.redisClient?.isOpen) {
          await this.redisClient.rPush('notification:queue', JSON.stringify(job));
        } else {
          this.jobQueue.push(job);
        }
      }, delay);

      await prisma.rideNotification.update({
        where: { id: job.id },
        data: {
          retries,
          error: error.message,
        },
      });
    } else {
      // Max retries reached - mark as FAILED
      await prisma.rideNotification.update({
        where: { id: job.id },
        data: {
          status: 'FAILED',
          retries,
          error: error.message,
        },
      });

      // Create admin alert
      logger.error('Notification failed after max retries', {
        notificationId: job.id,
        tripId: job.tripId,
        driverId: job.driverId,
        error: error.message,
      });

      await prisma.auditLog.create({
        data: {
          action: 'RIDE_NOTIFICATION_FAILED',
          details: JSON.stringify({
            notificationId: job.id,
            tripId: job.tripId,
            driverId: job.driverId,
            error: error.message,
            retries,
          }),
        },
      });
    }
  }
}

export const notificationService = new NotificationService();
