process.env.VERCEL = '1';
process.env.NODE_ENV = process.env.NODE_ENV || 'production';

import type { VercelRequest, VercelResponse } from '@vercel/node';
import express from 'express';
import cors from 'cors';

let _app: express.Application | null = null;
let _err: string | null = null;
let _dbInitDone = false;

const ready = (async () => {
    try {
        const { default: app } = await import('../server.js');
        _app = app;
    } catch (e: any) {
        _err = e?.message || String(e);
        console.error('[api] crash:', _err);
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

ensureDbInit();

export default async function handler(req: VercelRequest, res: VercelResponse) {
    await ready;

    if (_err || !_app) {
        return res.status(500).json({ error: 'Server init failed', detail: _err });
    }

    // Enable CORS
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
    res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    return _app(req, res);
}
