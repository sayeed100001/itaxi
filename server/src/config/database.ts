import { PrismaClient } from '@prisma/client';

// For 1M+ users: add ?connection_limit=20 to DATABASE_URL for connection pooling
const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
});

export default prisma;
