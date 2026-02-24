import { Router } from 'express';
import { authenticate, authorize } from '../middlewares/auth';
import { StripeController } from '../controllers/stripe.controller';

const router = Router();
const stripeController = new StripeController();

router.post('/create-account', authenticate, authorize(['DRIVER']), stripeController.createConnectAccount);
router.get('/onboarding-link', authenticate, authorize(['DRIVER']), stripeController.getOnboardingLink);
router.get('/account-status', authenticate, authorize(['DRIVER']), stripeController.getAccountStatus);

export default router;
