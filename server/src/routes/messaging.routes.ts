import { Router } from 'express';
import { requireAuth, requireAdmin, requireDriver, requireRider } from '../middlewares/auth';
import { MessagingController } from '../controllers/messaging.controller';

const router = Router();
const controller = new MessagingController();

// Admin routes
router.post('/admin/to-driver', requireAuth, requireAdmin, controller.sendAdminToDriver);
router.post('/admin/to-rider', requireAuth, requireAdmin, controller.sendAdminToRider);
router.get('/admin/driver/:driverId', requireAuth, requireAdmin, controller.getAdminDriverMessages);
router.get('/admin/rider/:riderId', requireAuth, requireAdmin, controller.getAdminRiderMessages);
router.get('/admin/conversations', requireAuth, requireAdmin, controller.getAdminConversations);

// Driver routes
router.post('/driver/to-admin', requireAuth, requireDriver, controller.sendDriverToAdmin);
router.get('/driver/admin-messages', requireAuth, requireDriver, controller.getDriverAdminMessages);

// Rider routes
router.post('/rider/to-admin', requireAuth, requireRider, controller.sendRiderToAdmin);
router.get('/rider/admin-messages', requireAuth, requireRider, controller.getRiderAdminMessages);

export default router;
