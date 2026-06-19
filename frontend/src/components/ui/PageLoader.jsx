import { motion } from 'framer-motion';

/**
 * PageLoader
 *
 * Full-screen loading overlay used for:
 * - Auth hydration (before user state is known)
 * - Route-level <Suspense> fallbacks (lazy-loaded pages)
 * - Any critical async gate before the page can render
 *
 * Design: Deep Navy background with an animated teal ring + wordmark
 * — matches the sidebar palette so the transition to the dashboard feels seamless.
 */
export default function PageLoader() {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-primary"
      aria-label="Loading EventSphere"
      role="status"
    >
      {/* ── Spinner ─────────────────────────────────────────────────────── */}
      <div className="relative mb-6 flex h-16 w-16 items-center justify-center">
        {/* Outer ring — static */}
        <span className="absolute inset-0 rounded-full border-2 border-white/10" />

        {/* Spinning arc */}
        <motion.span
          className="absolute inset-0 rounded-full border-2 border-transparent border-t-secondary"
          animate={{ rotate: 360 }}
          transition={{
            repeat:   Infinity,
            duration: 0.9,
            ease:     'linear',
          }}
        />

        {/* Inner dot */}
        <span className="h-2.5 w-2.5 rounded-full bg-secondary" />
      </div>

      {/* ── Wordmark ────────────────────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15, duration: 0.3 }}
        className="flex flex-col items-center gap-1"
      >
        <span className="font-sans text-headline-sm font-semibold tracking-tight text-inverse-on-surface">
          EventSphere
        </span>
        <span className="font-mono text-label-sm uppercase tracking-widest text-inverse-on-surface/40">
          Management
        </span>
      </motion.div>
    </motion.div>
  );
}