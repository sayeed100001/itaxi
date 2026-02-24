const fs = require('fs');
const path = require('path');
const { createLogger, format, transports } = require('winston');
const DailyRotateFile = require('winston-daily-rotate-file');

// Log rotation configuration
const LOG_CONFIG = {
  level: process.env.LOG_LEVEL || 'info',
  maxFiles: '14d', // Keep logs for 14 days
  maxSize: '20m',  // Rotate when file reaches 20MB
  dirname: './logs',
  frequency: 'daily',
  datePattern: 'YYYY-MM-DD',
  zippedArchive: true // Archive old logs as gzipped files
};

class LogRotation {
  constructor(serviceName = 'service') {
    this.serviceName = serviceName;
    this.ensureLogDir();
    this.logger = this.createLogger();
  }

  // Ensure log directory exists
  ensureLogDir() {
    if (!fs.existsSync(LOG_CONFIG.dirname)) {
      fs.mkdirSync(LOG_CONFIG.dirname, { recursive: true });
    }
  }

  // Create configured logger
  createLogger() {
    const { combine, timestamp, errors, json, printf } = format;

    // Custom log format
    const customFormat = printf(({ level, message, timestamp, stack, ...meta }) => {
      return JSON.stringify({
        timestamp,
        level,
        service: this.serviceName,
        message,
        ...meta,
        stack: stack || undefined
      });
    });

    return createLogger({
      level: LOG_CONFIG.level,
      format: combine(
        timestamp(),
        errors({ stack: true }),
        json()
      ),
      defaultMeta: { service: this.serviceName },
      transports: [
        // Console transport
        new transports.Console({
          format: combine(
            format.colorize(),
            customFormat
          )
        }),
        // Daily rotating file transport
        new DailyRotateFile({
          filename: `${LOG_CONFIG.dirname}/${this.serviceName}-%DATE%.log`,
          datePattern: LOG_CONFIG.datePattern,
          zippedArchive: LOG_CONFIG.zippedArchive,
          maxSize: LOG_CONFIG.maxSize,
          maxFiles: LOG_CONFIG.maxFiles,
          format: combine(
            customFormat
          )
        })
      ],
      exceptionHandlers: [
        new DailyRotateFile({
          filename: `${LOG_CONFIG.dirname}/${this.serviceName}-exceptions-%DATE%.log`,
          datePattern: LOG_CONFIG.datePattern,
          zippedArchive: LOG_CONFIG.zippedArchive,
          maxSize: LOG_CONFIG.maxSize,
          maxFiles: '7d',
          format: combine(
            timestamp(),
            errors({ stack: true }),
            json()
          )
        })
      ],
      rejectionHandlers: [
        new DailyRotateFile({
          filename: `${LOG_CONFIG.dirname}/${this.serviceName}-rejections-%DATE%.log`,
          datePattern: LOG_CONFIG.datePattern,
          zippedArchive: LOG_CONFIG.zippedArchive,
          maxSize: LOG_CONFIG.maxSize,
          maxFiles: '7d',
          format: combine(
            timestamp(),
            errors({ stack: true }),
            json()
          )
        })
      ]
    });
  }

  // Log methods
  info(message, meta = {}) {
    this.logger.info(message, meta);
  }

  error(message, meta = {}) {
    this.logger.error(message, meta);
  }

  warn(message, meta = {}) {
    this.logger.warn(message, meta);
  }

  debug(message, meta = {}) {
    this.logger.debug(message, meta);
  }

  verbose(message, meta = {}) {
    this.logger.verbose(message, meta);
  }

  // Get logger instance
  getLogger() {
    return this.logger;
  }

  // Clean old logs manually (if needed)
  cleanOldLogs() {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - parseInt(LOG_CONFIG.maxFiles));

      const files = fs.readdirSync(LOG_CONFIG.dirname);
      const logFiles = files.filter(file => 
        file.includes(this.serviceName) && 
        (file.endsWith('.log') || file.endsWith('.log.gz'))
      );

      for (const file of logFiles) {
        const filePath = path.join(LOG_CONFIG.dirname, file);
        const stats = fs.statSync(filePath);
        
        if (stats.mtime < cutoffDate) {
          fs.unlinkSync(filePath);
          console.log(`Removed old log file: ${file}`);
        }
      }
    } catch (error) {
      console.error('Error cleaning old logs:', error);
    }
  }

  // Get recent logs
  getRecentLogs(days = 1) {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - days);

      const files = fs.readdirSync(LOG_CONFIG.dirname);
      const recentFiles = files.filter(file => {
        const filePath = path.join(LOG_CONFIG.dirname, file);
        const stats = fs.statSync(filePath);
        return stats.mtime >= cutoffDate && file.includes(this.serviceName);
      });

      return recentFiles.map(file => ({
        name: file,
        path: path.join(LOG_CONFIG.dirname, file),
        size: fs.statSync(path.join(LOG_CONFIG.dirname, file)).size,
        modified: fs.statSync(path.join(LOG_CONFIG.dirname, file)).mtime
      }));
    } catch (error) {
      console.error('Error getting recent logs:', error);
      return [];
    }
  }
}

// Centralized logging utility
class CentralizedLogging {
  constructor() {
    this.loggers = new Map();
  }

  // Get or create logger for service
  getLogger(serviceName) {
    if (!this.loggers.has(serviceName)) {
      this.loggers.set(serviceName, new LogRotation(serviceName));
    }
    return this.loggers.get(serviceName);
  }

  // Log with correlation ID for tracing
  logWithCorrelation(serviceName, level, message, correlationId, meta = {}) {
    const logger = this.getLogger(serviceName);
    
    logger[level](message, {
      correlationId,
      ...meta
    });
  }

  // Audit logging for security events
  auditLog(serviceName, action, userId, details = {}) {
    const logger = this.getLogger(`${serviceName}-audit`);
    
    logger.info('Audit event', {
      action,
      userId,
      timestamp: new Date().toISOString(),
      ...details
    });
  }

  // Performance logging
  performanceLog(serviceName, operation, duration, details = {}) {
    const logger = this.getLogger(`${serviceName}-perf`);
    
    logger.info('Performance event', {
      operation,
      duration,
      timestamp: new Date().toISOString(),
      ...details
    });
  }
}

// Global logging instance
const centralizedLogging = new CentralizedLogging();

module.exports = {
  LogRotation,
  CentralizedLogging,
  centralizedLogging
};