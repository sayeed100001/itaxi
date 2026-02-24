import { ReconciliationService } from '../services/reconciliation.service';
import prisma from '../config/database';

describe('Reconciliation Service', () => {
  const service = new ReconciliationService();
  let testUserId: string;

  beforeAll(async () => {
    const user = await prisma.user.create({
      data: { phone: '+4444444444', name: 'Reconciliation Test', role: 'RIDER' }
    });
    testUserId = user.id;
  });

  afterAll(async () => {
    await prisma.reconciliationLog.deleteMany({});
    await prisma.transaction.deleteMany({ where: { userId: testUserId } });
    await prisma.user.delete({ where: { id: testUserId } });
  });

  it('should create reconciliation log', async () => {
    const from = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const to = new Date();

    const log = await service.reconcileTransactions(from, to);

    expect(log.id).toBeDefined();
    expect(log.periodStart).toEqual(from);
    expect(log.periodEnd).toEqual(to);
    expect(typeof log.dbTotal).toBe('number');
    expect(typeof log.stripeTotal).toBe('number');
    expect(typeof log.mismatch).toBe('number');
  });

  it('should detect mismatch when DB and Stripe differ', async () => {
    await prisma.transaction.create({
      data: {
        userId: testUserId,
        amount: 100,
        type: 'CREDIT',
        status: 'COMPLETED',
        description: 'Test transaction'
      }
    });

    const from = new Date(Date.now() - 1000);
    const to = new Date();

    const log = await service.reconcileTransactions(from, to);

    expect(log.mismatch).toBeGreaterThan(0);
  });

  it('should reconcile payouts separately', async () => {
    const from = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const to = new Date();

    const log = await service.reconcilePayouts(from, to);

    expect(log.id).toBeDefined();
    expect(log.details).toContain('PAYOUTS');
  });

  it('should create audit log for significant mismatches', async () => {
    await prisma.transaction.create({
      data: {
        userId: testUserId,
        amount: 1000,
        type: 'CREDIT',
        status: 'COMPLETED',
        description: 'Large test transaction'
      }
    });

    const from = new Date(Date.now() - 1000);
    const to = new Date();

    await service.reconcileTransactions(from, to);

    const auditLogs = await prisma.auditLog.findMany({
      where: { action: 'RECONCILIATION_MISMATCH' },
      orderBy: { createdAt: 'desc' },
      take: 1
    });

    expect(auditLogs.length).toBeGreaterThan(0);
  });

  it('should handle empty periods gracefully', async () => {
    const from = new Date('2020-01-01');
    const to = new Date('2020-01-02');

    const log = await service.reconcileTransactions(from, to);

    expect(log.dbTotal).toBe(0);
    expect(log.mismatch).toBeGreaterThanOrEqual(0);
  });
});
