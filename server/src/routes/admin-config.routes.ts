import { Router } from 'express';
import { requireAuth, requireAdmin } from '../middlewares/auth';
import { adminConfigController } from '../controllers/admin-config.controller';

const router = Router();

router.use(requireAuth);
router.use(requireAdmin);

router.get('/whatsapp', (req, res, next) => adminConfigController.getWhatsApp(req, res, next));
router.put('/whatsapp', (req, res, next) => adminConfigController.updateWhatsApp(req, res, next));

router.get('/routing', (req, res, next) => adminConfigController.getOrs(req, res, next));
router.put('/routing', (req, res, next) => adminConfigController.updateOrs(req, res, next));

export default router;

