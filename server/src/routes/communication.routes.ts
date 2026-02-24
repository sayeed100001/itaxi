import { Router } from 'express';
import { AuthRequest, requireAuth } from '../middlewares/auth';
import prisma from '../config/database';

const router = Router();

router.post('/log-communication', requireAuth, async (req: AuthRequest, res, next) => {
  try {
    const { tripId, type } = req.body;
    
    await prisma.communicationLog.create({
      data: {
        tripId,
        fromUserId: req.user!.id,
        type,
      },
    });

    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

export default router;
