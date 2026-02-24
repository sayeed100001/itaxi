import winston from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';
import { config } from '@shared/config';

const logFormat = winston.format.combine(
  winston.format.timestamp(),
  winston.format.errors({ stack: true }),
  winston.format.json()
);

const logger = winston.createLogger({
  level: config.logLevel,
  format: logFormat,
  defaultMeta: { service: config.serviceName },
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      ),
    }),
    new DailyRotateFile({
      filename: `logs/%DATE%-combined.log`,
      datePattern: 'YYYY-MM-DD',
      zippedArchive: true,
      maxSize: '20m',
      maxFiles: '14d',
    }),
    new DailyRotateFile({
      level: 'error',
      filename: `logs/%DATE%-error.log`,
      datePattern: 'YYYY-MM-DD',
      zippedArchive: true,
      maxSize: '20m',
      maxFiles: '14d',
    }),
  ],
});

// Add correlation ID middleware
const addCorrelationId = (req, res, next) => {
  req.correlationId = req.headers['x-correlation-id'] || generateCorrelationId();
  res.setHeader('X-Correlation-ID', req.correlationId);
  next();
};

const generateCorrelationId = () => {
  return `corr_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};

// Enhanced logging functions with correlation ID
const logWithContext = (level, message, context = {}) => {
  const meta = {
    ...context,
    service: config.serviceName,
    timestamp: new Date().toISOString(),
  };
  
  logger[level](message, meta);
};

export {
  logger,
  addCorrelationId,
  generateCorrelationId,
  logWithContext
};

// Also make logWithContext available as a method on the logger object
logger.logWithContext = logWithContext;