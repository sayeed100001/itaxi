import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { getIo, initializeSocket } from '../config/socket';
import { createServer } from 'http';
import express from 'express';

describe('Socket.IO getIo()', () => {
  let httpServer: any;
  let app: any;

  beforeEach(() => {
    app = express();
    httpServer = createServer(app);
  });

  afterEach(() => {
    if (httpServer) {
      httpServer.close();
    }
  });

  it('should throw error when io not initialized', () => {
    expect(() => getIo()).toThrow('Socket.IO not initialized');
  });

  it('should return io instance after initialization', async () => {
    await initializeSocket(httpServer);
    const io = getIo();
    expect(io).toBeDefined();
    expect(io.emit).toBeDefined();
  });

  it('should return same instance on multiple calls', async () => {
    await initializeSocket(httpServer);
    const io1 = getIo();
    const io2 = getIo();
    expect(io1).toBe(io2);
  });

  it('should not reinitialize if already initialized', async () => {
    const io1 = await initializeSocket(httpServer);
    const io2 = await initializeSocket(httpServer);
    expect(io1).toBe(io2);
  });
});

describe('Redis Adapter', () => {
  it('should warn if PM2_CLUSTER=true but no REDIS_URL', async () => {
    const originalEnv = process.env.PM2_CLUSTER;
    const originalRedis = process.env.REDIS_URL;
    
    process.env.PM2_CLUSTER = 'true';
    delete process.env.REDIS_URL;

    const app = express();
    const httpServer = createServer(app);
    
    // Should log warning but not throw
    await expect(initializeSocket(httpServer)).resolves.toBeDefined();
    
    process.env.PM2_CLUSTER = originalEnv;
    process.env.REDIS_URL = originalRedis;
    httpServer.close();
  });
});
