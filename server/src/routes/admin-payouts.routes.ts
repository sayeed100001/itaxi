import { Router } from 'express';
import { requireAuth, requireAdmin } from '../middlewares/auth';
import * as payoutsController from '../controllers/admin/payouts.controller';

const router = Router();

router.use(requireAuth);
router.use(requireAdmin);

router.get('/pending', payoutsController.getPendingPayouts);
router.get('/all', payoutsController.getAllPayouts);
router.post('/process', payoutsController.processPayout);

export default router;
