const { PrismaClient } = require('@prisma/client');

// Database connection pool configuration
const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL,
    },
  },
  log: [
    { emit: 'event', level: 'query' },
    { emit: 'event', level: 'info' },
    { emit: 'event', level: 'warn' },
    { emit: 'event', level: 'error' },
  ],
  // Connection pool settings
  __internal: {
    // Enable query logging in development
    debug: process.env.NODE_ENV === 'development',
  }
});

// Configure Prisma client with connection pool settings
const configurePrisma = () => {
  // These settings would typically be configured through DATABASE_URL
  // but we can enhance the client here
  
  // Add query event listener for performance monitoring
  if (process.env.NODE_ENV === 'development') {
    prisma.$on('query', (e) => {
      console.log('Query: ' + e.query);
      console.log('Params: ' + e.params);
      console.log('Duration: ' + e.duration + 'ms');
    });
  }

  // Add error event listener
  prisma.$on('error', (e) => {
    console.error('Database error:', e);
  });
};

// Health check function
const checkDbHealth = async () => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return { status: 'healthy', timestamp: new Date().toISOString() };
  } catch (error) {
    console.error('Database health check failed:', error);
    return { status: 'unhealthy', error: error.message, timestamp: new Date().toISOString() };
  }
};

// Performance monitoring
const monitorQueryPerformance = async (queryFn, operationName) => {
  const startTime = Date.now();
  try {
    const result = await queryFn();
    const duration = Date.now() - startTime;
    
    // Log slow queries (longer than 100ms)
    if (duration > 100) {
      console.warn(`Slow query detected in ${operationName}: ${duration}ms`);
    }
    
    return result;
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(`Query failed in ${operationName} after ${duration}ms:`, error);
    throw error;
  }
};

// Initialize Prisma
configurePrisma();

module.exports = {
  prisma,
  checkDbHealth,
  monitorQueryPerformance
};