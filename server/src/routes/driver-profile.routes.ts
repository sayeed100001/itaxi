import { Router } from 'express';
import { DriverProfileController } from '../controllers/driver-profile.controller';
import { requireDriver } from '../middlewares/auth';

const router = Router();
const controller = new DriverProfileController();

router.use(requireDriver);

router.get('/profile', controller.getProfile.bind(controller));
router.put('/profile', controller.updateProfile.bind(controller));
router.post('/documents', controller.uploadDocument.bind(controller));
router.get('/documents', controller.getDocuments.bind(controller));
router.delete('/documents/:documentId', controller.deleteDocument.bind(controller));

export default router;
