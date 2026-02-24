import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config/env';
import { AppError } from './errorHandler';

export interface AuthRequest extends Request {
  user?: {
    id: string;
    role: string;
  };
}

export const requireAuth = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];

    if (!token) {
      throw new AppError('Authentication required', 401);
    }

    const decoded = jwt.verify(token, config.jwtSecret) as unknown as { id: string; role: string };
    req.user = decoded;
    next();
  } catch (error) {
    next(new AppError('Invalid or expired token', 401));
  }
};

export const requireAdmin = (req: AuthRequest, res: Response, next: NextFunction) => {
  if (!req.user || req.user.role !== 'ADMIN') {
    return next(new AppError('Admin access required', 403));
  }
  next();
};

export const requireDriver = (req: AuthRequest, res: Response, next: NextFunction) => {
  if (!req.user || req.user.role !== 'DRIVER') {
    return next(new AppError('Driver access required', 403));
  }
  next();
};

export const requireRider = (req: AuthRequest, res: Response, next: NextFunction) => {
  if (!req.user || req.user.role !== 'RIDER') {
    return next(new AppError('Rider access required', 403));
  }
  next();
};

// Legacy alias
export const authenticate = requireAuth;
export const authorize = (...roles: (string | string[])[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    const allowedRoles = roles
      .flatMap((role) => (Array.isArray(role) ? role : [role]))
      .filter((role): role is string => typeof role === 'string' && role.length > 0);
    if (!req.user || !allowedRoles.includes(req.user.role)) {
      return next(new AppError('Unauthorized access', 403));
    }
    next();
  };
};
