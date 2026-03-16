// Vercel Serverless Function Entry Point
const express = require('express');
const cors = require('cors');

let app = null;
let initError = null;

// Initialize app
(async () => {
    try {
        const serverModule = await import('../server.js');
        app = serverModule.default;
        
        // Initialize database
        try {
            const dbModule = await import('../init-db-postgres.js');
            await dbModule.initDbIfNeeded();
            console.log('[Vercel] Database initialized');
        } catch (e) {
            console.warn('[Vercel] DB init warning:', e.message);
        }
    } catch (e) {
        initError = e.message;
        console.error('[Vercel] Server init failed:', e);
    }
})();

module.exports = async (req, res) => {
    // CORS headers
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
    res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (initError || !app) {
        return res.status(500).json({ 
            error: 'Server initialization failed', 
            detail: initError 
        });
    }

    return app(req, res);
};
