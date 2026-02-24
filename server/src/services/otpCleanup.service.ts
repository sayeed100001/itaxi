import cron from 'node-cron';
import prisma from '../config/database';
import logger from '../config/logger';

export function startOTPCleanup() {
  cron.schedule('0 * * * *', async () => {
    try {
      const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
      
      const [deletedOTPs, deletedRequests] = await Promise.all([
        prisma.oTP.deleteMany({ where: { expiresAt: { lt: yesterday } } }),
        prisma.oTPRequest.deleteMany({ where: { createdAt: { lt: yesterday } } }),
      ]);

      logger.info('OTP cleanup completed', { 
        deletedOTPs: deletedOTPs.count, 
        deletedRequests: deletedRequests.count 
      });
    } catch (error) {
      logger.error('OTP cleanup failed', { error });
    }
  });

  logger.info('OTP cleanup cron started (hourly)');
}
