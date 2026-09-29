import axios, { type AxiosRequestConfig, type InternalAxiosRequestConfig } from 'axios';
import type { User } from '../types';

export const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000/api';

const http = axios.create({
  baseURL: API_URL,
  withCredentials: true, // sends the httpOnly refresh cookie
  timeout: 30000,
  headers: { 'Content-Type': 'application/json' },
});

/** Normalised error object used by every slice + toast handler. */
export interface NormalisedApiError {
  status: number;
  message: string;
  code: string;
  details: unknown;
}

/** Marks a request that has already survived one refresh attempt. */
type RetriableConfig = InternalAxiosRequestConfig & { _retried?: boolean };

/**
 * The access token lives in memory only (15 min lifetime). The refresh token is
 * an httpOnly cookie that JavaScript can never read. A page reload therefore
 * calls POST /auth/refresh to obtain a fresh access token.
 */
let accessToken: string | null = null;
let onSessionExpired: () => void = () => {};
let onTokenRefreshed: (user: User) => void = () => {};

export const setAccessToken = (token: string | null): void => {
  accessToken = token || null;
};
export const getAccessToken = (): string | null => accessToken;
export const setSessionExpiredHandler = (fn: () => void): void => {
  onSessionExpired = fn;
};
export const setTokenRefreshedHandler = (fn: (user: User) => void): void => {
  onTokenRefreshed = fn;
};

const AUTH_FREE_PATHS = ['/auth/login', '/auth/refresh', '/auth/logout', '/auth/change-password'];

http.interceptors.request.use((config) => {
  if (accessToken && !AUTH_FREE_PATHS.some((p) => config.url?.includes(p))) {
    config.headers.Authorization = `Bearer ${accessToken}`;
  }
  return config;
});

/** Single-flight refresh: parallel 401s share one refresh call. */
let refreshPromise: Promise<string> | null = null;

const performRefresh = (): Promise<string> => {
  if (!refreshPromise) {
    refreshPromise = axios
      .post(`${API_URL}/auth/refresh`, {}, { withCredentials: true })
      .then((res) => {
        const { accessToken: token, user } = res.data as { accessToken: string; user?: User };
        setAccessToken(token);
        if (user) onTokenRefreshed(user);
        refreshPromise = null;
        return token;
      })
      .catch((err) => {
        refreshPromise = null;
        throw err;
      });
  }
  return refreshPromise;
};

http.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = (error.config || {}) as RetriableConfig;
    const status = error.response?.status;
    const url = original.url || '';

    if (status === 401 && !original._retried && !AUTH_FREE_PATHS.some((p) => url.includes(p))) {
      original._retried = true;
      try {
        const token = await performRefresh();
        original.headers.set('Authorization', `Bearer ${token}`);
        return http(original as AxiosRequestConfig);
      } catch (refreshError) {
        setAccessToken(null);
        onSessionExpired();
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  },
);

export const toApiError = (error: unknown): NormalisedApiError => {
  const err = error as { response?: { status?: number; data?: Record<string, unknown> }; message?: string };
  const data = err?.response?.data;
  return {
    status: err?.response?.status || 0,
    message: (data?.message as string) || err?.message || 'Something went wrong. Please try again.',
    code: (data?.code as string) || 'UNKNOWN_ERROR',
    details: data?.details ?? null,
  };
};

export default http;
