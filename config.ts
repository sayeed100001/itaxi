/**
 * Central API configuration for iTaxi frontend.
 * - Dev: uses Vite proxy (/api -> gateway)
 * - Production: VITE_API_URL or same-origin /api
 */
export const API_BASE =
  (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_API_URL) || '/api';

export const getApiUrl = (path: string) => {
  const p = path.startsWith('/') ? path : `/${path}`;
  return `${API_BASE}${p}`;
};
