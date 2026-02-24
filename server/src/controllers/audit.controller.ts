import { Response, NextFunction } from 'express';
import { AuthRequest } from '../middlewares/auth';
import prisma from '../config/database';

export class AuditController {
  async getLogs(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { action, userId, from, to } = req.query;
      
      const where: any = {};
      if (action) where.action = action as string;
      if (userId) where.userId = userId as string;
      if (from || to) {
        where.createdAt = {};
        if (from) where.createdAt.gte = new Date(from as string);
        if (to) where.createdAt.lte = new Date(to as string);
      }

      const logs = await prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: 100,
      });

      res.json({ success: true, data: logs });
    } catch (error) {
      next(error);
    }
  }
}
