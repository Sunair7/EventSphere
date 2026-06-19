import { defineConfig, loadEnv } from 'vite';
import react                     from '@vitejs/plugin-react';
import tailwindcss               from '@tailwindcss/vite';
import path                      from 'path';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // Load env so we can read VITE_API_URL / VITE_SOCKET_URL at config time
  const env = loadEnv(mode, process.cwd(), '');

  const backendOrigin = env.VITE_API_ORIGIN || 'http://localhost:5000';

  return {
    // ── Plugins ────────────────────────────────────────────────────
    plugins: [
      react({
        // Fast Refresh for all .jsx/.tsx files
        include: '**/*.{jsx,tsx}',
      }),
      tailwindcss(),
    ],

    // ── Path aliases ───────────────────────────────────────────────
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },

    // ── Dev server ─────────────────────────────────────────────────
    server: {
      port:        5173,
      strictPort:  true,
      open:        false,

      proxy: {
        // REST API
        '/api': {
          target:       backendOrigin,
          changeOrigin: true,
          secure:       false,
        },
        // Socket.io (WebSocket upgrade)
        '/socket.io': {
          target:       backendOrigin,
          changeOrigin: true,
          secure:       false,
          ws:           true,
        },
      },
    },

    // ── Preview server (after `vite build`) ────────────────────────
    preview: {
      port: 4173,
    },

    // ── Build ──────────────────────────────────────────────────────
    build: {
      outDir:          'dist',
      sourcemap:       mode !== 'production',
      minify:          'esbuild',
      target:          'es2020',
      chunkSizeWarningLimit: 600,

      rollupOptions: {
        output: {
          // Manually split large third-party libraries into separate
          // chunks so browsers can cache them independently.
          manualChunks: (id) => {
            // React core
            if (id.includes('node_modules/react') ||
                id.includes('node_modules/react-dom') ||
                id.includes('node_modules/scheduler')) {
              return 'react-vendor';
            }

            // React Router
            if (id.includes('node_modules/react-router')) {
              return 'router';
            }

            // React Query
            if (id.includes('node_modules/@tanstack')) {
              return 'query';
            }

            // Framer Motion
            if (id.includes('node_modules/framer-motion')) {
              return 'motion';
            }

            // Recharts + D3 dependencies
            if (id.includes('node_modules/recharts') ||
                id.includes('node_modules/d3')        ||
                id.includes('node_modules/victory')) {
              return 'charts';
            }

            // Socket.io client
            if (id.includes('node_modules/socket.io-client') ||
                id.includes('node_modules/engine.io-client')) {
              return 'socket';
            }

            // Form tooling
            if (id.includes('node_modules/react-hook-form') ||
                id.includes('node_modules/@hookform')        ||
                id.includes('node_modules/zod')) {
              return 'forms';
            }

            // Date utilities
            if (id.includes('node_modules/date-fns')) {
              return 'date-fns';
            }

            // Everything else from node_modules
            if (id.includes('node_modules')) {
              return 'vendor';
            }
          },

          // Stable file names for long-term caching
          entryFileNames:  'assets/[name]-[hash].js',
          chunkFileNames:  'assets/[name]-[hash].js',
          assetFileNames:  'assets/[name]-[hash][extname]',
        },
      },
    },

    // ── Test (Vitest) ──────────────────────────────────────────────
    test: {
      globals:     true,
      environment: 'jsdom',
      setupFiles:  ['./src/test/setup.ts'],
    },

    // ── Environment variable prefix ────────────────────────────────
    // Only VITE_* variables are exposed to the client bundle.
    envPrefix: 'VITE_',
  };
});