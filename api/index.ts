// Vercel Serverless Entry Point for iTaxi API
// This file is the single handler for all /api/* routes on Vercel.

import type { IncomingMessage, ServerResponse } from 'http';

// Must be set before server.ts is imported so it skips httpServer.listen()
process.env.VERCEL = '1';
process.env.NODE_ENV = process.env.NODE_ENV || 'production';

// Lazy-load the Express app to avoid cold-start issues
let appPromise: Promise<any> | null = null;

function getApp() {
    if (!appPromise) {
        appPromise = import('../server.js').then(m => m.default);
    }
    return appPromise;
}

export default async function handler(req: IncomingMessage, res: ServerResponse) {
    const app = await getApp();
    return app(req, res);
}
