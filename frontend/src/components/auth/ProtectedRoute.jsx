import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import PageLoader  from '@/components/ui/PageLoader';

/**
 * ProtectedRoute
 *
 * Wraps any set of routes that require authentication and an optional role check.
 *
 * Behaviour:
 * - While auth is hydrating (isLoading) → show <PageLoader /> (no redirect flash)
 * - Not authenticated            → redirect to /login (state preserved for post-login redirect)
 * - Authenticated but wrong role → redirect to /unauthorised
 * - Authenticated + correct role → render children or <Outlet />
 *
 * Usage (in App.jsx):
 *   <Route element={<ProtectedRoute allowedRoles={['admin']}><DashboardLayout /></ProtectedRoute>}>
 *     ...child routes
 *   </Route>
 */
export default function ProtectedRoute({ allowedRoles = [], children }) {
  const { isAuth, isLoading, user } = useAuth();
  const location = useLocation();

  // ── Auth hydration in progress — prevent premature redirect ────────────────
  if (isLoading) {
    return <PageLoader />;
  }

  // ── Not authenticated ───────────────────────────────────────────────────────
  if (!isAuth) {
    return (
      <Navigate
        to="/login"
        replace
        state={{ from: location.pathname }}
      />
    );
  }

  // ── Wrong role ──────────────────────────────────────────────────────────────
  if (allowedRoles.length > 0 && !allowedRoles.includes(user?.role)) {
    return <Navigate to="/unauthorised" replace />;
  }

  // ── Authorised ──────────────────────────────────────────────────────────────
  return children ?? <Outlet />;
}