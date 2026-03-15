// Vercel Serverless Entry Point
// Sets VERCEL=1 BEFORE any imports so server.ts skips httpServer.listen()
// and skips filesystem operations that fail in serverless

process.env.VERCEL = '1';
process.env.NODE_ENV = process.env.NODE_ENV || 'production';

import type { IncomingMessage, ServerResponse } from 'http';

let handler: ((req: IncomingMessage, res: ServerResponse) => void) | null = null;
let initError: Error | null = null;
let initialized = false;

async function init() {
    if (initialized) return;
    initialized = true;
    try {
        const mod = await import('../server.js');
        handler = mod.default as any;
        // Run DB init in background (non-blocking)
        try {
            const dbMod = await import('../init-db-postgres.js');
            await (dbMod as any).initDbIfNeeded();
        } catch (e: any) {
            console.warn('[vercel] DB init warning:', e?.message);
        }
    } catch (e: any) {
        initError = e;
        console.error('[vercel] Failed to load server:', e?.message, e?.stack);
    }
}

// Pre-warm on module load
init().catch(console.error);

export default async function vercelHandler(req: IncomingMessage, res: ServerResponse) {
    if (!initialized) await init();
    
    if (initError || !handler) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ 
            error: 'Server initialization failed', 
            detail: initError?.message || 'No handler'
        }));
        return;
    }
    
    return handler(req, res);
}
