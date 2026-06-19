import { useNavigate }  from 'react-router-dom';
import { motion }       from 'framer-motion';
import { ShieldOff, Home, LogOut } from 'lucide-react';
import { useAuth }      from '@/context/AuthContext';
import { ROLE_HOME }    from '@/App';

export default function UnauthorisedPage() {
  const { isAuth, user, logout } = useAuth();
  const navigate                  = useNavigate();

  const homeTarget = isAuth && user
    ? ROLE_HOME[user.role] || '/'
    : '/login';

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center px-4 py-20 text-center bg-background">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0  }}
        transition={{ duration: 0.35, ease: [0.4, 0, 0.2, 1] }}
        className="flex flex-col items-center gap-6 max-w-md"
      >
        {/* Icon */}
        <div className="flex h-20 w-20 items-center justify-center rounded-full bg-error-container">
          <ShieldOff size={36} className="text-on-error-container" />
        </div>

        {/* Copy */}
        <div className="flex flex-col gap-2">
          <h1 className="text-headline-lg font-semibold text-on-surface">
            Access denied
          </h1>
          <p className="text-body-md text-on-surface-variant">
            You don't have permission to view this page.
            {isAuth && user && (
              <> Your current role is <span className="font-semibold text-on-surface capitalize">{user.role}</span>.</>
            )}
          </p>
        </div>

        {/* Role info card */}
        {isAuth && user && (
          <div className="w-full rounded-md border border-outline-variant bg-surface-container-low px-5 py-4 text-left">
            <p className="font-mono text-label-sm uppercase tracking-wider text-on-surface-variant mb-2">
              Signed in as
            </p>
            <p className="text-body-sm font-medium text-on-surface">{user.name}</p>
            <p className="font-mono text-label-sm text-on-surface-variant">{user.email}</p>
            <span className="badge badge-info capitalize mt-2 inline-block">{user.role}</span>
          </div>
        )}

        {/* Actions */}
        <div className="flex flex-col items-center gap-3 sm:flex-row w-full sm:justify-center">
          <button
            onClick={() => navigate(homeTarget, { replace: true })}
            className="btn-secondary gap-2"
          >
            <Home size={15} />
            {isAuth ? 'Go to My Dashboard' : 'Sign In'}
          </button>
          {isAuth && (
            <button onClick={() => logout()} className="btn-ghost gap-2">
              <LogOut size={15} /> Sign out
            </button>
          )}
        </div>
      </motion.div>
    </div>
  );
}