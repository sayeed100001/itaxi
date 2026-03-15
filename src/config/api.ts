// API configuration
//
// Goals:
// - Production: default to same-origin (server serves `dist/` + `/api` + socket.io).
// - Development: default to same-origin so Vite can proxy `/api` and `/socket.io`.
//   Override with `VITE_API_URL` (or `VITE_API_BASE_URL`) / `VITE_SOCKET_URL` when needed.

const trimTrailingSlash = (v: string) => v.replace(/\/+$/, '');

const apiFromEnv =
  ((import.meta as any)?.env?.VITE_API_URL as string | undefined) ||
  ((import.meta as any)?.env?.VITE_API_BASE_URL as string | undefined);
const socketFromEnv =
  ((import.meta as any)?.env?.VITE_SOCKET_URL as string | undefined) ||
  ((import.meta as any)?.env?.VITE_WS_URL as string | undefined) ||
  apiFromEnv;

export const API_BASE_URL =
  apiFromEnv && apiFromEnv.trim()
    ? trimTrailingSlash(apiFromEnv.trim())
    : (import.meta.env.PROD ? window.location.origin : '');

export const SOCKET_URL =
  socketFromEnv && socketFromEnv.trim()
    ? trimTrailingSlash(socketFromEnv.trim())
    : window.location.origin;

// Only attempt socket connection when a dedicated backend URL is configured.
// On Vercel (serverless), same-origin has no persistent socket support.
export const SOCKET_ENABLED = !!(socketFromEnv && socketFromEnv.trim());

if (import.meta.env.PROD) {
  // In Vercel->Railway split deployments, same-origin usually points at the Vercel static site (no backend).
  // Keep the fallback for single-origin deployments, but warn so misconfigurations are obvious.
  if (!apiFromEnv || !String(apiFromEnv).trim()) {
    // eslint-disable-next-line no-console
    console.warn('[config] VITE_API_URL is not set. API will default to same-origin:', API_BASE_URL);
  }
  if (!socketFromEnv || !String(socketFromEnv).trim()) {
    // eslint-disable-next-line no-console
    console.warn('[config] VITE_SOCKET_URL is not set. Socket.io will default to same-origin:', SOCKET_URL);
  }
}
