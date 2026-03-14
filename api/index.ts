// Vercel Serverless Function Entry Point
// Imports the Express app from server.ts and exports it as the default handler.
// Note: Socket.IO real-time features require a persistent server (Railway/Render).
// For Vercel, all REST API endpoints work fully; Socket.IO falls back gracefully.

import type { VercelRequest, VercelResponse } from '@vercel/node';

// We need to import the app - server.ts exports `app` when VERCEL=1
process.env.VERCEL = '1';

// Dynamic import to ensure env is set before server initializes
const { default: app } = await import('../server.js');

export default function handler(req: VercelRequest, res: VercelResponse) {
    return (app as any)(req, res);
}
