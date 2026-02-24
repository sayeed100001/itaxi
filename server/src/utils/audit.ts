import prisma from '../config/database';
import logger from '../config/logger';

export const logAudit = async (
  userId: string | null,
  action: string,
  details: any,
  ipAddress?: string,
  userAgent?: string
) => {
  try {
    await prisma.auditLog.create({
      data: {
        userId,
        action,
        details: JSON.stringify(details),
        ipAddress,
        userAgent,
      },
    });
  } catch (error) {
    logger.error('Failed to log audit', { error, action, userId });
  }
};
