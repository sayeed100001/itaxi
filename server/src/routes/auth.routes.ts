import { Router } from 'express';
import { AuthController } from '../controllers/auth.controller';
import { validate } from '../middlewares/validate';
import { requestOTPSchema, verifyOTPSchema } from '../validators/schemas';
import * as adminAuthController from '../controllers/admin-auth.controller';
import { otpRateLimiter } from '../middlewares/otpRateLimiter';
import { requireAuth } from '../middlewares/auth';

const router = Router();
const authController = new AuthController();

router.post('/request-otp', otpRateLimiter, validate(requestOTPSchema), authController.requestOTP);
router.post('/send-otp', otpRateLimiter, validate(requestOTPSchema), authController.requestOTP);
router.post('/verify-otp', validate(verifyOTPSchema), authController.verifyOTP);
router.post('/admin-login', adminAuthController.adminLogin);
router.put('/update-profile', requireAuth, authController.updateProfile);
router.post('/change-password', requireAuth, authController.changePassword);
router.post('/change-phone', requireAuth, authController.changePhone);

export default router;
