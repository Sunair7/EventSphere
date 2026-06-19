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
    fontFamily:  'Inter, system-ui, sans-serif',
    fontSize:    '14px',
    fontWeight:  '500',
    color:       '#0b1c30',
    background:  '#ffffff',
    border:      '1px solid #e2e8f0',
    borderRadius:'8px',
    padding:     '12px 16px',
    boxShadow:   '0px 4px 12px rgba(15, 23, 42, 0.08)',
    maxWidth:    '380px',
  },
  success: {
    iconTheme: {
      primary:    '#059669',
      secondary:  '#d1fae5',
    },
  },
  error: {
    duration:   5000,
    iconTheme: {
      primary:   '#e11d48',
      secondary: '#ffe4e6',
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