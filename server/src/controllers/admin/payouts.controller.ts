import { Request, Response, NextFunction } from 'express';
import prisma from '../../config/database';
import * as paymentService from '../../services/payment.service';
import { AuthRequest } from '../../middlewares/auth';

export const getPendingPayouts = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const payouts = await prisma.payout.findMany({
      where: {
        status: 'PENDING_MANUAL_REVIEW'
      },
      include: {
        driver: {
          include: {
            user: {
              select: { name: true, phone: true, email: true }
            }
          }
        }
      },
      orderBy: { createdAt: 'asc' }
    });

    res.json({ success: true, data: payouts });
  } catch (error) {
    next(error);
  }
};

export const processPayout = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { payoutId } = req.body;
    
    if (!payoutId) {
      return res.status(400).json({ success: false, message: 'payoutId is required' });
    }

    const payout = await paymentService.adminProcessPayout(payoutId, req.user!.id);

    res.json({ 
      success: true, 
      data: payout,
      message: 'Payout processed successfully'
    });
  } catch (error: any) {
    next(error);
  }
};

export const getAllPayouts = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { status } = req.query;
    const where = status ? { status: status as any } : {};

    const payouts = await prisma.payout.findMany({
      where,
      include: {
        driver: {
          include: {
            user: {
              select: { name: true, phone: true, email: true }
            }
          }
        }
      },
      orderBy: { createdAt: 'desc' },
      take: 200
    });

    res.json({ success: true, data: payouts });
  } catch (error) {
    next(error);
  }
};
