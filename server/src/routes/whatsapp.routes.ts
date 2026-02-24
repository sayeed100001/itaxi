import { Router } from 'express';
import { 
  handleWebhookVerification, 
  handleWebhook,
} from '../controllers/whatsapp.controller';

const router = Router();

router.get('/webhook', handleWebhookVerification);
router.post('/webhook', handleWebhook);

export default router;
