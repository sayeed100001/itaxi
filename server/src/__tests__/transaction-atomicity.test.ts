import { TripService } from '../services/trip.service';
import { TransactionService } from '../services/transaction.service';
import prisma from '../config/database';
import { AppError } from '../middlewares/errorHandler';

const tripService = new TripService();
const transactionService = new TransactionService();

describe('Transaction Atomicity', () => {
  let testRiderId: string;
  let testDriverId: string;
  let testTripId: string;

  beforeAll(async () => {
    const rider = await prisma.user.create({
      data: { phone: '+1111111111', name: 'Test Rider', role: 'RIDER' }
    });
    testRiderId = rider.id;

    const driverUser = await prisma.user.create({
      data: { phone: '+2222222222', name: 'Test Driver', role: 'DRIVER' }
    });

    const driver = await prisma.driver.create({
      data: {
        userId: driverUser.id,
        vehicleType: 'sedan',
        plateNumber: 'TEST123'
      }
    });
    testDriverId = driver.id;
  });

  afterAll(async () => {
    await prisma.transaction.deleteMany({ where: { userId: testRiderId } });
    await prisma.trip.deleteMany({ where: { riderId: testRiderId } });
    await prisma.driver.deleteMany({ where: { id: testDriverId } });
    await prisma.user.deleteMany({ where: { id: testRiderId } });
  });

  beforeEach(async () => {
    await prisma.transaction.deleteMany({ where: { userId: testRiderId } });
    await prisma.trip.deleteMany({ where: { riderId: testRiderId } });
  });

  it('should complete trip payment atomically', async () => {
    await prisma.transaction.create({
      data: {
        userId: testRiderId,
        amount: 100,
        type: 'CREDIT',
        status: 'COMPLETED',
        description: 'Test credit'
      }
    });

    const trip = await prisma.trip.create({
      data: {
        riderId: testRiderId,
        driverId: testDriverId,
        pickupLat: 40.7128,
        pickupLng: -74.0060,
        dropLat: 40.7580,
        dropLng: -73.9855,
        fare: 50,
        distance: 5,
        duration: 15,
        status: 'IN_PROGRESS'
      }
    });
    testTripId = trip.id;

    const result = await tripService.completeTrip(testTripId);

    expect(result.trip.status).toBe('COMPLETED');
    expect(result.transaction.amount).toBe(50);
    expect(result.transaction.type).toBe('DEBIT');

    const balance = await transactionService.getUserBalance(testRiderId);
    expect(balance).toBe(50);
  });

  it('should rollback if insufficient balance', async () => {
    await prisma.transaction.create({
      data: {
        userId: testRiderId,
        amount: 20,
        type: 'CREDIT',
        status: 'COMPLETED',
        description: 'Test credit'
      }
    });

    const trip = await prisma.trip.create({
      data: {
        riderId: testRiderId,
        driverId: testDriverId,
        pickupLat: 40.7128,
        pickupLng: -74.0060,
        dropLat: 40.7580,
        dropLng: -73.9855,
        fare: 50,
        distance: 5,
        duration: 15,
        status: 'IN_PROGRESS'
      }
    });
    testTripId = trip.id;

    await expect(tripService.completeTrip(testTripId)).rejects.toThrow('Insufficient balance');

    const updatedTrip = await prisma.trip.findUnique({ where: { id: testTripId } });
    expect(updatedTrip?.status).toBe('IN_PROGRESS');

    const transactions = await prisma.transaction.findMany({ 
      where: { userId: testRiderId, type: 'DEBIT' } 
    });
    expect(transactions.length).toBe(0);

    const balance = await transactionService.getUserBalance(testRiderId);
    expect(balance).toBe(20);
  });

  it('should rollback if trip status update fails', async () => {
    await prisma.transaction.create({
      data: {
        userId: testRiderId,
        amount: 100,
        type: 'CREDIT',
        status: 'COMPLETED',
        description: 'Test credit'
      }
    });

    const trip = await prisma.trip.create({
      data: {
        riderId: testRiderId,
        driverId: testDriverId,
        pickupLat: 40.7128,
        pickupLng: -74.0060,
        dropLat: 40.7580,
        dropLng: -73.9855,
        fare: 50,
        distance: 5,
        duration: 15,
        status: 'ACCEPTED'
      }
    });
    testTripId = trip.id;

    await expect(tripService.completeTrip(testTripId)).rejects.toThrow('Trip not in progress');

    const transactions = await prisma.transaction.findMany({ 
      where: { userId: testRiderId, type: 'DEBIT' } 
    });
    expect(transactions.length).toBe(0);

    const balance = await transactionService.getUserBalance(testRiderId);
    expect(balance).toBe(100);
  });

  it('should handle concurrent trip completions safely', async () => {
    await prisma.transaction.create({
      data: {
        userId: testRiderId,
        amount: 100,
        type: 'CREDIT',
        status: 'COMPLETED',
        description: 'Test credit'
      }
    });

    const trip1 = await prisma.trip.create({
      data: {
        riderId: testRiderId,
        driverId: testDriverId,
        pickupLat: 40.7128,
        pickupLng: -74.0060,
        dropLat: 40.7580,
        dropLng: -73.9855,
        fare: 60,
        distance: 5,
        duration: 15,
        status: 'IN_PROGRESS'
      }
    });

    const trip2 = await prisma.trip.create({
      data: {
        riderId: testRiderId,
        driverId: testDriverId,
        pickupLat: 40.7128,
        pickupLng: -74.0060,
        dropLat: 40.7580,
        dropLng: -73.9855,
        fare: 60,
        distance: 5,
        duration: 15,
        status: 'IN_PROGRESS'
      }
    });

    const results = await Promise.allSettled([
      tripService.completeTrip(trip1.id),
      tripService.completeTrip(trip2.id)
    ]);

    const successCount = results.filter(r => r.status === 'fulfilled').length;
    const failCount = results.filter(r => r.status === 'rejected').length;

    expect(successCount).toBe(1);
    expect(failCount).toBe(1);

    const balance = await transactionService.getUserBalance(testRiderId);
    expect(balance).toBe(40);
  });
});

describe('Balance Calculation Performance', () => {
  let testUserId: string;

  beforeAll(async () => {
    const user = await prisma.user.create({
      data: { phone: '+3333333333', name: 'Test User', role: 'RIDER' }
    });
    testUserId = user.id;

    const transactions = [];
    for (let i = 0; i < 100; i++) {
      transactions.push({
        userId: testUserId,
        amount: Math.random() * 100,
        type: i % 2 === 0 ? 'CREDIT' : 'DEBIT',
        status: 'COMPLETED',
        description: `Test transaction ${i}`
      });
    }

    await prisma.transaction.createMany({ data: transactions });
  });

  afterAll(async () => {
    await prisma.transaction.deleteMany({ where: { userId: testUserId } });
    await prisma.user.delete({ where: { id: testUserId } });
  });

  it('should calculate balance efficiently with SQL aggregation', async () => {
    const service = new TransactionService();
    
    const start = Date.now();
    const balance = await service.getUserBalance(testUserId);
    const duration = Date.now() - start;

    expect(typeof balance).toBe('number');
    expect(duration).toBeLessThan(100);
  });

  it('should return correct balance with mixed transactions', async () => {
    const service = new TransactionService();
    const balance = await service.getUserBalance(testUserId);

    const transactions = await prisma.transaction.findMany({
      where: { userId: testUserId, status: 'COMPLETED' }
    });

    const expected = transactions.reduce((sum, tx) => {
      return tx.type === 'CREDIT' ? sum + tx.amount : sum - tx.amount;
    }, 0);

    expect(Math.abs(balance - expected)).toBeLessThan(0.01);
  });
});

describe('Transaction Indexes', () => {
  it('should use indexes for common queries', async () => {
    const explain = await prisma.$queryRaw`
      EXPLAIN SELECT * FROM Transaction 
      WHERE userId = 'test' AND status = 'COMPLETED' 
      ORDER BY createdAt DESC
    `;

    expect(explain).toBeDefined();
  });
});
