import { Request, Response } from 'express';
import { WhatsAppService } from '../services/whatsapp.service';
import prisma from '../config/database';
import logger from '../config/logger';

const whatsappService = new WhatsAppService();

export const handleWebhookVerification = (req: Request, res: Response) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  const verifyToken = process.env.WHATSAPP_VERIFY_TOKEN;

  if (mode === 'subscribe' && token === verifyToken) {
    logger.info('WhatsApp webhook verified');
    res.status(200).send(challenge);
  } else {
    res.sendStatus(403);
  }
};

export const handleWebhook = async (req: Request, res: Response) => {
  try {
    const signature = req.headers['x-hub-signature-256'] as string;
    
    // Get raw body for signature verification
    let payload: string;
    let body: any;
    
    if (Buffer.isBuffer(req.body)) {
      payload = req.body.toString('utf8');
      body = JSON.parse(payload);
    } else {
      payload = JSON.stringify(req.body);
      body = req.body;
    }

    if (!whatsappService.verifyWebhookSignature(payload, signature)) {
      logger.warn('Invalid webhook signature');
      return res.sendStatus(403);
    }

    if (body.object === 'whatsapp_business_account') {
      for (const entry of body.entry || []) {
        for (const change of entry.changes || []) {
          if (change.field === 'messages') {
            const value = change.value;

            if (value.statuses) {
              for (const status of value.statuses) {
                const messageId = status.id;
                const statusType = status.status.toUpperCase();
                const timestamp = status.timestamp ? new Date(parseInt(status.timestamp) * 1000) : new Date();

                logger.info('WhatsApp status update', { messageId, status: statusType });

                await prisma.oTP.updateMany({
                  where: { messageId },
                  data: { deliveryStatus: statusType }
                });

                await prisma.rideNotification.updateMany({
                  where: { messageId },
                  data: { status: statusType }
                });
              }
            }
          }
        }
      }
    }

    res.sendStatus(200);
  } catch (error) {
    logger.error('WhatsApp webhook error', { error });
    res.sendStatus(500);
  }
};

export const resendFailedNotifications = async (req: Request, res: Response) => {
  try {
    const { notificationIds } = req.body;

    if (!Array.isArray(notificationIds)) {
      return res.status(400).json({ error: 'notificationIds must be an array' });
    }

    const results = [];
    for (const id of notificationIds) {
      try {
        const success = await whatsappService.resendFailedNotification(id);
        results.push({ id, success });
      } catch (error: any) {
        results.push({ id, success: false, error: error.message });
      }
    }

    res.json({ results });
  } catch (error: any) {
    logger.error('Resend failed notifications error', { error });
    res.status(500).json({ error: error.message });
  }
};

export const getFailedNotifications = async (req: Request, res: Response) => {
  try {
    const failed = await prisma.rideNotification.findMany({
      where: { status: 'FAILED' },
      include: { driver: { include: { user: true } } },
      orderBy: { sentAt: 'desc' },
      take: 100
    });

    res.json({ notifications: failed });
  } catch (error: any) {
    logger.error('Get failed notifications error', { error });
    res.status(500).json({ error: error.message });
  }
};
