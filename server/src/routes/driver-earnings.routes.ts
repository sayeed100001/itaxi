import { Router } from 'express';
import { DriverEarningsController } from '../controllers/driver-earnings.controller';
import { requireDriver } from '../middlewares/auth';

const router = Router();
const controller = new DriverEarningsController();

router.use(requireDriver);

router.get('/summary', controller.getEarningsSummary.bind(controller));
router.get('/daily', controller.getDailyEarnings.bind(controller));
router.get('/history', controller.getTripHistory.bind(controller));
router.get('/performance', controller.getPerformanceMetrics.bind(controller));

export default router;
