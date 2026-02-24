import { Router } from 'express';
import { DriverController } from '../controllers/driver.controller';
import { requireAuth, requireDriver } from '../middlewares/auth';
import { validate } from '../middlewares/validate';
import { createDriverSchema, updateLocationSchema } from '../validators/schemas';

const router = Router();
const driverController = new DriverController();

router.use(requireAuth);

router.post('/', requireDriver, validate(createDriverSchema), driverController.createDriver);
router.patch('/status', requireDriver, driverController.updateStatus);
router.patch('/location', requireDriver, validate(updateLocationSchema), driverController.updateLocation);
router.get('/available', driverController.getAvailableDrivers);
router.get('/me', requireDriver, driverController.getDriver);
router.get('/credit-status', requireDriver, driverController.getCreditStatus);
router.get('/credit-ledger', requireDriver, driverController.getCreditLedger);
router.get('/credit-packages', requireDriver, driverController.getCreditPackages);
router.post('/credit-request', requireDriver, driverController.requestCreditPurchase);
router.get('/credit-requests', requireDriver, driverController.getMyCreditRequests);

export default router;
