import { Router } from 'express';
import { DispatchController } from '../controllers/dispatch.controller';
import { authenticate, authorize } from '../middlewares/auth';

const router = Router();
const dispatchController = new DispatchController();

router.get('/config', authenticate, authorize(['ADMIN']), dispatchController.getConfig);
router.put('/config', authenticate, authorize(['ADMIN']), dispatchController.updateConfig);
router.get('/offers', authenticate, authorize(['ADMIN']), dispatchController.getOffers);

export default router;
