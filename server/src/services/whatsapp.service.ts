import axios from 'axios';
import { config } from '../config/env';
import logger from '../config/logger';
import prisma from '../config/database';
import crypto from 'crypto';
import { apiConfigService } from './apiConfig.service';

const WHATSAPP_API_URL = 'https://graph.facebook.com/v18.0';

interface RetryJob {
  type: 'OTP' | 'RIDE_NOTIFICATION';
  data: any;
  attempts: number;
  nextRetry: Date;
}

const retryQueue: RetryJob[] = [];
const MAX_RETRIES = 3;
const BACKOFF_MS = [5000, 15000, 60000]; // 5s, 15s, 1min

export class WhatsAppService {
  private phoneNumberId: string;
  private accessToken: string;
  private appSecret: string;

  constructor() {
    this.phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID || '';
    this.accessToken = process.env.WHATSAPP_ACCESS_TOKEN || '';
    this.appSecret = process.env.WHATSAPP_APP_SECRET || '';
  }

  private async ensureConfigLoaded() {
    if (this.phoneNumberId && this.accessToken) {
      return;
    }
    const cfg = await apiConfigService.getWhatsAppConfig();
    if (cfg) {
      this.phoneNumberId = cfg.phoneNumberId || this.phoneNumberId;
      this.accessToken = cfg.accessToken || this.accessToken;
      this.appSecret = cfg.appSecret || this.appSecret;
    }
  }

  sanitizeInput(text: string): string {
    return text
      .replace(/[<>"'&]/g, '')
      .replace(/\n/g, ' ')
      .substring(0, 1000);
  }

  verifyWebhookSignature(payload: string, signature: string): boolean {
    if (!this.appSecret || !signature) return true;
    const expectedSignature = crypto
      .createHmac('sha256', this.appSecret)
      .update(payload)
      .digest('hex');
    return signature === `sha256=${expectedSignature}`;
  }

  async sendMessage(phone: string, text: string): Promise<string | null> {
    await this.ensureConfigLoaded();
    if (!this.phoneNumberId || !this.accessToken) {
      logger.error('WhatsApp credentials not configured');
      throw new Error('WhatsApp service not configured');
    }

    const body = this.sanitizeInput(text);

    try {
      const response = await axios.post(
        `${WHATSAPP_API_URL}/${this.phoneNumberId}/messages`,
        {
          messaging_product: 'whatsapp',
          to: phone,
          type: 'text',
          text: { body },
        },
        {
          headers: {
            Authorization: `Bearer ${this.accessToken}`,
            'Content-Type': 'application/json',
          },
          timeout: 10000,
        }
      );

      const messageId = response.data.messages?.[0]?.id;
      logger.info(`WhatsApp message sent to ${phone}`, { messageId });
      return messageId || null;
    } catch (error: any) {
      logger.error('WhatsApp message send failed', {
        phone,
        error: error.response?.data || error.message,
      });
      throw new Error('Failed to send WhatsApp message');
    }
  }

  async sendOTP(phone: string, code: string, otpId?: string): Promise<string | null> {
    await this.ensureConfigLoaded();
    if (!this.phoneNumberId || !this.accessToken) {
      logger.error('WhatsApp credentials not configured');
      throw new Error('WhatsApp service not configured');
    }

    const sanitizedCode = this.sanitizeInput(code);

    try {
      const response = await axios.post(
        `${WHATSAPP_API_URL}/${this.phoneNumberId}/messages`,
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
                parameters: [{ type: 'text', text: sanitizedCode }]
              }
            ]
          }
        },
        {
          headers: {
            'Authorization': `Bearer ${this.accessToken}`,
            'Content-Type': 'application/json'
          },
          timeout: 10000
        }
      );

      const messageId = response.data.messages?.[0]?.id;
      logger.info(`WhatsApp OTP sent to ${phone}`, { messageId });
      return messageId || null;
    } catch (error: any) {
      logger.error('WhatsApp OTP send failed', { 
        phone, 
        error: error.response?.data || error.message 
      });

      if (otpId) {
        this.enqueueRetry('OTP', { phone, code: sanitizedCode, otpId });
      }

      throw new Error('Failed to send OTP via WhatsApp');
    }
  }

  async sendRideRequest(
    phone: string,
    tripId: string,
    driverId: string,
    pickupAddress: string,
    distance: number,
    fare: number,
    notificationId?: string
  ): Promise<string | null> {
    await this.ensureConfigLoaded();
    if (!this.phoneNumberId || !this.accessToken) {
      logger.error('WhatsApp credentials not configured');
      throw new Error('WhatsApp service not configured');
    }

    const sanitizedAddress = this.sanitizeInput(pickupAddress);
    const deepLink = `itaxi://driver/accept?tripId=${tripId}`;
    const message = `New ride request near you.\nPickup: ${sanitizedAddress}\nDistance: ${distance.toFixed(1)} km\nEstimated fare: $${fare.toFixed(2)}\nClick to accept: ${deepLink}`;

    try {
      const response = await axios.post(
        `${WHATSAPP_API_URL}/${this.phoneNumberId}/messages`,
        {
          messaging_product: 'whatsapp',
          to: phone,
          type: 'text',
          text: { body: message }
        },
        {
          headers: {
            'Authorization': `Bearer ${this.accessToken}`,
            'Content-Type': 'application/json'
          },
          timeout: 10000
        }
      );

      const messageId = response.data.messages?.[0]?.id;
      logger.info(`Ride notification sent to driver ${driverId}`, { tripId, messageId });
      return messageId || null;
    } catch (error: any) {
      logger.error('Ride notification failed', { 
        driverId,
        tripId,
        error: error.response?.data || error.message 
      });

      if (notificationId) {
        this.enqueueRetry('RIDE_NOTIFICATION', { 
          phone, tripId, driverId, pickupAddress: sanitizedAddress, 
          distance, fare, notificationId 
        });
      }

      throw error;
    }
  }

  private enqueueRetry(type: 'OTP' | 'RIDE_NOTIFICATION', data: any) {
    retryQueue.push({
      type,
      data,
      attempts: 0,
      nextRetry: new Date(Date.now() + BACKOFF_MS[0])
    });
    logger.info(`Enqueued ${type} for retry`, { data });
  }

  async processRetryQueue() {
    const now = new Date();
    const pending = retryQueue.filter(job => job.nextRetry <= now);

    for (const job of pending) {
      try {
        if (job.type === 'OTP') {
          const messageId = await this.sendOTP(job.data.phone, job.data.code);
          if (messageId) {
            await prisma.oTP.update({
              where: { id: job.data.otpId },
              data: { messageId, deliveryStatus: 'SENT' }
            });
            retryQueue.splice(retryQueue.indexOf(job), 1);
            logger.info('OTP retry succeeded', { otpId: job.data.otpId });
          }
        } else if (job.type === 'RIDE_NOTIFICATION') {
          const messageId = await this.sendRideRequest(
            job.data.phone, job.data.tripId, job.data.driverId,
            job.data.pickupAddress, job.data.distance, job.data.fare
          );
          if (messageId) {
            await prisma.rideNotification.update({
              where: { id: job.data.notificationId },
              data: { messageId, status: 'SENT' }
            });
            retryQueue.splice(retryQueue.indexOf(job), 1);
            logger.info('Ride notification retry succeeded', { notificationId: job.data.notificationId });
          }
        }
      } catch (error) {
        job.attempts++;
        if (job.attempts >= MAX_RETRIES) {
          await this.handlePersistentFailure(job);
          retryQueue.splice(retryQueue.indexOf(job), 1);
        } else {
          job.nextRetry = new Date(Date.now() + BACKOFF_MS[job.attempts]);
          logger.warn(`Retry ${job.attempts}/${MAX_RETRIES} failed`, { job });
        }
      }
    }
  }

  private async handlePersistentFailure(job: RetryJob) {
    logger.error('WhatsApp persistent failure', { job });

    if (job.type === 'OTP') {
      await prisma.oTP.update({
        where: { id: job.data.otpId },
        data: { deliveryStatus: 'FAILED' }
      });

      if (process.env.SMS_PROVIDER) {
        logger.info('Falling back to SMS', { phone: job.data.phone });
        // SMS fallback implementation here
      }
    } else if (job.type === 'RIDE_NOTIFICATION') {
      await prisma.rideNotification.update({
        where: { id: job.data.notificationId },
        data: { 
          status: 'FAILED',
          error: 'Max retries exceeded',
          retries: MAX_RETRIES
        }
      });
    }
  }

  async resendFailedNotification(notificationId: string): Promise<boolean> {
    const notification = await prisma.rideNotification.findUnique({
      where: { id: notificationId },
      include: { driver: { include: { user: true } } }
    });

    if (!notification) throw new Error('Notification not found');

    const trip = await prisma.trip.findUnique({ where: { id: notification.tripId } });
    if (!trip) throw new Error('Trip not found');

    const phone = notification.driver.whatsappNumber || notification.driver.user.phone;
    const messageId = await this.sendRideRequest(
      phone, trip.id, notification.driverId,
      'Pickup location', trip.distance, trip.fare, notificationId
    );

    if (messageId) {
      await prisma.rideNotification.update({
        where: { id: notificationId },
        data: { messageId, status: 'SENT', retries: notification.retries + 1 }
      });
      return true;
    }
    return false;
  }
}

// Start retry processor
setInterval(() => {
  new WhatsAppService().processRetryQueue().catch(err => 
    logger.error('Retry queue processing failed', { err })
  );
}, 10000); // Every 10s
