import { Router } from 'express';
import { authenticate, authorize } from '../middlewares/auth';
import * as paymentController from '../controllers/payment.controller';

const router = Router();

router.post('/create-session', authenticate, paymentController.createSession);
router.get('/balance', authenticate, paymentController.getBalance);
router.post('/webhook', paymentController.webhook);
router.post('/payout', authenticate, authorize(['DRIVER']), paymentController.requestPayout);
router.get('/reconcile', authenticate, authorize(['ADMIN']), paymentController.reconcile);

export default router;
