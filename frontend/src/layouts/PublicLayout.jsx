import { Link, Outlet, useNavigate } from 'react-router-dom';
import { motion }                     from 'framer-motion';
import { CalendarDays }               from 'lucide-react';
import { useAuth }                    from '@/context/AuthContext';
import { ROLE_HOME }                  from '@/App';

// ─── Page transition ──────────────────────────────────────────────────────────
const pageVariants = {
  initial: { opacity: 0, y: 6  },
  animate: { opacity: 1, y: 0  },
  exit:    { opacity: 0, y: -4 },
};

export default function PublicLayout() {
  const { isAuth, user } = useAuth();
  const navigate          = useNavigate();

  const handleDashboardClick = () => {
    if (isAuth && user) navigate(ROLE_HOME[user.role] || '/');
  };

  return (
    <div className="flex min-h-dvh flex-col bg-background">

      {/* ── Top Navigation ──────────────────────────────────────────── */}
      <header className="sticky top-0 z-dropdown border-b border-outline-variant bg-surface-bright/90 backdrop-blur-nav-overlay">
        <div className="mx-auto flex h-16 max-w-container items-center justify-between px-container-pad">

          {/* Brand */}
          <Link
            to="/"
            className="flex items-center gap-2.5 no-underline"
            aria-label="EventSphere Home"
          >
            <div className="flex h-8 w-8 items-center justify-center rounded bg-primary">
              <CalendarDays size={16} className="text-on-primary" />
            </div>
            <span className="font-sans text-headline-sm font-semibold text-on-surface">
              EventSphere
            </span>
          </Link>

          {/* Auth actions */}
          <nav className="flex items-center gap-2" aria-label="Site navigation">
            {isAuth ? (
              <button onClick={handleDashboardClick} className="btn-secondary btn-sm">
                Go to Dashboard
              </button>
            ) : (
              <>
                <Link to="/login"    className="btn-ghost btn-sm">Sign In</Link>
                <Link to="/register" className="btn-secondary btn-sm">Get Started</Link>
              </>
            )}
          </nav>
        </div>
      </header>

      {/* ── Page Content ────────────────────────────────────────────── */}
      <main className="flex-1">
        <motion.div
          key="public-page"
          variants={pageVariants}
          initial="initial"
          animate="animate"
          exit="exit"
          transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
        >
          <Outlet />
        </motion.div>
      </main>

      {/* ── Footer ──────────────────────────────────────────────────── */}
      <footer className="border-t border-outline-variant bg-surface-container-low py-8">
        <div className="mx-auto max-w-container px-container-pad">
          <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
            <div className="flex items-center gap-2">
              <div className="flex h-6 w-6 items-center justify-center rounded bg-primary">
                <CalendarDays size={12} className="text-on-primary" />
              </div>
              <span className="font-sans text-body-sm font-medium text-on-surface">
                EventSphere Management
              </span>
            </div>
            <p className="font-mono text-label-sm text-on-surface-variant">
              © {new Date().getFullYear()} EventSphere. Enterprise Event Logistics.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}