const express = require('express');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Auth endpoints
app.post('/api/auth/login', (req, res) => {
  res.json({ 
    token: 'demo-token',
    user: { id: '1', name: 'Demo User', role: 'rider' }
  });
});

app.post('/api/auth/verify', (req, res) => {
  res.json({ 
    user: { id: '1', name: 'Demo User', role: 'rider', rating: 4.8 }
  });
});

app.post('/api/auth/register', (req, res) => {
  res.json({ 
    user: { id: '1', name: req.body.name, role: req.body.role }
  });
});

// Drivers endpoint
app.get('/api/drivers', (req, res) => {
  res.json([
    {
      id: '1',
      name: 'Driver 1',
      rating: 4.8,
      current_lat: 34.5553,
      current_lng: 69.2075,
      vehicle_model: 'Toyota Corolla',
      status: 'available'
    }
  ]);
});

// Rides endpoints
app.post('/api/rides', (req, res) => {
  res.json({
    id: Date.now().toString(),
    status: 'searching',
    fare: 100,
    ...req.body
  });
});

app.get('/api/rides/:id', (req, res) => {
  res.json({
    id: req.params.id,
    status: 'searching',
    fare: 100
  });
});

// Settings endpoint
app.get('/api/settings', (req, res) => {
  res.json({
    system: {
      defaultCenter: { lat: 34.5553, lng: 69.2075 },
      defaultZoom: 13
    },
    pricing: {
      baseFare: 50,
      perKmRate: 20
    }
  });
});

// Catch all
app.all('*', (req, res) => {
  res.status(404).json({ error: 'Not Found' });
});

module.exports = app;
