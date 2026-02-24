import { Router } from 'express';
import { requireAuth } from '../middlewares/auth';
import { NotificationsController } from '../controllers/notifications.controller';

const router = Router();
const controller = new NotificationsController();

router.use(requireAuth);
router.get('/feed', controller.getFeed);

export default router;
