import axios, { type InternalAxiosRequestConfig } from 'axios';
import { tokenStorage } from './storage';

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || '/api/v1',
  timeout: 15_000,
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use((config) => {
  const token = tokenStorage.get();
  if (token && !config.headers.Authorization) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

function requestBearerToken(config: InternalAxiosRequestConfig | undefined): string | undefined {
  const headers = config?.headers;
  if (!headers) return undefined;
  const normalized = typeof headers.get === 'function' ? headers.get('Authorization') : undefined;
  const raw = normalized ?? headers.Authorization;
  if (typeof raw !== 'string' || !raw.startsWith('Bearer ')) return undefined;
  return raw.slice(7);
}

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      const sessionToken = tokenStorage.get();
      const requestToken = requestBearerToken(error.config);
      // Only a request authenticated with the current session token may end that session.
      // Pending-revocation requests carry their own (already invalid) token and must not
      // clear an unrelated session that was established while they were in flight.
      if (sessionToken && requestToken === sessionToken) {
        tokenStorage.clear();
        window.dispatchEvent(new Event('manabi:unauthorized'));
      }
    }
    return Promise.reject(error);
  },
);
