import axios from 'axios';
import { API_BASE } from '../config';

export const api = axios.create({
  baseURL: API_BASE,
  withCredentials: false,
  timeout: 30000,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers = config.headers || {};
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error?.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('refreshToken');
      localStorage.removeItem('user');
      if (!window.location.hash.includes('login')) {
        window.location.hash = '#/login';
      }
    }
    return Promise.reject(error);
  }
);

type UserRole = 'RIDER' | 'DRIVER' | 'ADMIN';

export const authService = {
  sendOTP: (payload: { phone: string; name?: string; role?: UserRole }) =>
    api.post('/auth/request-otp', payload),
  verifyOTP: (payload: { phone: string; code: string; name?: string; role?: UserRole }) =>
    api.post('/auth/verify-otp', payload),
  adminLogin: (payload: { email: string; password: string }) =>
    api.post('/auth/admin-login', payload),
};

export default api;
