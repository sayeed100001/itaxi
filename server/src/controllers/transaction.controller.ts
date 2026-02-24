import { Response, NextFunction } from 'express';
import { TransactionService } from '../services/transaction.service';
import { AuthRequest } from '../middlewares/auth';
import { z } from 'zod';

const transactionService = new TransactionService();

const createTransactionSchema = z.object({
  amount: z.number(),
  type: z.enum(['CREDIT', 'DEBIT']),
  description: z.string(),
});

export class TransactionController {
  async createTransaction(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const data = createTransactionSchema.parse(req.body);
      const transaction = await transactionService.createTransaction({ ...data, userId: req.user!.id });
      res.status(201).json({ success: true, data: transaction });
    } catch (error) {
      next(error);
    }
  }

  async getUserTransactions(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const transactions = await transactionService.getUserTransactions(req.user!.id);
      res.json({ success: true, data: transactions });
    } catch (error) {
      next(error);
    }
  }

  async getUserBalance(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const balance = await transactionService.getUserBalance(req.user!.id);
      res.json({ success: true, data: { balance } });
    } catch (error) {
      next(error);
    }
  }
}
