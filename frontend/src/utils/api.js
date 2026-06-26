import axios from 'axios';
import { getAccessToken, setAccessToken, clearAccessToken } from '@/context/AuthContext';
import toast from 'react-hot-toast'; // Add this import

// ─── Base Instance ────────────────────────────────────────────────────────────
const api = axios.create({
  baseURL:         '/api/v1',
  withCredentials: true,
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

// ─── Helper: Parse rate limit response ──────────────────────────────────────
const parseRateLimitError = (error) => {
  const status = error.response?.status;
  if (status !== 429) return null;

  const headers = error.response?.headers || {};
  const retryAfter = headers['retry-after'] || headers['Retry-After'] || null;
  const resetTime = headers['x-ratelimit-reset'] || headers['X-RateLimit-Reset'] || null;
  const limit = headers['x-ratelimit-limit'] || headers['X-RateLimit-Limit'] || null;
  const remaining = headers['x-ratelimit-remaining'] || headers['X-RateLimit-Remaining'] || null;

  // Parse retry-after (can be seconds or HTTP date)
  let waitSeconds = null;
  if (retryAfter) {
    if (!isNaN(retryAfter)) {
      waitSeconds = parseInt(retryAfter, 10);
    } else {
      // If it's a date string, calculate seconds until that date
      try {
        const resetDate = new Date(retryAfter);
        if (!isNaN(resetDate.getTime())) {
          waitSeconds = Math.ceil((resetDate.getTime() - Date.now()) / 1000);
        }
      } catch {
        // Ignore
      }
    }
  } else if (resetTime) {
    // Some APIs send Unix timestamp instead of retry-after
    const resetMs = parseInt(resetTime, 10) * 1000;
    if (!isNaN(resetMs)) {
      waitSeconds = Math.ceil((resetMs - Date.now()) / 1000);
    }
  }

  return {
    statusCode: 429,
    message: error.response?.data?.message || 'Too many requests. Please try again later.',
    waitSeconds: waitSeconds > 0 ? waitSeconds : null,
    limit: limit ? parseInt(limit, 10) : null,
    remaining: remaining ? parseInt(remaining, 10) : null,
    original: error,
  };
};

// ─── Response Interceptor ─────────────────────────────────────────────────────
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // ── Rate limit handling (429) ──────────────────────────────────────────
    if (error.response?.status === 429) {
      const rateLimitInfo = parseRateLimitError(error);
      if (rateLimitInfo) {
        // Create a custom error with rate limit info
        const enhancedError = {
          ...error,
          isRateLimit: true,
          rateLimitInfo,
          message: rateLimitInfo.message,
        };
        return Promise.reject(enhancedError);
      }
    }

    // ── Silent refresh on 401 ──────────────────────────────────────────────
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
      isRateLimit: error.isRateLimit || false,
      rateLimitInfo: error.rateLimitInfo || null,
      original:   error,
    };

    return Promise.reject(normalisedError);
  }
);

export default api;