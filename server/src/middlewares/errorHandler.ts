import { Request, Response, NextFunction } from 'express';
import logger from '../config/logger';
import { ZodError } from 'zod';

export class AppError extends Error {
  statusCode: number;
  isOperational: boolean;

  constructor(message: string, statusCode: number) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }
}

function isDbConnectionError(err: any): boolean {
  const msg = String(err?.message || '');
  return (
    msg.includes('Authentication failed against database') ||
    msg.includes('database server') ||
    msg.includes('credentials') ||
    msg.includes('ECONNREFUSED') ||
    msg.includes('connect ETIMEDOUT') ||
    err?.code === 'P1001' ||
    err?.code === 'P1002'
  );
}

function isPrismaSpawnError(err: any): boolean {
  const msg = String(err?.message || '');
  return msg.includes('spawn EPERM') || msg.includes('PrismaClientKnownRequestError');
}

export const errorHandler = (err: any, req: Request, res: Response, next: NextFunction) => {
  if (err instanceof ZodError) {
    (err as any).statusCode = 400;
    (err as any).status = 'fail';
  }

  err.statusCode = err.statusCode || 500;
  err.status = err.status || 'error';

  logger.error({
    message: err.message,
    statusCode: err.statusCode,
    stack: err.stack,
    path: req.path,
    method: req.method,
  });

  const statusCode = err.statusCode || 500;
  let message: string;
  if (err.isOperational) {
    message = err.message;
  } else if (err instanceof ZodError) {
    message = 'Invalid request payload';
  } else if (isPrismaSpawnError(err)) {
    message = 'Database engine failed to start. Check Prisma engine/runtime compatibility.';
  } else if (isDbConnectionError(err)) {
    message = 'Database connection error. Please check server configuration.';
  } else if (process.env.NODE_ENV === 'development') {
    message = err.message;
  } else {
    message = 'Something went wrong';
  }

  const payload: Record<string, unknown> = {
    success: false,
    status: err.status,
    message,
  };
  if (process.env.NODE_ENV === 'development') {
    Object.assign(payload, { error: err.message, stack: err.stack });
    if (err instanceof ZodError) {
      Object.assign(payload, { issues: err.issues });
    }
  }
  res.status(statusCode).json(payload);
};
