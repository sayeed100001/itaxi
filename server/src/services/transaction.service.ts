import prisma from '../config/database';

export class TransactionService {
  async createTransaction(data: {
    userId: string;
    amount: number;
    type: 'CREDIT' | 'DEBIT';
    description: string;
    status?: 'PENDING' | 'COMPLETED' | 'FAILED';
  }) {
    return await prisma.transaction.create({ data });
  }

  async getUserTransactions(userId: string) {
    return await prisma.transaction.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getUserBalance(userId: string) {
    const transactions = await prisma.transaction.findMany({
      where: { userId, status: 'COMPLETED' },
    });

    return transactions.reduce((balance, tx) => {
      return tx.type === 'CREDIT' ? balance + tx.amount : balance - tx.amount;
    }, 0);
  }
}
