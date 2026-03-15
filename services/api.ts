import { API_BASE_URL } from '../src/config/api.js';

export const apiFetch = async (endpoint: string, options: RequestInit = {}) => {
    const token = localStorage.getItem('token');
    // For FormData, do NOT set Content-Type (browser sets it with boundary automatically)
    const isFormData = options.body instanceof FormData;
    const headers: Record<string, string> = {
        ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
        ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
        ...(options.headers as Record<string, string> || {})
    };
    // Remove Content-Type if caller explicitly passed empty headers (legacy FormData pattern)
    if ((options.headers as any) && Object.keys(options.headers as any).length === 0 && isFormData) {
        delete headers['Content-Type'];
    }

    const url = endpoint.startsWith('http') ? endpoint : `${API_BASE_URL}${endpoint}`;
    const response = await fetch(url, {
        ...options,
        headers
    });

    // Centralized unauthorized handling.
    // Only trigger logout when we sent a token AND the endpoint is an auth-sensitive one.
    // Avoid logging out on driver status/location endpoints that may 401 due to socket race conditions.
    if (response.status === 401 && token) {
        const path = endpoint.split('?')[0];
        const isDriverTelemetry = /^\/api\/drivers\/[^/]+\/(status|location)$/.test(path);
        if (!isDriverTelemetry) {
            try { localStorage.removeItem('token'); } catch {}
            try {
                window.dispatchEvent(new CustomEvent('itaxi:unauthorized', { detail: { endpoint, url } }));
            } catch {}
        }
    }

    return response;
};
