import { API_BASE_URL } from '../src/config/api';

export const apiFetch = async (endpoint: string, options: RequestInit = {}) => {
    const token = localStorage.getItem('token');
    const headers = {
        'Content-Type': 'application/json',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
        ...options.headers
    };

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
