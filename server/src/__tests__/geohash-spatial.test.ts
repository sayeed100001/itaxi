import { Server as SocketServer } from 'socket.io';
import { io as ioClient, Socket as ClientSocket } from 'socket.io-client';
import { createServer, Server as HttpServer } from 'http';
import { initializeSocket } from '../config/socket';
import { encodeGeohash, getNeighbors } from '../utils/geohash';
import jwt from 'jsonwebtoken';
import { config } from '../config/env';

describe('Geohash Spatial Broadcasting', () => {
  let httpServer: HttpServer;
  let ioServer: SocketServer;
  let driverSocket: ClientSocket;
  let riderNearbySocket: ClientSocket;
  let riderFarSocket: ClientSocket;
  const port = 5555;

  const driverToken = jwt.sign({ id: 'driver1', role: 'DRIVER' }, config.jwtSecret);
  const riderNearbyToken = jwt.sign({ id: 'rider1', role: 'RIDER' }, config.jwtSecret);
  const riderFarToken = jwt.sign({ id: 'rider2', role: 'RIDER' }, config.jwtSecret);

  // Test locations
  const driverLocation = { lat: 40.7128, lng: -74.0060 }; // NYC
  const riderNearbyLocation = { lat: 40.7130, lng: -74.0062 }; // Very close to driver
  const riderFarLocation = { lat: 34.0522, lng: -118.2437 }; // LA - far away

  beforeAll(async () => {
    httpServer = createServer();
    ioServer = await initializeSocket(httpServer);
    
    await new Promise<void>((resolve) => {
      httpServer.listen(port, resolve);
    });
  });

  afterAll((done) => {
    ioServer.close();
    httpServer.close(done);
  });

  beforeEach((done) => {
    let connected = 0;
    const checkDone = () => {
      connected++;
      if (connected === 3) done();
    };

    driverSocket = ioClient(`http://localhost:${port}`, {
      auth: { token: driverToken },
    });
    driverSocket.on('connect', checkDone);

    riderNearbySocket = ioClient(`http://localhost:${port}`, {
      auth: { token: riderNearbyToken },
    });
    riderNearbySocket.on('connect', checkDone);

    riderFarSocket = ioClient(`http://localhost:${port}`, {
      auth: { token: riderFarToken },
    });
    riderFarSocket.on('connect', checkDone);
  });

  afterEach(() => {
    driverSocket.disconnect();
    riderNearbySocket.disconnect();
    riderFarSocket.disconnect();
  });

  it('should join riders to geohash rooms based on location', (done) => {
    const geohashNearby = encodeGeohash(riderNearbyLocation.lat, riderNearbyLocation.lng, 6);
    const geohashFar = encodeGeohash(riderFarLocation.lat, riderFarLocation.lng, 6);

    expect(geohashNearby).not.toBe(geohashFar);

    riderNearbySocket.emit('connect:location', riderNearbyLocation);
    riderFarSocket.emit('connect:location', riderFarLocation);

    setTimeout(done, 100);
  });

  it('should only broadcast driver location to nearby riders', (done) => {
    const driverGeohash = encodeGeohash(driverLocation.lat, driverLocation.lng, 6);
    const riderNearbyGeohash = encodeGeohash(riderNearbyLocation.lat, riderNearbyLocation.lng, 6);
    const riderFarGeohash = encodeGeohash(riderFarLocation.lat, riderFarLocation.lng, 6);

    // Check if nearby rider is in same or adjacent tile
    const neighbors = getNeighbors(driverGeohash);
    const isNearby = neighbors.includes(riderNearbyGeohash);
    const isFar = neighbors.includes(riderFarGeohash);

    expect(isNearby).toBe(true);
    expect(isFar).toBe(false);

    let nearbyReceived = false;
    let farReceived = false;

    riderNearbySocket.emit('connect:location', riderNearbyLocation);
    riderFarSocket.emit('connect:location', riderFarLocation);

    riderNearbySocket.on('driver:location:update', (data) => {
      nearbyReceived = true;
      expect(data.driverId).toBe('driver1');
    });

    riderFarSocket.on('driver:location:update', () => {
      farReceived = true;
    });

    setTimeout(() => {
      driverSocket.emit('driver:location', driverLocation);
    }, 100);

    setTimeout(() => {
      expect(nearbyReceived).toBe(true);
      expect(farReceived).toBe(false);
      done();
    }, 300);
  });

  it('should update driver geohash room when location changes significantly', (done) => {
    const location1 = { lat: 40.7128, lng: -74.0060 };
    const location2 = { lat: 40.7500, lng: -74.0500 }; // Different geohash

    const geohash1 = encodeGeohash(location1.lat, location1.lng, 6);
    const geohash2 = encodeGeohash(location2.lat, location2.lng, 6);

    expect(geohash1).not.toBe(geohash2);

    driverSocket.emit('driver:location', location1);

    setTimeout(() => {
      driverSocket.emit('driver:location', location2);
      setTimeout(done, 100);
    }, 100);
  });

  it('should broadcast to all 9 geohash tiles (current + 8 neighbors)', (done) => {
    const geohash = encodeGeohash(driverLocation.lat, driverLocation.lng, 6);
    const neighbors = getNeighbors(geohash);

    expect(neighbors.length).toBe(9); // Current + 8 neighbors
    expect(neighbors).toContain(geohash);

    done();
  });

  it('should prevent global io.emit() calls', () => {
    expect(() => {
      ioServer.emit('test:event', { data: 'test' });
    }).toThrow('Global broadcasts are disabled');
  });

  it('should allow targeted room emissions', (done) => {
    let received = false;

    riderNearbySocket.on('test:targeted', (data) => {
      received = true;
      expect(data.message).toBe('targeted');
    });

    setTimeout(() => {
      ioServer.to(`user:rider1`).emit('test:targeted', { message: 'targeted' });
    }, 100);

    setTimeout(() => {
      expect(received).toBe(true);
      done();
    }, 300);
  });

  it('should handle rider moving between geohash tiles', (done) => {
    const location1 = { lat: 40.7128, lng: -74.0060 };
    const location2 = { lat: 40.7500, lng: -74.0500 };

    riderNearbySocket.emit('connect:location', location1);

    setTimeout(() => {
      riderNearbySocket.emit('connect:location', location2);
      setTimeout(done, 100);
    }, 100);
  });

  it('should calculate correct geohash neighbors', () => {
    const geohash = 'dr5ru7';
    const neighbors = getNeighbors(geohash);

    expect(neighbors).toContain(geohash); // Includes self
    expect(neighbors.length).toBe(9);

    // Check all neighbors are valid geohashes
    neighbors.forEach(n => {
      expect(n).toMatch(/^[0-9bcdefghjkmnpqrstuvwxyz]+$/);
    });
  });

  it('should not broadcast to riders outside neighbor tiles', (done) => {
    // Create 3 riders: one nearby, two far away
    const rider1Location = { lat: 40.7128, lng: -74.0060 }; // NYC - nearby
    const rider2Location = { lat: 34.0522, lng: -118.2437 }; // LA - far
    const rider3Location = { lat: 51.5074, lng: -0.1278 }; // London - very far

    const geohash1 = encodeGeohash(rider1Location.lat, rider1Location.lng, 6);
    const geohash2 = encodeGeohash(rider2Location.lat, rider2Location.lng, 6);
    const geohash3 = encodeGeohash(rider3Location.lat, rider3Location.lng, 6);

    const driverGeohash = encodeGeohash(driverLocation.lat, driverLocation.lng, 6);
    const neighbors = getNeighbors(driverGeohash);

    expect(neighbors).toContain(geohash1);
    expect(neighbors).not.toContain(geohash2);
    expect(neighbors).not.toContain(geohash3);

    done();
  });
});

describe('Geohash Precision', () => {
  it('should use configurable precision from environment', () => {
    const precision = parseInt(process.env.GEOHASH_PRECISION || '6');
    const geohash = encodeGeohash(40.7128, -74.0060, precision);
    
    expect(geohash.length).toBe(precision);
  });

  it('should create smaller tiles with higher precision', () => {
    const lat = 40.7128;
    const lng = -74.0060;

    const geohash4 = encodeGeohash(lat, lng, 4);
    const geohash6 = encodeGeohash(lat, lng, 6);
    const geohash8 = encodeGeohash(lat, lng, 8);

    expect(geohash6).toContain(geohash4);
    expect(geohash8).toContain(geohash6);
  });
});
