import { Response, NextFunction } from 'express';
import { AuthRequest } from '../middlewares/auth';
import prisma from '../config/database';
import { WhatsAppService } from '../services/whatsapp.service';
import { AppError } from '../middlewares/errorHandler';
import { getIo } from '../config/socket';

const whatsappService = new WhatsAppService();

export class MessagingController {
  // Admin <-> Driver messaging
  async sendAdminToDriver(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { driverId, message, channel = 'IN_APP' } = req.body;
      
      const driver = await prisma.driver.findUnique({
        where: { id: driverId },
        include: { user: true }
      });
      
      if (!driver) throw new AppError('Driver not found', 404);

      let messageId: string | null = null;
      let deliveryStatus: 'SENT' | 'FAILED' = 'SENT';
      let deliveryError: string | null = null;

      if (channel === 'WHATSAPP') {
        try {
          const phone = driver.whatsappNumber || driver.user.phone;
          messageId = await whatsappService.sendMessage(phone, message);
        } catch (error: any) {
          deliveryStatus = 'FAILED';
          deliveryError = error.message;
        }
      }

      const msg = await prisma.$executeRaw`
        INSERT INTO AdminDriverMessage (id, adminUserId, driverId, message, channel, messageId, deliveryStatus, deliveryError, createdAt)
        VALUES (UUID(), ${req.user!.id}, ${driverId}, ${message}, ${channel}, ${messageId}, ${deliveryStatus}, ${deliveryError}, NOW())
      `;

      const io = getIo();
      io.to(`driver:${driverId}`).emit('admin:message', { message, from: 'admin', createdAt: new Date() });

      res.json({ success: true, message: 'Message sent', deliveryStatus });
    } catch (error) {
      next(error);
    }
  }

  async sendDriverToAdmin(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { message } = req.body;
      
      const driver = await prisma.driver.findUnique({
        where: { userId: req.user!.id }
      });
      
      if (!driver) throw new AppError('Driver profile not found', 404);

      await prisma.$executeRaw`
        INSERT INTO AdminDriverMessage (id, driverId, message, channel, deliveryStatus, createdAt)
        VALUES (UUID(), ${driver.id}, ${message}, 'IN_APP', 'SENT', NOW())
      `;

      const io = getIo();
      io.to('admin').emit('driver:message', { 
        driverId: driver.id, 
        message, 
        from: req.user!.name,
        createdAt: new Date() 
      });

      res.json({ success: true, message: 'Message sent to admin' });
    } catch (error) {
      next(error);
    }
  }

  async getAdminDriverMessages(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { driverId } = req.params;
      
      const messages = await prisma.$queryRaw<any[]>`
        SELECT * FROM AdminDriverMessage 
        WHERE driverId = ${driverId}
        ORDER BY createdAt DESC
        LIMIT 100
      `;

      res.json({ success: true, data: messages });
    } catch (error) {
      next(error);
    }
  }

  // Admin <-> Rider messaging
  async sendAdminToRider(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { riderId, message, channel = 'IN_APP' } = req.body;
      
      const rider = await prisma.user.findUnique({
        where: { id: riderId, role: 'RIDER' }
      });
      
      if (!rider) throw new AppError('Rider not found', 404);

      let messageId: string | null = null;
      let deliveryStatus: 'SENT' | 'FAILED' = 'SENT';
      let deliveryError: string | null = null;

      if (channel === 'WHATSAPP') {
        try {
          messageId = await whatsappService.sendMessage(rider.phone, message);
        } catch (error: any) {
          deliveryStatus = 'FAILED';
          deliveryError = error.message;
        }
      }

      await prisma.$executeRaw`
        INSERT INTO AdminRiderMessage (id, adminUserId, riderId, message, channel, messageId, deliveryStatus, deliveryError, createdAt)
        VALUES (UUID(), ${req.user!.id}, ${riderId}, ${message}, ${channel}, ${messageId}, ${deliveryStatus}, ${deliveryError}, NOW())
      `;

      const io = getIo();
      io.to(`user:${riderId}`).emit('admin:message', { message, from: 'admin', createdAt: new Date() });

      res.json({ success: true, message: 'Message sent', deliveryStatus });
    } catch (error) {
      next(error);
    }
  }

  async sendRiderToAdmin(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { message } = req.body;

      await prisma.$executeRaw`
        INSERT INTO AdminRiderMessage (id, riderId, message, channel, deliveryStatus, createdAt)
        VALUES (UUID(), ${req.user!.id}, ${message}, 'IN_APP', 'SENT', NOW())
      `;

      const io = getIo();
      io.to('admin').emit('rider:message', { 
        riderId: req.user!.id, 
        message, 
        from: req.user!.name,
        createdAt: new Date() 
      });

      res.json({ success: true, message: 'Message sent to admin' });
    } catch (error) {
      next(error);
    }
  }

  async getAdminRiderMessages(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { riderId } = req.params;
      
      const messages = await prisma.$queryRaw<any[]>`
        SELECT * FROM AdminRiderMessage 
        WHERE riderId = ${riderId}
        ORDER BY createdAt DESC
        LIMIT 100
      `;

      res.json({ success: true, data: messages });
    } catch (error) {
      next(error);
    }
  }

  // Get all conversations for admin dashboard
  async getAdminConversations(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const driverConvos = await prisma.$queryRaw<any[]>`
        SELECT 
          d.id as userId,
          d.userId as userAccountId,
          u.name as userName,
          u.phone as userPhone,
          'DRIVER' as userRole,
          MAX(adm.createdAt) as lastMessageAt,
          (
            SELECT message FROM AdminDriverMessage 
            WHERE driverId = d.id 
            ORDER BY createdAt DESC LIMIT 1
          ) as lastMessage,
          COUNT(*) as messageCount,
          0 as unreadCount
        FROM AdminDriverMessage adm
        JOIN Driver d ON d.id = adm.driverId
        JOIN User u ON u.id = d.userId
        GROUP BY d.id, d.userId, u.name, u.phone
        ORDER BY lastMessageAt DESC
        LIMIT 50
      `;

      const riderConvos = await prisma.$queryRaw<any[]>`
        SELECT 
          u.id as userId,
          u.id as userAccountId,
          u.name as userName,
          u.phone as userPhone,
          'RIDER' as userRole,
          MAX(arm.createdAt) as lastMessageAt,
          (
            SELECT message FROM AdminRiderMessage 
            WHERE riderId = u.id 
            ORDER BY createdAt DESC LIMIT 1
          ) as lastMessage,
          COUNT(*) as messageCount,
          0 as unreadCount
        FROM AdminRiderMessage arm
        JOIN User u ON u.id = arm.riderId
        WHERE u.role = 'RIDER'
        GROUP BY u.id, u.name, u.phone
        ORDER BY lastMessageAt DESC
        LIMIT 50
      `;

      // Combine and sort by last message time
      const allConversations = [...driverConvos, ...riderConvos]
        .sort((a, b) => new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime())
        .slice(0, 100);

      res.json({ 
        success: true, 
        data: allConversations
      });
    } catch (error) {
      next(error);
    }
  }

  // Get driver's messages with admin
  async getDriverAdminMessages(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const driver = await prisma.driver.findUnique({
        where: { userId: req.user!.id }
      });
      
      if (!driver) throw new AppError('Driver profile not found', 404);

      const messages = await prisma.$queryRaw<any[]>`
        SELECT * FROM AdminDriverMessage 
        WHERE driverId = ${driver.id}
        ORDER BY createdAt ASC
        LIMIT 100
      `;

      res.json({ success: true, data: messages });
    } catch (error) {
      next(error);
    }
  }

  // Get rider's messages with admin
  async getRiderAdminMessages(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const messages = await prisma.$queryRaw<any[]>`
        SELECT * FROM AdminRiderMessage 
        WHERE riderId = ${req.user!.id}
        ORDER BY createdAt ASC
        LIMIT 100
      `;

      res.json({ success: true, data: messages });
    } catch (error) {
      next(error);
    }
  }
}
