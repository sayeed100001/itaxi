import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { createServer } from 'http';
import { WebSocketService } from './services/websocket.js';

import authRoutes from './routes/auth.js';
import ridesRoutes from './routes/rides.js';
import adminRoutes from './routes/admin.js';

const app = express();
const server = createServer(app);

// Basic Security & Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());

// Initialize Native WebSocket Tracking
WebSocketService.initialize(server);

// Modular Routes Layer
app.use('/api/auth', authRoutes);
app.use('/api/rides', ridesRoutes);
app.use('/api/admin', adminRoutes);

// Healthcheck
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', cluster: process.env.NODE_APP_INSTANCE || 'single' });
});

const PORT = process.env.PORT || 3000;

// Export for PM2 cluster usage OR bind directly
if (process.env.NODE_ENV !== 'test') {
    server.listen(PORT, () => {
        console.log(`[iTaxi Enterprise Engine] Listening on port ${PORT} natively...`);
    });
}

export default app;
