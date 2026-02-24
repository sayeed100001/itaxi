import { Response, NextFunction } from 'express';
import { AuthRequest } from '../middlewares/auth';
import prisma from '../config/database';
import { z } from 'zod';

const updateConfigSchema = z.object({
  weightETA: z.number().min(0).max(1).optional(),
  weightRating: z.number().min(0).max(1).optional(),
  weightAcceptance: z.number().min(0).max(1).optional(),
  serviceMatchBonus: z.number().min(0).max(1).optional(),
  offerTimeout: z.number().min(10).max(120).optional(),
  maxOffers: z.number().min(1).max(10).optional(),
  searchRadius: z.number().min(1).max(50).optional(),
});

export class DispatchController {
  async getConfig(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      let config = await prisma.dispatchConfig.findFirst();
      if (!config) {
        config = await prisma.dispatchConfig.create({
          data: {
            weightETA: 0.5,
            weightRating: 0.3,
            weightAcceptance: 0.2,
            serviceMatchBonus: 0.1,
            offerTimeout: 30,
            maxOffers: 3,
            searchRadius: 10,
          },
        });
      }
      res.json({ success: true, data: config });
    } catch (error) {
      next(error);
    }
  }

  async updateConfig(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const data = updateConfigSchema.parse(req.body);
      
      let config = await prisma.dispatchConfig.findFirst();
      if (!config) {
        config = await prisma.dispatchConfig.create({ data: data as any });
      } else {
        config = await prisma.dispatchConfig.update({
          where: { id: config.id },
          data,
        });
      }

      res.json({ success: true, data: config });
    } catch (error) {
      next(error);
    }
  }

  async getOffers(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { tripId } = req.query;
      const where = tripId ? { tripId: tripId as string } : {};
      
      const offers = await prisma.tripOffer.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: 100,
      });

      res.json({ success: true, data: offers });
    } catch (error) {
      next(error);
    }
  }
}
