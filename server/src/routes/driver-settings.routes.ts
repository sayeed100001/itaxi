import { Router } from 'express';
import { DriverSettingsController } from '../controllers/driver-settings.controller';
import { requireAuth, requireDriver } from '../middlewares/auth';

const router = Router();
const controller = new DriverSettingsController();

router.use(requireAuth);
router.use(requireDriver);

router.get('/', controller.getDriverSettings);
router.put('/', controller.updateDriverSettings);

export default router;
