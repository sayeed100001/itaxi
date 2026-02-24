import { Request, Response, NextFunction } from 'express';
import prisma from '../config/database';
import { WhatsAppService } from '../services/whatsapp.service';

const whatsappService = new WhatsAppService();

export const getWhatsAppLogs = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const [otpLogs, rideNotifications, analytics] = await Promise.all([
      prisma.oTP.findMany({
        take: 100,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          phone: true,
          deliveryStatus: true,
          messageId: true,
          createdAt: true,
          verified: true,
        },
      }),
      prisma.rideNotification.findMany({
        take: 100,
        orderBy: { sentAt: 'desc' },
        include: {
          driver: {
            include: { user: true },
          },
        },
      }),
      Promise.all([
        prisma.oTP.count(),
        prisma.oTP.count({ where: { deliveryStatus: 'SENT' } }),
        prisma.rideNotification.count(),
        prisma.rideNotification.count({ where: { status: 'SENT' } }),
      ]),
    ]);

    const [totalOTP, sentOTP, totalRide, sentRide] = analytics;

    res.json({
      success: true,
      data: {
        otpLogs,
        rideNotifications,
        analytics: {
          totalOTP,
          sentOTP,
          failedOTP: totalOTP - sentOTP,
          otpSuccessRate: totalOTP > 0 ? ((sentOTP / totalOTP) * 100).toFixed(1) : 0,
          totalRide,
          sentRide,
          failedRide: totalRide - sentRide,
          rideSuccessRate: totalRide > 0 ? ((sentRide / totalRide) * 100).toFixed(1) : 0,
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

export const retryOTP = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const otpId = String(req.params.otpId || '');
    
    const otp = await prisma.oTP.findUnique({ where: { id: otpId } });
    if (!otp) {
      return res.status(404).json({ success: false, message: 'OTP not found' });
    }

    // Generate new OTP code (can't reuse hashed one)
    const newCode = Math.floor(100000 + Math.random() * 900000).toString();
    
    await whatsappService.sendOTP(otp.phone, newCode);
    
    res.json({ success: true, message: 'OTP resent successfully' });
  } catch (error) {
    next(error);
  }
};

export const retryRideNotification = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const notificationId = String(req.params.notificationId || '');
    
    const notification = await prisma.rideNotification.findUnique({
      where: { id: notificationId },
      include: { driver: true },
    });

    if (!notification || !notification.driver.whatsappNumber) {
      return res.status(404).json({ success: false, message: 'Notification not found' });
    }

    const trip = await prisma.trip.findUnique({ where: { id: notification.tripId } });
    if (!trip) {
      return res.status(404).json({ success: false, message: 'Trip not found' });
    }

    await whatsappService.sendRideRequest(
      notification.driver.whatsappNumber,
      trip.id,
      notification.driverId,
      `${trip.pickupLat}, ${trip.pickupLng}`,
      trip.distance / 1000,
      trip.fare
    );

    res.json({ success: true, message: 'Notification resent successfully' });
  } catch (error) {
    next(error);
  }
};
