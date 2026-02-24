import { Router } from 'express';
import { AdminDriverCreditController } from '../controllers/admin-driver-credit.controller';
import { requireAdmin } from '../middlewares/auth';

const router = Router();
const controller = new AdminDriverCreditController();

// PROTECTED ROUTES: All require ADMIN role
router.use(requireAdmin);

// Credit Packages (CRUD)
router.get('/packages', controller.getCreditPackages);
router.post('/packages', controller.createCreditPackage);
router.put('/packages/:id', controller.updateCreditPackage);
router.patch('/packages/:id/status', controller.toggleCreditPackageStatus);

// Driver Bulk Actions
router.get('/drivers', controller.getDriversWithCredits);
router.post('/driver/:driverId/assign-package', controller.assignPackageToDriver);
router.post('/driver/:driverId/add', controller.addCredits);
router.post('/driver/:driverId/deduct', controller.deductCredits);

// Credit Purchase Requests
router.get('/purchase-requests', controller.getCreditPurchaseRequests);
router.post('/purchase', controller.createCreditPurchaseRequest);
router.post('/purchase-requests/:id/approve', controller.approveCreditRequest);
router.post('/purchase-requests/:id/reject', controller.rejectCreditRequest);
router.get('/purchase-requests/driver/:driverId', controller.getDriverCreditHistory);

// Statistics
router.get('/stats/credit-stats', controller.getCreditStats);
router.get('/stats/monthly-revenue', controller.getMonthlyRevenue);
router.get('/stats/top-drivers', controller.getTopDrivers);
router.get('/stats/top-riders', controller.getTopRiders);

export default router;
