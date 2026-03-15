process.env.VERCEL = '1';
process.env.NODE_ENV = process.env.NODE_ENV || 'production';

import type { IncomingMessage, ServerResponse } from 'http';

let _app: any = null;
let _err: string | null = null;
let _stack: string | null = null;

const ready = (async () => {
    try {
        const mod = await import('../server.js');
        _app = mod.default;
    } catch (e: any) {
        _err = e?.message || String(e);
        _stack = e?.stack || '';
        console.error('[vercel] CRASH:', _err);
        console.error('[vercel] STACK:', _stack);
    }
})();

export default async function handler(req: IncomingMessage, res: ServerResponse) {
    await ready;
    if (_err || !_app) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ 
            error: 'Server init failed', 
            detail: _err,
            stack: _stack?.split('\n').slice(0, 5)
        }));
        return;
    }
    _app(req, res);
}
