import { Router } from 'express';
import { requireAuth, requireAdmin } from '../middlewares/auth';
import * as adminWhatsAppController from '../controllers/admin-whatsapp.controller';

const router = Router();

router.use(requireAuth);
router.use(requireAdmin);

router.get('/whatsapp-logs', adminWhatsAppController.getWhatsAppLogs);
router.post('/whatsapp/retry-otp/:otpId', adminWhatsAppController.retryOTP);
router.post('/whatsapp/retry-notification/:notificationId', adminWhatsAppController.retryRideNotification);

export default router;
