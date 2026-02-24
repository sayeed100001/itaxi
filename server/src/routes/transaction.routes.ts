import { Router } from 'express';
import { TransactionController } from '../controllers/transaction.controller';
import { requireAuth } from '../middlewares/auth';

const router = Router();
const transactionController = new TransactionController();

router.use(requireAuth);

router.post('/', transactionController.createTransaction);
router.get('/', transactionController.getUserTransactions);
router.get('/balance', transactionController.getUserBalance);

export default router;
