process.env.VERCEL = '1';
process.env.NODE_ENV = process.env.NODE_ENV || 'production';

import type { IncomingMessage, ServerResponse } from 'http';

let _app: any = null;
let _err: string | null = null;
let _dbInitDone = false;

const ready = (async () => {
    try {
        const mod = await import('../server.js');
        _app = mod.default;
    } catch (e: any) {
        _err = e?.message || String(e);
        console.error('[api] crash:', _err, e?.stack?.split('\n').slice(0,5).join(' | '));
    }
})();

async function ensureDbInit() {
    if (_dbInitDone) return;
    _dbInitDone = true;
    try {
        const m: any = await import('../init-db-postgres.js');
        await m.initDbIfNeeded?.();
        console.log('[api] DB init complete');
    } catch (e: any) {
        console.warn('[api] DB init warning:', e?.message);
    }
}

// Trigger DB init immediately
ensureDbInit();

export default async function handler(req: IncomingMessage, res: ServerResponse) {
    await ready;

    if (_err || !_app) {
        (res as any).writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Server init failed', detail: _err }));
        return;
    }

    // Special endpoint to force DB re-init
    if ((req as any).url === '/api/db-init' || (req as any).url?.startsWith('/api/db-init?')) {
        _dbInitDone = false;
        await ensureDbInit();
        (res as any).writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'DB init triggered' }));
        return;
    }

    _app(req, res);
}
