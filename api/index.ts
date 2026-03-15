// Vercel Serverless Entry Point
// Sets VERCEL=1 before any imports
process.env.VERCEL = '1';
process.env.NODE_ENV = process.env.NODE_ENV || 'production';

import type { IncomingMessage, ServerResponse } from 'http';

let _app: any = null;
let _err: string | null = null;

// Initialize once
const ready = (async () => {
    try {
        const mod = await import('../server.js');
        _app = mod.default;
        // Init DB in background
        import('../init-db-postgres.js')
            .then((m: any) => m.initDbIfNeeded?.())
            .catch((e: any) => console.warn('[db-init]', e?.message));
    } catch (e: any) {
        _err = e?.message || String(e);
        console.error('[vercel-handler] init error:', _err, e?.stack);
    }
})();

export default async function handler(req: IncomingMessage, res: ServerResponse) {
    await ready;
    if (_err || !_app) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Init failed', detail: _err }));
        return;
    }
    _app(req, res);
}
