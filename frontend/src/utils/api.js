import axios from 'axios';
import { getAccessToken, setAccessToken, clearAccessToken } from '@/context/AuthContext';

// ─── Base Instance ────────────────────────────────────────────────────────────
const api = axios.create({
  baseURL:         '/api/v1',
  withCredentials: true,          // Send HttpOnly refresh cookie on every request
  timeout:         15_000,
  headers: {
    'Content-Type': 'application/json',
    Accept:         'application/json',
  },
});

// A clean instance that shares settings but bypassing global interceptors
const authRefreshInstance = axios.create({
  baseURL:         '/api/v1',
  withCredentials: true,
  timeout:         10_000,
});

// ─── Request Interceptor — attach access token ────────────────────────────────
api.interceptors.request.use(
  (config) => {
    const token = getAccessToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// ─── Silent Refresh State ─────────────────────────────────────────────────────
let isRefreshingToken   = false;
let pendingRequestsQueue    = [];

const processPendingQueue = (error, token = null) => {
  pendingRequestsQueue.forEach(({ resolve, reject }) => {
    if (error) reject(error);
    else       resolve(token);
  });
  pendingRequestsQueue = [];
};

// ─── Response Interceptor — handle 401 with silent refresh ───────────────────
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // Only attempt silent refresh on 401 responses that haven't been retried
    if (
      error.response?.status === 401 &&
      !originalRequest._retried &&
      !originalRequest.url?.includes('/auth/refresh-token') &&
      !originalRequest.url?.includes('/auth/login')
    ) {
      if (isRefreshingToken) {
        return new Promise((resolve, reject) => {
          pendingRequestsQueue.push({ resolve, reject });
        }).then((token) => {
          originalRequest.headers.Authorization = `Bearer ${token}`;
          return api(originalRequest);
        }).catch((err) => Promise.reject(err));
      }

      originalRequest._retried  = true;
      isRefreshingToken         = true;

      try {
        // ✅ FIX: Use the isolated instance to eliminate interceptor collision
        const { data } = await authRefreshInstance.post('/auth/refresh-token');
        const newToken = data.data.accessToken;

        setAccessToken(newToken);
        processPendingQueue(null, newToken);

        originalRequest.headers.Authorization = `Bearer ${newToken}`;
        return api(originalRequest);
      } catch (refreshError) {
        processPendingQueue(refreshError, null);
        clearAccessToken();

        // Redirect safely
        window.location.href = '/login';
        return Promise.reject(refreshError);
      } finally {
        isRefreshingToken = false;
      }
    }

    // ── Normalise error shape ──────────────────────────────────────────────
    const normalisedError = {
      message:    error.response?.data?.message || 'An unexpected error occurred.',
      errors:     error.response?.data?.errors  || [],
      statusCode: error.response?.status        || 0,
      original:   error,
    };

    return Promise.reject(normalisedError);
  }
);

export default api;