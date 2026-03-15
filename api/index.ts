process.env.VERCEL = '1';
process.env.NODE_ENV = process.env.NODE_ENV || 'production';

import type { IncomingMessage, ServerResponse } from 'http';

let _app: any = null;
let _err: string | null = null;

const ready = (async () => {
    try {
        const mod = await import('../server.js');
        _app = mod.default;
        // Init DB non-blocking
        import('../init-db-postgres.js')
            .then((m: any) => m.initDbIfNeeded?.())
            .catch((e: any) => console.warn('[db]', e?.message));
    } catch (e: any) {
        _err = e?.message || String(e);
        console.error('[api] crash:', _err, e?.stack?.split('\n').slice(0,5).join(' | '));
    }
})();

export default async function handler(req: IncomingMessage, res: ServerResponse) {
    await ready;
    if (_err || !_app) {
        (res as any).status?.(500) || res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Server init failed', detail: _err }));
        return;
    }
    _app(req, res);
}
