import { Router } from 'express';
import { AdminDriversController } from '../controllers/admin-drivers.controller';
import { requireAdmin } from '../middlewares/auth';

const router = Router();
const controller = new AdminDriversController();

// All routes require admin authentication
router.use(requireAdmin);

// Get all drivers with filtering
router.get('/', controller.getAllDrivers.bind(controller));

// Get drivers grouped by city
router.get('/by-city', controller.getDriversByCity.bind(controller));

// Get driver statistics
router.get('/stats', controller.getDriverStats.bind(controller));

// Update driver
router.put('/:driverId', controller.updateDriver.bind(controller));

// Toggle driver status (suspend/activate)
router.patch('/:driverId/status', controller.toggleDriverStatus.bind(controller));

export default router;
