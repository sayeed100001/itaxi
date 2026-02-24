import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import prisma from '../config/database';
import { config } from '../config/env';
import { AppError } from '../middlewares/errorHandler';
import logger from '../config/logger';
import { WhatsAppService } from './whatsapp.service';

const whatsappService = new WhatsAppService();
const LOCK_THRESHOLD = parseInt(process.env.OTP_LOCK_THRESHOLD || '5');
const LOCK_MINUTES = parseInt(process.env.OTP_LOCK_MINUTES || '60');

export class AuthService {
  private generateOTP(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  private async hashOTP(otp: string): Promise<string> {
    return bcrypt.hash(otp, 10);
  }

  async requestOTP(phone: string, name?: string, role?: 'RIDER' | 'DRIVER' | 'ADMIN') {
    const lock = await prisma.oTPLock.findUnique({ where: { phone } });
    if (lock?.lockedUntil && lock.lockedUntil > new Date()) {
      throw new AppError('Account locked due to too many failed attempts', 429);
    }

    const otp = this.generateOTP();
    const hashedOTP = await this.hashOTP(otp);
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

    const otpRecord = await prisma.$transaction(async (tx) => {
      await tx.oTP.deleteMany({ where: { phone, verified: false } });
      
      return tx.oTP.create({
        data: { phone, code: hashedOTP, expiresAt, verified: false },
      });
    });

    try {
      const messageId = await whatsappService.sendOTP(phone, otp, otpRecord.id);
      
      if (messageId) {
        await prisma.oTP.update({
          where: { id: otpRecord.id },
          data: { messageId, deliveryStatus: 'SENT' },
        });
      }
      
      logger.info(`OTP sent to ${phone}`, { messageId });
    } catch (error) {
      logger.error(`Failed to send OTP to ${phone}`, { error });
    }

    // Log OTP to console in development
    if (process.env.NODE_ENV !== 'production') {
      console.log(`\n🔐 OTP for ${phone}: ${otp}\n`);
      logger.info(`OTP for ${phone}: ${otp}`);
    }

    const isDev = process.env.NODE_ENV !== 'production' || process.env.DEV_OTP_RETURN === 'true';
    return {
      message: 'OTP sent successfully',
      ...(isDev ? { otp } : {}),
    };
  }

  async verifyOTP(phone: string, code: string, name?: string, role?: 'RIDER' | 'DRIVER' | 'ADMIN') {
    const jwtSecret = config.jwtSecret as string;
    const lock = await prisma.oTPLock.findUnique({ where: { phone } });
    if (lock?.lockedUntil && lock.lockedUntil > new Date()) {
      const remainingMin = Math.ceil((lock.lockedUntil.getTime() - Date.now()) / 60000);
      throw new AppError(`Account locked. Try again in ${remainingMin} minutes`, 429);
    }

    const otpRecord = await prisma.oTP.findFirst({
      where: { phone, verified: false, expiresAt: { gte: new Date() } },
      orderBy: { createdAt: 'desc' },
    });

    if (!otpRecord) {
      await this.incrementFailedAttempts(phone);
      throw new AppError('Invalid or expired OTP', 400);
    }

    const isValid = await bcrypt.compare(code, otpRecord.code);
    if (!isValid) {
      await this.incrementFailedAttempts(phone);
      throw new AppError('Invalid or expired OTP', 400);
    }

    await prisma.$transaction([
      prisma.oTPLock.deleteMany({ where: { phone } }),
      prisma.oTP.update({ where: { id: otpRecord.id }, data: { verified: true } }),
    ]);

    let user = await prisma.user.findUnique({ where: { phone } });

    if (!user) {
      if (!name) throw new AppError('Name required for new user', 400);
      user = await prisma.user.create({
        data: { phone, name, role: role || 'RIDER' },
      });
      logger.info(`New user created: ${user.id}`);

      // Auto-create Driver record if role is DRIVER
      if (user.role === 'DRIVER') {
        await prisma.driver.create({
          data: {
            userId: user.id,
            vehicleType: 'Not specified',
            plateNumber: 'Not specified',
            status: 'OFFLINE',
          },
        });
        logger.info(`Driver profile created for user: ${user.id}`);
      }
    }

    const token = jwt.sign(
      { id: user.id, role: user.role },
      jwtSecret,
      { expiresIn: config.jwtExpiresIn as jwt.SignOptions['expiresIn'] }
    );

    logger.info(`User authenticated: ${user.id}`);

    return {
      user: { id: user.id, phone: user.phone, name: user.name, role: user.role, email: user.email },
      token,
    };
  }

  private async incrementFailedAttempts(phone: string) {
    const lock = await prisma.oTPLock.upsert({
      where: { phone },
      update: { failedAttempts: { increment: 1 } },
      create: { phone, failedAttempts: 1 },
    });

    const attempts = lock.failedAttempts;

    if (attempts >= LOCK_THRESHOLD) {
      await prisma.oTPLock.update({
        where: { phone },
        data: { lockedUntil: new Date(Date.now() + LOCK_MINUTES * 60 * 1000) },
      });
      logger.warn(`Phone locked: ${phone}, attempts: ${attempts}`);
    }
  }
}
