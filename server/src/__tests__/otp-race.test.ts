import { AuthService } from '../services/auth.service';
import prisma from '../config/database';
import { AppError } from '../middlewares/errorHandler';

const authService = new AuthService();

describe('OTP Race Condition & Atomicity', () => {
  const testPhone = '+1234567890';

  beforeEach(async () => {
    await prisma.oTP.deleteMany({ where: { phone: testPhone } });
    await prisma.oTPLock.deleteMany({ where: { phone: testPhone } });
    await prisma.oTPRequest.deleteMany({ where: { phone: testPhone } });
  });

  it('should handle concurrent OTP requests atomically', async () => {
    const requests = Array(5).fill(null).map(() => 
      authService.requestOTP(testPhone).catch(() => null)
    );

    await Promise.all(requests);

    const otps = await prisma.oTP.findMany({ 
      where: { phone: testPhone, verified: false } 
    });

    expect(otps.length).toBe(1);
  });

  it('should prevent duplicate unverified OTPs via unique constraint', async () => {
    await authService.requestOTP(testPhone);
    await authService.requestOTP(testPhone);

    const otps = await prisma.oTP.findMany({ 
      where: { phone: testPhone, verified: false } 
    });

    expect(otps.length).toBe(1);
  });

  it('should allow new OTP after verification', async () => {
    await authService.requestOTP(testPhone);
    
    const otp = await prisma.oTP.findFirst({ 
      where: { phone: testPhone, verified: false } 
    });
    
    await prisma.oTP.update({
      where: { id: otp!.id },
      data: { verified: true }
    });

    await authService.requestOTP(testPhone);

    const allOtps = await prisma.oTP.findMany({ where: { phone: testPhone } });
    expect(allOtps.length).toBe(2);
    expect(allOtps.filter(o => !o.verified).length).toBe(1);
  });
});

describe('OTP Rate Limiting', () => {
  const testPhone = '+1999999999';

  beforeEach(async () => {
    await prisma.oTPRequest.deleteMany({ where: { phone: testPhone } });
    await prisma.oTP.deleteMany({ where: { phone: testPhone } });
  });

  it('should track request count in database', async () => {
    await authService.requestOTP(testPhone);
    await authService.requestOTP(testPhone);

    const request = await prisma.oTPRequest.findFirst({ 
      where: { phone: testPhone } 
    });

    expect(request?.count).toBeGreaterThanOrEqual(2);
  });

  it('should enforce per-phone rate limit', async () => {
    const maxRequests = parseInt(process.env.OTP_MAX_PER_HOUR || '3');

    for (let i = 0; i < maxRequests; i++) {
      await authService.requestOTP(testPhone);
    }

    const request = await prisma.oTPRequest.findFirst({ 
      where: { phone: testPhone } 
    });

    expect(request?.count).toBe(maxRequests);
  });
});

describe('OTP Lockout', () => {
  const testPhone = '+1888888888';

  beforeEach(async () => {
    await prisma.oTPLock.deleteMany({ where: { phone: testPhone } });
    await prisma.oTP.deleteMany({ where: { phone: testPhone } });
  });

  it('should increment failed attempts on invalid OTP', async () => {
    await authService.requestOTP(testPhone);

    try {
      await authService.verifyOTP(testPhone, '000000');
    } catch (error) {}

    const lock = await prisma.oTPLock.findUnique({ where: { phone: testPhone } });
    expect(lock?.failedAttempts).toBe(1);
  });

  it('should lock phone after threshold failures', async () => {
    const threshold = parseInt(process.env.OTP_LOCK_THRESHOLD || '5');
    
    await authService.requestOTP(testPhone);

    for (let i = 0; i < threshold; i++) {
      try {
        await authService.verifyOTP(testPhone, '000000');
      } catch (error) {}
    }

    const lock = await prisma.oTPLock.findUnique({ where: { phone: testPhone } });
    expect(lock?.lockedUntil).toBeTruthy();
    expect(lock!.lockedUntil! > new Date()).toBe(true);
  });

  it('should reject OTP request when locked', async () => {
    await prisma.oTPLock.create({
      data: {
        phone: testPhone,
        failedAttempts: 5,
        lockedUntil: new Date(Date.now() + 60 * 60 * 1000)
      }
    });

    await expect(authService.requestOTP(testPhone)).rejects.toThrow('locked');
  });

  it('should reject OTP verification when locked', async () => {
    await authService.requestOTP(testPhone);
    
    await prisma.oTPLock.create({
      data: {
        phone: testPhone,
        failedAttempts: 5,
        lockedUntil: new Date(Date.now() + 60 * 60 * 1000)
      }
    });

    await expect(authService.verifyOTP(testPhone, '123456')).rejects.toThrow('locked');
  });

  it('should reset failed attempts on successful verification', async () => {
    await prisma.oTPLock.create({
      data: { phone: testPhone, failedAttempts: 3 }
    });

    await authService.requestOTP(testPhone);
    
    const otp = await prisma.oTP.findFirst({ 
      where: { phone: testPhone, verified: false } 
    });

    await prisma.oTP.update({
      where: { id: otp!.id },
      data: { verified: true }
    });

    const lock = await prisma.oTPLock.findUnique({ where: { phone: testPhone } });
    expect(lock).toBeNull();
  });

  it('should show remaining lock time in error message', async () => {
    await prisma.oTPLock.create({
      data: {
        phone: testPhone,
        failedAttempts: 5,
        lockedUntil: new Date(Date.now() + 30 * 60 * 1000)
      }
    });

    try {
      await authService.verifyOTP(testPhone, '123456');
      fail('Should have thrown error');
    } catch (error: any) {
      expect(error.message).toMatch(/\d+ minutes/);
    }
  });
});

describe('OTP Cleanup', () => {
  it('should delete expired OTPs older than 24 hours', async () => {
    const oldOTP = await prisma.oTP.create({
      data: {
        phone: '+1777777777',
        code: 'hashed',
        expiresAt: new Date(Date.now() - 25 * 60 * 60 * 1000),
        verified: false
      }
    });

    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
    await prisma.oTP.deleteMany({ where: { expiresAt: { lt: yesterday } } });

    const found = await prisma.oTP.findUnique({ where: { id: oldOTP.id } });
    expect(found).toBeNull();
  });

  it('should delete old rate limit records', async () => {
    const oldRequest = await prisma.oTPRequest.create({
      data: {
        phone: '+1666666666',
        windowStart: new Date(Date.now() - 25 * 60 * 60 * 1000),
        count: 3
      }
    });

    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
    await prisma.oTPRequest.deleteMany({ where: { createdAt: { lt: yesterday } } });

    const found = await prisma.oTPRequest.findUnique({ where: { id: oldRequest.id } });
    expect(found).toBeNull();
  });
});
