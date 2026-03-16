process.env.VERCEL = '1';
process.env.NODE_ENV = 'production';

let app = null;
let initError = null;
let initPromise = null;

function initializeApp() {
    if (initPromise) return initPromise;
    
    initPromise = (async () => {
        try {
            // Initialize database first
            try {
                const dbModule = await import('../init-db-postgres.js');
                await dbModule.initDbIfNeeded();
                console.log('[Vercel] Database initialized');
            } catch (e) {
                console.warn('[Vercel] DB init warning:', e.message);
            }
            
            // Then load server
            const serverModule = await import('../server.js');
            app = serverModule.default;
            console.log('[Vercel] Server loaded');
        } catch (e) {
            initError = e.message;
            console.error('[Vercel] Init failed:', e);
            throw e;
        }
    })();
    
    return initPromise;
}

module.exports = async (req, res) => {
    // CORS headers
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
    res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    try {
        await initializeApp();
    } catch (e) {
        return res.status(500).json({ 
            error: 'Server initialization failed', 
            detail: initError || e.message 
        });
    }

    if (!app) {
        return res.status(500).json({ 
            error: 'Server not initialized', 
            detail: initError 
        });
    }

    return app(req, res);
};
