import { VercelRequest, VercelResponse } from '@vercel/node';

const demoUser = { id: '1', name: 'Demo User', role: 'rider', rating: 4.8, phone: '+93123456789', email: 'demo@itaxi.local' };
const demoToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjEiLCJyb2xlIjoicmlkZXIifQ.demo';

export default function handler(req: VercelRequest, res: VercelResponse) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  const path = req.url || '';

  // Health check
  if (path === '/api/health') {
    return res.json({ status: 'ok', timestamp: new Date().toISOString() });
  }

  if (path === '/api/ready') {
    return res.json({ status: 'ready' });
  }

  // Auth endpoints
  if (path === '/api/auth/login' && req.method === 'POST') {
    return res.json({ token: demoToken, user: demoUser });
  }

  if (path === '/api/auth/verify' && req.method === 'POST') {
    return res.json({ user: demoUser });
  }

  if (path === '/api/auth/register' && req.method === 'POST') {
    return res.json({ 
      user: { 
        id: Date.now().toString(),
        name: req.body?.name || 'New User',
        role: req.body?.role || 'rider',
        phone: req.body?.phone,
        email: req.body?.email
      }
    });
  }

  // Drivers
  if (path.startsWith('/api/drivers') && req.method === 'GET') {
    return res.json([
      {
        id: 'd1',
        name: 'Driver 1',
        rating: 4.8,
        current_lat: 34.5553,
        current_lng: 69.2075,
        vehicle_model: 'Toyota Corolla',
        vehicle_plate: 'KBL-1234',
        status: 'available',
        total_rides: 150
      }
    ]);
  }

  if (path === '/api/drivers/location' && req.method === 'POST') {
    return res.json({ status: 'updated' });
  }

  // Rides
  if (path === '/api/rides' && req.method === 'POST') {
    return res.json({
      id: Date.now().toString(),
      status: 'searching',
      fare: req.body?.proposedFare || 100,
      distance: req.body?.distance || 5000,
      serviceType: req.body?.serviceType || 'city',
      pickupLocation: req.body?.pickupLoc,
      destinationLocation: req.body?.destLoc,
      timestamp: Date.now()
    });
  }

  if (path.match(/^\/api\/rides\/[^/]+$/) && req.method === 'GET') {
    const id = path.split('/').pop();
    return res.json({
      id,
      status: 'searching',
      fare: 100,
      driver: null
    });
  }

  if (path.match(/^\/api\/rides\/[^/]+\/status$/) && req.method === 'PUT') {
    const id = path.split('/')[3];
    return res.json({
      id,
      status: req.body?.status || 'accepted'
    });
  }

  if (path.match(/^\/api\/rides\/user\/[^/]+$/) && req.method === 'GET') {
    return res.json([]);
  }

  // Settings
  if (path === '/api/settings') {
    return res.json({
      system: {
        defaultCenter: { lat: 34.5553, lng: 69.2075 },
        defaultZoom: 13
      },
      pricing: {
        baseFare: 50,
        perKmRate: 20,
        commissionRate: 20
      },
      routingProvider: 'osrm'
    });
  }

  // Wallet
  if (path.match(/^\/api\/wallet\/[^/]+$/) && req.method === 'GET') {
    return res.json({
      balance: 1000,
      transactions: []
    });
  }

  // POIs
  if (path === '/api/pois') {
    return res.json({
      provider: 'demo',
      pois: []
    });
  }

  // Route
  if (path === '/api/route' && req.method === 'POST') {
    return res.json({
      coordinates: [[34.5553, 69.2075], [34.5560, 69.2080]],
      distance: 1000,
      duration: 300
    });
  }

  // 404
  return res.status(404).json({ error: 'Not Found' });
}
