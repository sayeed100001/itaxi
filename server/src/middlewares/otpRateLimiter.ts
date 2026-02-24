import { Request, Response, NextFunction } from 'express';
import { createClient } from 'redis';
import prisma from '../config/database';
import { AppError } from './errorHandler';
import logger from '../config/logger';

const REDIS_URL = process.env.REDIS_URL;
const MAX_PER_HOUR = parseInt(process.env.OTP_MAX_PER_HOUR || '3');

let redisClient: ReturnType<typeof createClient> | null = null;

if (REDIS_URL) {
  redisClient = createClient({ url: REDIS_URL });
  redisClient.connect().catch(() => {
    logger.warn('Redis unavailable, using DB rate limiting');
    redisClient = null;
  });
}

export const otpRateLimiter = async (req: Request, res: Response, next: NextFunction) => {
  const { phone } = req.body;
  if (!phone) return next();

  try {
    const allowed = await checkRateLimit(phone);
    if (!allowed) {
      throw new AppError(`Rate limit exceeded. Max ${MAX_PER_HOUR} requests per hour`, 429);
    }
    next();
  } catch (error) {
    next(error);
  }
};

async function checkRateLimit(phone: string): Promise<boolean> {
  if (redisClient?.isOpen) {
    return checkRedisRateLimit(phone);
  }
  return checkDbRateLimit(phone);
}

async function checkRedisRateLimit(phone: string): Promise<boolean> {
  const key = `otp:rate:${phone}`;
  const count = await redisClient!.incr(key);
  
  if (count === 1) {
    await redisClient!.expire(key, 3600);
  }
  
  return count <= MAX_PER_HOUR;
}

async function checkDbRateLimit(phone: string): Promise<boolean> {
  const hourMs = 3600 * 1000;
  const windowStart = new Date(Math.floor(Date.now() / hourMs) * hourMs);

  const existing = await prisma.oTPRequest.findUnique({
    where: { phone_windowStart: { phone, windowStart } },
  });

  if (existing && existing.count >= MAX_PER_HOUR) {
    return false;
  }

  await prisma.oTPRequest.upsert({
    where: { phone_windowStart: { phone, windowStart } },
    update: { count: { increment: 1 } },
    create: { phone, windowStart, count: 1 },
  });

  return true;
}
