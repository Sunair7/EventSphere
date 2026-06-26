import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import {
  QueryClient,
  QueryClientProvider,
} from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { Toaster } from 'react-hot-toast';

import App from './App';
import './index.css';

// ─── React Query Client ───────────────────────────────────────────────────────
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Re-fetch on window focus in production only
      refetchOnWindowFocus: import.meta.env.PROD,
      // Stale after 60 seconds
      staleTime:            60 * 1000,
      // Keep unused data in cache for 5 minutes
      gcTime:               5 * 60 * 1000,
      // Retry failed requests once with exponential back-off
      retry:                1,
      retryDelay:           (attempt) => Math.min(1000 * 2 ** attempt, 10_000),
    },
    mutations: {
      // Do not retry mutations — let the UI surface errors immediately
      retry: false,
    },
  },
});

// ─── Toast Config ─────────────────────────────────────────────────────────────
const toastOptions = {
  duration: 4000,
  position: 'bottom-right',
  style: {
    fontFamily: 'var(--font-sans)',
    fontSize: 'var(--text-body-sm)',
    fontWeight: '500',
    background: 'var(--color-surface-bright)',
    color: 'var(--color-on-surface)',
    border: '1px solid var(--color-outline-variant)',
    borderRadius: 'var(--radius)',
    padding: '12px 16px',
    boxShadow: 'var(--shadow-level-2)',
    maxWidth: '380px',
  },
  success: {
    duration: 4000,
    style: {
      background: '#d1fae5',
      color: '#064e3b',
      border: '1px solid #059669',
    },
    iconTheme: {
      primary: '#059669',
      secondary: '#ffffff',
    },
  },
  error: {
    duration: 5000,
    style: {
      background: '#fee2e2',
      color: '#7f1d1d',
      border: '1px solid #dc2626',
    },
    iconTheme: {
      primary: '#dc2626',
      secondary: '#ffffff',
    },
  },
  loading: {
    iconTheme: {
      primary: 'var(--color-secondary)',
      secondary: 'var(--color-secondary-container)',
    },
  },
 // Add rate limit style
  rateLimit: {
    duration: 10000, // longer duration for rate limits
    iconTheme: {
      primary: 'var(--color-warning)',
      secondary: 'var(--color-warning-container)',
    },
    style: {
      background: 'var(--color-warning-container)',
      color: 'var(--color-on-warning-container)',
      border: '1px solid var(--color-warning)',
      maxWidth: '420px',
    },
  },

};
// ─── Mount ────────────────────────────────────────────────────────────────────
const container = document.getElementById('root');

if (!container) {
  throw new Error(
    '[EventSphere] Root element #root not found. Check your index.html.'
  );
}

createRoot(container).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <App />
        <Toaster toastOptions={toastOptions} />
      </BrowserRouter>
      {import.meta.env.DEV && (
        <ReactQueryDevtools
          initialIsOpen={false}
          buttonPosition="bottom-left"
        />
      )}
    </QueryClientProvider>
  </StrictMode>
);