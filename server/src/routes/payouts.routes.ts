import { Router } from 'express';
import { authenticate, authorize } from '../middlewares/auth';
import { PayoutsController } from '../controllers/payouts.controller';

const router = Router();
const payoutsController = new PayoutsController();

router.get('/pending', authenticate, authorize(['ADMIN']), payoutsController.getPendingPayouts);
router.post('/process', authenticate, authorize(['ADMIN']), payoutsController.processPayout);
router.get('/all', authenticate, authorize(['ADMIN']), payoutsController.getAllPayouts);

export default router;
