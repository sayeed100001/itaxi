import { Router } from 'express';
import { DriverRatingsController } from '../controllers/driver-ratings.controller';
import { requireAuth, requireDriver } from '../middlewares/auth';

const router = Router();
const controller = new DriverRatingsController();

router.use(requireAuth);
router.use(requireDriver);

router.get('/', controller.getDriverRatings);

export default router;
