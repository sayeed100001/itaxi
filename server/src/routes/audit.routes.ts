import { Router } from 'express';
import { authenticate, authorize } from '../middlewares/auth';
import { AuditController } from '../controllers/audit.controller';

const router = Router();
const auditController = new AuditController();

router.get('/logs', authenticate, authorize(['ADMIN']), auditController.getLogs);

export default router;
