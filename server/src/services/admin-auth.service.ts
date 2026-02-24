import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import prisma from '../config/database';
import { config } from '../config/env';
import { AppError } from '../middlewares/errorHandler';
import logger from '../config/logger';

export const adminLogin = async (email: string, password: string) => {
  const jwtSecret = config.jwtSecret as string;
  logger.info(`Admin login attempt for: ${email}`);
  
  const user = await prisma.user.findFirst({
    where: { email, role: 'ADMIN' },
  });

  logger.info(`User found: ${!!user}, Has password: ${!!user?.password}`);

  if (!user || !user.password) {
    throw new AppError('Invalid credentials', 401);
  }

  const isValidPassword = await bcrypt.compare(password, user.password);
  
  logger.info(`Password valid: ${isValidPassword}`);

  if (!isValidPassword) {
    throw new AppError('Invalid credentials', 401);
  }

  const token = jwt.sign(
    { id: user.id, role: user.role },
    jwtSecret,
    { expiresIn: config.jwtExpiresIn as jwt.SignOptions['expiresIn'] }
  );

  logger.info(`Admin logged in: ${user.email}`);

  return {
    user: { id: user.id, phone: user.phone, name: user.name, role: user.role, email: user.email },
    token,
  };
};
