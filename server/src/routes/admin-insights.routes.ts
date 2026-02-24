import { Router } from 'express';
import { requireAuth, requireAdmin } from '../middlewares/auth';
import { AdminInsightsController } from '../controllers/admin-insights.controller';

const router = Router();
const controller = new AdminInsightsController();

router.use(requireAuth);
router.use(requireAdmin);

router.get('/analytics', controller.getAnalyticsOverview);
router.get('/finance', controller.getFinanceOverview);

export default router;
