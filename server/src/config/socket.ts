import { Server as SocketServer, Socket } from 'socket.io';
import { Server as HttpServer } from 'http';
import { createAdapter } from '@socket.io/redis-adapter';
import { createClient } from 'redis';
import jwt from 'jsonwebtoken';
import { config } from './env';
import prisma from './database';
import logger from './logger';
import { calculateDistance, calculateETA } from '../utils/distance';
import { encodeGeohash, getNeighbors } from '../utils/geohash';
import locationService from '../services/location.service';
import dispatchService from '../services/dispatch.service';
import { TripService } from '../services/trip.service';

const GEOHASH_PRECISION = parseInt(process.env.GEOHASH_PRECISION || '6');
const PM2_CLUSTER = process.env.PM2_CLUSTER === 'true';

interface AuthSocket extends Socket {
  userId?: string;
  userRole?: string;
  driverId?: string;
  currentGeohash?: string;
}

let io: SocketServer | null = null;

// Guard against global broadcasts
const preventGlobalEmit = (ioInstance: SocketServer) => {
  const originalEmit = ioInstance.emit.bind(ioInstance);
  ioInstance.emit = (...args: any[]) => {
    logger.error('BLOCKED: Global io.emit() detected. Use io.to(room).emit() instead', { event: args[0] });
    throw new Error('Global broadcasts are disabled. Use io.to(room).emit() for targeted emissions.');
  };
  return originalEmit;
};

export function getIo(): SocketServer {
  if (!io) {
    throw new Error('Socket.IO not initialized. Call initializeSocket first.');
  }
  return io;
}

export const initializeSocket = async (server: HttpServer) => {
  if (io) {
    logger.warn('Socket.IO already initialized');
    return io;
  }

  io = new SocketServer(server, {
    cors: {
      origin: config.clientUrl,
      methods: ['GET', 'POST'],
      credentials: true,
    },
  });

  // Prevent global broadcasts
  preventGlobalEmit(io);

  // Redis adapter for horizontal scaling
  if (process.env.REDIS_URL) {
    try {
      const pubClient = createClient({ url: process.env.REDIS_URL });
      const subClient = pubClient.duplicate();

      await Promise.all([pubClient.connect(), subClient.connect()]);

      io.adapter(createAdapter(pubClient, subClient));
      logger.info('Socket.IO Redis adapter enabled');
    } catch (error) {
      logger.error('Redis adapter failed, using in-memory adapter', { error });
    }
  } else if (PM2_CLUSTER) {
    logger.warn('WARNING: PM2_CLUSTER=true but REDIS_URL not set. Multi-instance Socket.IO will not work correctly.');
  }

  // JWT Authentication Middleware
  io.use(async (socket: AuthSocket, next) => {
    try {
      const rawToken = socket.handshake.auth.token || socket.handshake.headers.authorization?.split(' ')[1];
      const token = typeof rawToken === 'string' ? rawToken : '';

      if (!token) {
        return next(new Error('Authentication required'));
      }

      const decoded = jwt.verify(token, config.jwtSecret) as unknown as { id: string; role: string };
      socket.userId = decoded.id;
      socket.userRole = decoded.role;

      // Get driver ID if user is a driver
      if (decoded.role === 'DRIVER') {
        const driver = await prisma.driver.findUnique({ where: { userId: decoded.id } });
        if (driver) socket.driverId = driver.id;
      }

      next();
    } catch (error) {
      next(new Error('Invalid token'));
    }
  });

  io.on('connection', (socket: AuthSocket) => {
    logger.info(`User connected: ${socket.userId} (${socket.userRole})`);

    // Join user-specific room
    socket.join(`user:${socket.userId}`);
    if (socket.userRole === 'ADMIN') {
      socket.join('admin');
    }
    if (socket.userRole === 'DRIVER' && socket.driverId) {
      socket.join(`driver:${socket.driverId}`);
    }

    // Auto-join geohash room on connect if location provided
    socket.on('connect:location', (data: { lat: number; lng: number }) => {
      const geohash = encodeGeohash(data.lat, data.lng, GEOHASH_PRECISION);
      socket.join(`geo:${geohash}`);
      socket.currentGeohash = geohash;
      logger.info(`Socket auto-joined geohash`, { userId: socket.userId, geohash });
    });

    // Driver Location Updates (every 3 seconds)
    socket.on('driver:location', async (data: { lat: number; lng: number; bearing?: number }) => {
      if (socket.userRole !== 'DRIVER' || !socket.driverId) return;

      try {
        const result = await locationService.updateDriverLocation(
          socket.driverId,
          data.lat,
          data.lng,
          data.bearing || 0
        );

        if (result.flagged) {
          socket.emit('driver:flagged', {
            reason: 'GPS anomaly detected',
            anomalyCount: result.anomalyCount,
          });
          return;
        }

        const { snappedLat, snappedLng } = result;

        // Update geohash room membership
        const newGeohash = encodeGeohash(snappedLat, snappedLng, GEOHASH_PRECISION);
        if (socket.currentGeohash !== newGeohash) {
          if (socket.currentGeohash) {
            socket.leave(`geo:${socket.currentGeohash}`);
          }
          socket.join(`geo:${newGeohash}`);
          socket.currentGeohash = newGeohash;
        }

        // Get neighbors including current tile
        const neighbors = getNeighbors(newGeohash);

        // Emit to nearby geohash rooms only (spatial filtering)
        for (const neighborHash of neighbors) {
          getIo().to(`geo:${neighborHash}`).emit('driver:location:update', {
            driverId: socket.driverId,
            lat: snappedLat,
            lng: snappedLng,
            bearing: data.bearing,
          });
        }

        logger.debug('Driver location broadcast to spatial rooms', {
          driverId: socket.driverId,
          geohash: newGeohash,
          neighborCount: neighbors.length,
        });

        // Calculate distance to active trip pickup/destination
        const activeTrip = await prisma.trip.findFirst({
          where: {
            driverId: socket.driverId,
            status: { in: ['ACCEPTED', 'ARRIVED', 'IN_PROGRESS'] },
          },
        });

        if (activeTrip) {
          const targetLat = activeTrip.status === 'IN_PROGRESS' ? activeTrip.dropLat : activeTrip.pickupLat;
          const targetLng = activeTrip.status === 'IN_PROGRESS' ? activeTrip.dropLng : activeTrip.pickupLng;
          
          const distanceKm = calculateDistance(snappedLat, snappedLng, targetLat, targetLng);
          const etaMinutes = calculateETA(distanceKm);

          // Auto-update status if driver is very close to pickup
          if (activeTrip.status === 'ACCEPTED' && distanceKm < 0.05) {
            await prisma.trip.update({
              where: { id: activeTrip.id },
              data: { status: 'ARRIVED' },
            });
            getIo().to(`user:${activeTrip.riderId}`).emit('trip:driver_arrived', { tripId: activeTrip.id });
          }

          getIo().to(`user:${activeTrip.riderId}`).emit('trip:distance_update', {
            tripId: activeTrip.id,
            distanceKm: parseFloat(distanceKm.toFixed(2)),
            etaMinutes,
            status: activeTrip.status,
          });
        }
      } catch (error) {
        logger.error('Location update error', { error, driverId: socket.driverId });
      }
    });

    // Get Nearby Drivers
    socket.on('rider:get_nearby_drivers', async (data: { lat: number; lng: number; radius?: number }) => {
      try {
        const drivers = await prisma.driver.findMany({
          where: { status: 'ONLINE' },
          include: { location: true, user: true },
        });

        const radius = data.radius || 10;
        const nearbyDrivers = drivers.filter(driver => {
          if (!driver.location) return false;
          const distance = calculateDistance(data.lat, data.lng, driver.location.lat, driver.location.lng);
          return distance <= radius;
        });

        socket.emit('rider:nearby_drivers', nearbyDrivers);
      } catch (error) {
        logger.error('Get nearby drivers error', { error, userId: socket.userId });
      }
    });

    // Trip Requested
    socket.on('trip:request', async (data: { tripId: string; driverId?: string }) => {
      try {
        const trip = await prisma.trip.findUnique({
          where: { id: data.tripId },
          include: { rider: true },
        });

        if (!trip) return;

        if (data.driverId) {
          getIo().to(`driver:${data.driverId}`).emit('trip:requested', trip);
        } else {
          // Use dispatch service instead of broadcasting to all drivers
          logger.warn('Trip request without driverId - use dispatch service');
        }
      } catch (error) {
        logger.error('Trip request error', { error, tripId: data.tripId });
      }
    });

    // Offer Accept/Reject
    socket.on('offer:accept', async (data: { tripId: string }) => {
      if (socket.userRole !== 'DRIVER' || !socket.driverId) return;
      try {
        await dispatchService.acceptOffer(data.tripId, socket.driverId);
        const trip = await prisma.trip.findUnique({
          where: { id: data.tripId },
          include: { rider: true, driver: { include: { user: true } } },
        });
        if (trip) {
          getIo().to(`user:${trip.riderId}`).emit('trip:accepted', trip);
          socket.emit('trip:accepted', trip);
        }
      } catch (error) {
        logger.error('Offer accept error', { error, tripId: data.tripId });
        socket.emit('offer:error', { message: 'Offer expired or already accepted' });
      }
    });

    socket.on('offer:reject', async (data: { tripId: string }) => {
      if (socket.userRole !== 'DRIVER' || !socket.driverId) return;
      try {
        await dispatchService.rejectOffer(data.tripId, socket.driverId, getIo());
      } catch (error) {
        logger.error('Offer reject error', { error, tripId: data.tripId });
      }
    });

    // Trip Accepted (legacy path, now using TripService for atomic accept)
    socket.on('trip:accept', async (data: { tripId: string }) => {
      if (socket.userRole !== 'DRIVER' || !socket.driverId) return;
      try {
        const service = new TripService();
        const trip = await service.acceptTrip(data.tripId, socket.driverId);
        if (trip) {
          getIo().to(`user:${trip.riderId}`).emit('trip:accepted', trip);
          socket.emit('trip:accepted', trip);
        }
      } catch (error) {
        logger.error('Trip accept error', { error, tripId: data.tripId });
        socket.emit('offer:error', { message: 'Trip already accepted or invalid' });
      }
    });

    // Driver Arrived
    socket.on('trip:arrived', async (data: { tripId: string }) => {
      if (socket.userRole !== 'DRIVER' || !socket.driverId) {
        socket.emit('offer:error', { message: 'Driver authentication required' });
        return;
      }

      try {
        const trip = await prisma.trip.findUnique({
          where: { id: data.tripId },
          include: { rider: true, driver: { include: { user: true } } },
        });

        if (!trip) {
          socket.emit('offer:error', { message: 'Trip not found' });
          return;
        }

        if (trip.driverId !== socket.driverId) {
          socket.emit('offer:error', { message: 'Not authorized for this trip' });
          return;
        }

        if (!['ACCEPTED', 'ARRIVED'].includes(trip.status)) {
          socket.emit('offer:error', { message: `Invalid status transition from ${trip.status}` });
          return;
        }

        const updatedTrip =
          trip.status === 'ARRIVED'
            ? trip
            : await prisma.trip.update({
                where: { id: data.tripId },
                data: { status: 'ARRIVED' },
                include: { rider: true, driver: { include: { user: true } } },
              });

        getIo().to(`user:${updatedTrip.riderId}`).emit('trip:driver_arrived', updatedTrip);
        getIo().to(`driver:${socket.driverId}`).emit('trip:driver_arrived', updatedTrip);
      } catch (error) {
        logger.error('Trip arrived error', { error, tripId: data.tripId });
      }
    });

    // Trip Started
    socket.on('trip:start', async (data: { tripId: string }) => {
      if (socket.userRole !== 'DRIVER' || !socket.driverId) {
        socket.emit('offer:error', { message: 'Driver authentication required' });
        return;
      }

      try {
        const trip = await prisma.trip.findUnique({
          where: { id: data.tripId },
          include: { rider: true, driver: { include: { user: true } } },
        });

        if (!trip) {
          socket.emit('offer:error', { message: 'Trip not found' });
          return;
        }

        if (trip.driverId !== socket.driverId) {
          socket.emit('offer:error', { message: 'Not authorized for this trip' });
          return;
        }

        if (!['ARRIVED', 'IN_PROGRESS'].includes(trip.status)) {
          socket.emit('offer:error', { message: `Invalid status transition from ${trip.status}` });
          return;
        }

        const updatedTrip =
          trip.status === 'IN_PROGRESS'
            ? trip
            : await prisma.trip.update({
                where: { id: data.tripId },
                data: { status: 'IN_PROGRESS' },
                include: { rider: true, driver: { include: { user: true } } },
              });

        getIo().to(`user:${updatedTrip.riderId}`).emit('trip:started', updatedTrip);
        if (updatedTrip.driverId) {
          getIo().to(`driver:${updatedTrip.driverId}`).emit('trip:started', updatedTrip);
        }
      } catch (error) {
        logger.error('Trip start error', { error, tripId: data.tripId });
      }
    });

    // Trip Completed
    socket.on('trip:complete', async (data: { tripId: string }) => {
      if (socket.userRole !== 'DRIVER' || !socket.driverId) {
        socket.emit('offer:error', { message: 'Driver authentication required' });
        return;
      }

      try {
        const trip = await prisma.trip.findUnique({
          where: { id: data.tripId },
          include: { rider: true, driver: { include: { user: true } } },
        });

        if (!trip) {
          socket.emit('offer:error', { message: 'Trip not found' });
          return;
        }

        if (trip.driverId !== socket.driverId) {
          socket.emit('offer:error', { message: 'Not authorized for this trip' });
          return;
        }

        if (!['IN_PROGRESS', 'COMPLETED'].includes(trip.status)) {
          socket.emit('offer:error', { message: `Invalid status transition from ${trip.status}` });
          return;
        }

        const updatedTrip =
          trip.status === 'COMPLETED'
            ? trip
            : await prisma.trip.update({
                where: { id: data.tripId },
                data: { status: 'COMPLETED' },
                include: { rider: true, driver: { include: { user: true } } },
              });

        if (trip.status !== 'COMPLETED' && updatedTrip.driverId) {
          await prisma.driver.update({
            where: { id: updatedTrip.driverId },
            data: { status: 'ONLINE', totalTrips: { increment: 1 } },
          });
        }

        getIo().to(`user:${updatedTrip.riderId}`).emit('trip:completed', updatedTrip);
        if (updatedTrip.driverId) {
          getIo().to(`driver:${updatedTrip.driverId}`).emit('trip:completed', updatedTrip);
        }
      } catch (error) {
        logger.error('Trip complete error', { error, tripId: data.tripId });
      }
    });

    socket.on('disconnect', () => {
      logger.info(`User disconnected: ${socket.userId}`);
    });
  });

  return io;
};
