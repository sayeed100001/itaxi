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

    // Centralized unauthorized handling without forcing a full page reload.
    // Only trigger when we actually sent an auth token.
    if (response.status === 401 && token) {
        try { localStorage.removeItem('token'); } catch {}
        try {
            window.dispatchEvent(new CustomEvent('itaxi:unauthorized', { detail: { endpoint: endpoint, url } }));
        } catch {}
    }

    return response;
};
