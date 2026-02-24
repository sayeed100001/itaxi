const { prisma } = require('../db/pool');

class GracefulShutdown {
  constructor(app, server) {
    this.app = app;
    this.server = server;
    this.isShuttingDown = false;
    this.shutdownTimeout = 30000; // 30 seconds
  }

  // Initialize graceful shutdown handlers
  init() {
    // Handle SIGTERM signal
    process.on('SIGTERM', () => {
      console.log('Received SIGTERM, starting graceful shutdown...');
      this.shutdown();
    });

    // Handle SIGINT signal (Ctrl+C)
    process.on('SIGINT', () => {
      console.log('Received SIGINT, starting graceful shutdown...');
      this.shutdown();
    });

    // Handle uncaught exceptions
    process.on('uncaughtException', (error) => {
      console.error('Uncaught Exception:', error);
      this.shutdown();
    });

    // Handle unhandled promise rejections
    process.on('unhandledRejection', (reason, promise) => {
      console.error('Unhandled Rejection at:', promise, 'reason:', reason);
      this.shutdown();
    });

    console.log('Graceful shutdown handlers initialized');
  }

  // Perform graceful shutdown
  async shutdown() {
    if (this.isShuttingDown) {
      console.log('Shutdown already in progress');
      return;
    }

    this.isShuttingDown = true;
    console.log('Starting graceful shutdown process...');

    try {
      // Stop accepting new connections
      if (this.server) {
        this.server.close(() => {
          console.log('Server closed');
        });
      }

      // Close database connections
      console.log('Closing database connections...');
      await prisma.$disconnect();
      console.log('Database connections closed');

      // Perform any other cleanup tasks here
      // For example, close Redis connections, stop scheduled tasks, etc.
      
      // Wait for any remaining async operations
      await this.waitForPendingOperations();

      console.log('Graceful shutdown completed');
      process.exit(0);
    } catch (error) {
      console.error('Error during graceful shutdown:', error);
      process.exit(1);
    }
  }

  // Wait for pending operations to complete
  async waitForPendingOperations(timeout = 5000) {
    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        console.log('Timeout waiting for pending operations');
        resolve();
      }, timeout);

      // In a real implementation, you would track pending operations
      // and resolve when they're all complete
      setTimeout(() => {
        clearTimeout(timer);
        resolve();
      }, 1000); // Wait 1 second for demo purposes
    });
  }

  // Middleware to check if shutting down
  shutdownCheck = (req, res, next) => {
    if (this.isShuttingDown) {
      // Return 503 Service Unavailable during shutdown
      return res.status(503).json({
        error: 'Service is shutting down',
        code: 'SERVICE_SHUTTING_DOWN'
      });
    }
    next();
  };

  // Health check that returns different status during shutdown
  healthCheck = async (req, res) => {
    if (this.isShuttingDown) {
      return res.status(503).json({
        status: 'shutting_down',
        timestamp: new Date().toISOString()
      });
    }

    // Perform actual health checks here
    try {
      // Example: check database connectivity
      await prisma.$queryRaw`SELECT 1`;
      
      res.status(200).json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime()
      });
    } catch (error) {
      res.status(500).json({
        status: 'unhealthy',
        error: error.message,
        timestamp: new Date().toISOString()
      });
    }
  };
}

module.exports = GracefulShutdown;