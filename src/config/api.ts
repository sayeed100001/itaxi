// API configuration
//
// Goals:
// - Production: use VITE_API_URL from .env.production (Railway backend)
// - Development: use VITE_API_URL from .env.local (localhost:5000)

const trimTrailingSlash = (v: string) => v.replace(/\/+$/, '');
const trimTrailingApiPath = (v: string) => v.replace(/\/api\/?$/i, '');
const ensureApiPath = (v: string) => (v.replace(/\/+$/, '').match(/\/api$/i) ? v.replace(/\/+$/, '') : v.replace(/\/+$/, '') + '/api');

const apiFromEnv =
  ((import.meta as any)?.env?.VITE_API_URL as string | undefined) ||
  ((import.meta as any)?.env?.VITE_API_BASE_URL as string | undefined);
const socketFromEnv =
  ((import.meta as any)?.env?.VITE_SOCKET_URL as string | undefined) ||
  ((import.meta as any)?.env?.VITE_WS_URL as string | undefined) ||
  apiFromEnv;

// API_BASE_URL includes /api prefix
// Example: http://localhost:5000/api or https://itaxi-api.railway.app/api
export const API_BASE_URL =
  apiFromEnv && apiFromEnv.trim()
    ? ensureApiPath(trimTrailingSlash(apiFromEnv.trim()))
    : (import.meta.env.PROD ? window.location.origin + '/api' : '/api');

export const SOCKET_URL =
  socketFromEnv && socketFromEnv.trim()
    ? trimTrailingApiPath(trimTrailingSlash(socketFromEnv.trim()))
    : window.location.origin;

// Detect Vercel deployment
function isVercelDeployment(): boolean {
  if (typeof window === 'undefined') return false;
  return window.location.hostname.includes('vercel.app');
}

// Socket.IO disabled on Vercel (serverless) - only enable with explicit backend URL
export const SOCKET_ENABLED = !!(socketFromEnv && socketFromEnv.trim() && !isVercelDeployment());

if (import.meta.env.PROD) {
  if (!apiFromEnv || !String(apiFromEnv).trim()) {
    console.warn('[config] VITE_API_URL is not set. API will default to same-origin:', API_BASE_URL);
  }
  if (!socketFromEnv || !String(socketFromEnv).trim()) {
    console.warn('[config] VITE_SOCKET_URL is not set. Socket.io disabled on Vercel.');
  }
}
