import { Navigate, Outlet } from 'react-router-dom';
import { useAuth }           from '@/context/AuthContext';
import { ROLE_HOME }         from '@/App';
import PageLoader            from '@/components/ui/PageLoader';

/**
 * PublicRoute
 *
 * Wraps auth pages (login, register, forgot-password, etc.)
 *
 * Behaviour:
 * - While auth is hydrating (isLoading) → show <PageLoader /> (prevents flash)
 * - Authenticated → redirect to the user's role home dashboard
 * - Not authenticated → render children / <Outlet />
 *
 * Usage (in App.jsx):
 *   <Route element={<PublicRoute />}>
 *     <Route path="/login"    element={<LoginPage />} />
 *     <Route path="/register" element={<RegisterPage />} />
 *   </Route>
 */
export default function PublicRoute() {
  const { isAuth, isLoading, user } = useAuth();

  // ── Auth hydration in progress ──────────────────────────────────────────────
  if (isLoading) {
    return <PageLoader />;
  }

  // ── Already authenticated — send to role dashboard ──────────────────────────
  if (isAuth && user) {
    const destination = ROLE_HOME[user.role] || '/';
    return <Navigate to={destination} replace />;
  }

  // ── Not authenticated — render the auth page ────────────────────────────────
  return <Outlet />;
}