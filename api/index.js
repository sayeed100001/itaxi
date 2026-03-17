// Vercel Serverless Function - Lightweight wrapper
process.env.VERCEL = '1';
process.env.NODE_ENV = 'production';

let expressApp = null;
let dbInitialized = false;

async function getApp() {
    if (expressApp) return expressApp;
    
    try {
        // Initialize DB once
        if (!dbInitialized) {
            try {
                const { initDbIfNeeded } = await import('../init-db-postgres.js');
                await initDbIfNeeded();
                dbInitialized = true;
                console.log('[Vercel] ✅ DB initialized');
            } catch (e) {
                console.error('[Vercel] ❌ DB init failed:', e.message);
                throw new Error('Database initialization failed: ' + e.message);
            }
        }
        
        // Load Express app (without Socket.IO)
        const serverModule = await import('../server.js');
        expressApp = serverModule.default;
        console.log('[Vercel] ✅ Express app loaded');
        
        return expressApp;
    } catch (e) {
        console.error('[Vercel] ❌ Fatal error:', e);
        throw e;
    }
}

module.exports = async (req, res) => {
    // CORS
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,PATCH,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type, X-Requested-With');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    try {
        const app = await getApp();
        return app(req, res);
    } catch (error) {
        console.error('[Vercel] Request failed:', error);
        return res.status(500).json({ 
            error: 'Internal Server Error',
            message: error.message,
            timestamp: new Date().toISOString()
        });
    }
};
