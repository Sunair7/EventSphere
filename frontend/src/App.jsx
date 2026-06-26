import { lazy, Suspense } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';

import { AuthProvider }            from '@/context/AuthContext';
import { SocketProvider }          from '@/context/SocketContext';
import ProtectedRoute              from '@/components/auth/ProtectedRoute';
import PublicRoute                 from '@/components/auth/PublicRoute';
import DashboardLayout             from '@/layouts/DashboardLayout';
import PublicLayout                from '@/layouts/PublicLayout';
import PageLoader                  from '@/components/ui/PageLoader';

// ─── Lazy-loaded Pages ────────────────────────────────────────────────────────

// Public / Auth
const LandingPage          = lazy(() => import('@/pages/public/LandingPage'));
const LoginPage            = lazy(() => import('@/pages/auth/LoginPage'));
const RegisterPage         = lazy(() => import('@/pages/auth/RegisterPage'));
const ForgotPasswordPage   = lazy(() => import('@/pages/auth/ForgotPasswordPage'));
const ResetPasswordPage    = lazy(() => import('@/pages/auth/ResetPasswordPage'));
const VerifyEmailPage      = lazy(() => import('@/pages/auth/VerifyEmailPage'));

// ─── Admin Pages ───────────────────────────────────────────────────────────────
const AdminDashboard       = lazy(() => import('@/pages/admin/AdminDashboard'));
const AdminExpos           = lazy(() => import('@/pages/admin/expos/AdminExpos'));
const AdminExpoDetail      = lazy(() => import('@/pages/admin/expos/AdminExpoDetail'));
const AdminExpoCreate      = lazy(() => import('@/pages/admin/expos/AdminExpoCreate'));
const AdminExpoEdit        = lazy(() => import('@/pages/admin/expos/AdminExpoEdit'));
const AdminFloorPlan       = lazy(() => import('@/pages/admin/floor-plan/AdminFloorPlan'));
const AdminExhibitors      = lazy(() => import('@/pages/admin/exhibitors/AdminExhibitors'));
const AdminExhibitorDetail = lazy(() => import('@/pages/admin/exhibitors/AdminExhibitorDetail'));
const AdminSessions        = lazy(() => import('@/pages/admin/sessions/AdminSessions'));
const AdminSessionDetail   = lazy(() => import('@/pages/admin/sessions/AdminSessionDetail'));
const AdminMessages        = lazy(() => import('@/pages/admin/messages/AdminMessages'));
const AdminAnalytics       = lazy(() => import('@/pages/admin/analytics/AdminAnalytics'));
const AdminUsers           = lazy(() => import('@/pages/admin/users/AdminUsers'));
const AdminUserDetail      = lazy(() => import('@/pages/admin/users/AdminUserDetail'));

// ── Exhibitor Pages ───────────────────────────────────────────────────────────
const ExhibitorDashboard   = lazy(() => import('@/pages/exhibitor/ExhibitorDashboard'));
const ExhibitorProfile     = lazy(() => import('@/pages/exhibitor/profile/ExhibitorProfile'));
const ExhibitorExpos       = lazy(() => import('@/pages/exhibitor/expos/ExhibitorExpos'));
const ExhibitorExpoDetail  = lazy(() => import('@/pages/exhibitor/expos/ExhibitorExpoDetail'));
const ExhibitorFloorPlan   = lazy(() => import('@/pages/exhibitor/floor-plan/ExhibitorFloorPlan'));
const ExhibitorSessions    = lazy(() => import('@/pages/exhibitor/sessions/ExhibitorSessions'));
const ExhibitorMessages    = lazy(() => import('@/pages/exhibitor/messages/ExhibitorMessages'));

// ── Attendee Pages ────────────────────────────────────────────────────────────
const AttendeeDashboard    = lazy(() => import('@/pages/attendee/AttendeeDashboard'));
const AttendeeExpos        = lazy(() => import('@/pages/attendee/expos/AttendeeExpos'));
const AttendeeExpoDetail   = lazy(() => import('@/pages/attendee/expos/AttendeeExpoDetail'));
const AttendeeSessions     = lazy(() => import('@/pages/attendee/sessions/AttendeeSessions'));
const AttendeeExhibitors   = lazy(() => import('@/pages/attendee/exhibitors/AttendeeExhibitors'));
const AttendeeMessages     = lazy(() => import('@/pages/attendee/messages/AttendeeMessages'));
const AttendeeSchedule     = lazy(() => import('@/pages/attendee/schedule/AttendeeSchedule'));

// Shared across roles
const AccountSettings      = lazy(() => import('@/pages/shared/AccountSettings'));
const NotFoundPage         = lazy(() => import('@/pages/shared/NotFoundPage'));
const UnauthorisedPage     = lazy(() => import('@/pages/shared/UnauthorisedPage'));
const TransactionHistory   = lazy(() => import('@/pages/shared/TransactionHistory')); // ✅ CHANGE: Use the new file
const TransactionDetail    = lazy(() => import('@/pages/shared/TransactionDetail'));

// ─── Page transition variants ─────────────────────────────────────────────────
const pageVariants = {
  initial: { 
    opacity: 0, 
    y: 12,
  },
  animate: { 
    opacity: 1, 
    y: 0,
    transition: {
      duration: 0.25,
      ease: [0.25, 0.46, 0.45, 0.94],
    }
  },
  exit: { 
    opacity: 0, 
    y: -8,
    transition: {
      duration: 0.15,
      ease: [0.55, 0.085, 0.68, 0.53],
    }
  },
};

// ─── Animated page wrapper ────────────────────────────────────────────────────
function AnimatedPage({ children }) {
  return (
    <motion.div
      variants={pageVariants}
      initial="initial"
      animate="animate"
      exit="exit"
      className="w-full"
    >
      {children}
    </motion.div>
  );
}

// ─── Route-level Suspense wrapper ─────────────────────────────────────────────
const Lazy = ({ children }) => (
  <Suspense fallback={<PageLoader />}>{children}</Suspense>
);

// ─── Role → default dashboard path ───────────────────────────────────────────
export const ROLE_HOME = {
  admin:     '/admin/dashboard',
  exhibitor: '/exhibitor/dashboard',
  attendee:  '/attendee/dashboard',
};

// ─── Animated Routes Component ────────────────────────────────────────────────
function AnimatedRoutes() {
  const location = useLocation();

  return (
    <AnimatePresence mode="wait">
      <Routes location={location} key={location.pathname}>
        {/* ── Public Layout Routes ─────────────────────────────────── */}
        <Route element={<PublicLayout />}>
          <Route
            path="/"
            element={
              <Lazy>
                <AnimatedPage>
                  <LandingPage />
                </AnimatedPage>
              </Lazy>
            }
          />
        </Route>

        {/* ── Auth Routes (redirect if already logged in) ──────────── */}
        <Route element={<PublicRoute />}>
          <Route path="/login"    element={<Lazy><AnimatedPage><LoginPage /></AnimatedPage></Lazy>} />
          <Route path="/register" element={<Lazy><AnimatedPage><RegisterPage /></AnimatedPage></Lazy>} />
          <Route path="/forgot-password"         element={<Lazy><AnimatedPage><ForgotPasswordPage /></AnimatedPage></Lazy>} />
          <Route path="/reset-password/:token"   element={<Lazy><AnimatedPage><ResetPasswordPage /></AnimatedPage></Lazy>} />
        </Route>

        <Route path="/verify-email/:token"     element={<Lazy><AnimatedPage><VerifyEmailPage /></AnimatedPage></Lazy>} />

        {/* ── Admin Routes ─────────────────────────────────────────── */}
        <Route
          element={
            <ProtectedRoute allowedRoles={['admin']}>
              <DashboardLayout role="admin" />
            </ProtectedRoute>
          }
        >
          <Route path="/admin" element={<Navigate to="/admin/dashboard" replace />} />
          <Route path="/admin/dashboard"                  element={<Lazy><AnimatedPage><AdminDashboard /></AnimatedPage></Lazy>} />
          <Route path="/admin/expos"                      element={<Lazy><AnimatedPage><AdminExpos /></AnimatedPage></Lazy>} />
          <Route path="/admin/expos/create"               element={<Lazy><AnimatedPage><AdminExpoCreate /></AnimatedPage></Lazy>} />
          <Route path="/admin/expos/:id"                  element={<Lazy><AnimatedPage><AdminExpoDetail /></AnimatedPage></Lazy>} />
          <Route path="/admin/expos/:id/edit"             element={<Lazy><AnimatedPage><AdminExpoEdit /></AnimatedPage></Lazy>} />
          <Route path="/admin/expos/:id/floor-plan"       element={<Lazy><AnimatedPage><AdminFloorPlan /></AnimatedPage></Lazy>} />
          <Route path="/admin/expos/:id/sessions"         element={<Lazy><AnimatedPage><AdminSessions /></AnimatedPage></Lazy>} />
          <Route path="/admin/expos/:id/sessions/:sid"    element={<Lazy><AnimatedPage><AdminSessionDetail /></AnimatedPage></Lazy>} />
          <Route path="/admin/exhibitors"                 element={<Lazy><AnimatedPage><AdminExhibitors /></AnimatedPage></Lazy>} />
          <Route path="/admin/exhibitors/:id"             element={<Lazy><AnimatedPage><AdminExhibitorDetail /></AnimatedPage></Lazy>} />
          <Route path="/admin/messages"                   element={<Lazy><AnimatedPage><AdminMessages /></AnimatedPage></Lazy>} />
          <Route path="/admin/analytics"                  element={<Lazy><AnimatedPage><AdminAnalytics /></AnimatedPage></Lazy>} />
          <Route path="/admin/users"                      element={<Lazy><AnimatedPage><AdminUsers /></AnimatedPage></Lazy>} />
          <Route path="/admin/users/:id"                  element={<Lazy><AnimatedPage><AdminUserDetail /></AnimatedPage></Lazy>} />
          <Route path="/admin/settings"                   element={<Lazy><AnimatedPage><AccountSettings /></AnimatedPage></Lazy>} />
          <Route path="/admin/transactions"               element={<Lazy><AnimatedPage><TransactionHistory /></AnimatedPage></Lazy>} /> {/* ✅ ADD THIS */}
          <Route path="/admin/transactions/:id" element={<Lazy><AnimatedPage><TransactionDetail /></AnimatedPage></Lazy>} />
        </Route>

        {/* ── Exhibitor Routes ─────────────────────────────────────── */}
        <Route
          element={
            <ProtectedRoute allowedRoles={['exhibitor']}>
              <DashboardLayout role="exhibitor" />
            </ProtectedRoute>
          }
        >
          <Route path="/exhibitor" element={<Navigate to="/exhibitor/dashboard" replace />} />
          <Route path="/exhibitor/dashboard"              element={<Lazy><AnimatedPage><ExhibitorDashboard /></AnimatedPage></Lazy>} />
          <Route path="/exhibitor/profile"                element={<Lazy><AnimatedPage><ExhibitorProfile /></AnimatedPage></Lazy>} />
          <Route path="/exhibitor/expos"                  element={<Lazy><AnimatedPage><ExhibitorExpos /></AnimatedPage></Lazy>} />
          <Route path="/exhibitor/expos/:id"              element={<Lazy><AnimatedPage><ExhibitorExpoDetail /></AnimatedPage></Lazy>} />
          <Route path="/exhibitor/expos/:id/floor-plan"   element={<Lazy><AnimatedPage><ExhibitorFloorPlan /></AnimatedPage></Lazy>} />
          <Route path="/exhibitor/sessions"               element={<Lazy><AnimatedPage><ExhibitorSessions /></AnimatedPage></Lazy>} />
          <Route path="/exhibitor/messages"               element={<Lazy><AnimatedPage><ExhibitorMessages /></AnimatedPage></Lazy>} />
          <Route path="/exhibitor/settings"               element={<Lazy><AnimatedPage><AccountSettings /></AnimatedPage></Lazy>} />
          <Route path="/exhibitor/transactions"           element={<Lazy><AnimatedPage><TransactionHistory /></AnimatedPage></Lazy>} /> {/* ✅ ADD THIS */}
          <Route path="/exhibitor/transactions/:id" element={<Lazy><AnimatedPage><TransactionDetail /></AnimatedPage></Lazy>} />
        </Route>

        {/* ── Attendee Routes ──────────────────────────────────────── */}
        <Route
          element={
            <ProtectedRoute allowedRoles={['attendee']}>
              <DashboardLayout role="attendee" />
            </ProtectedRoute>
          }
        >
          <Route path="/attendee" element={<Navigate to="/attendee/dashboard" replace />} />
          <Route path="/attendee/dashboard"               element={<Lazy><AnimatedPage><AttendeeDashboard /></AnimatedPage></Lazy>} />
          <Route path="/attendee/expos"                   element={<Lazy><AnimatedPage><AttendeeExpos /></AnimatedPage></Lazy>} />
          <Route path="/attendee/expos/:id"               element={<Lazy><AnimatedPage><AttendeeExpoDetail /></AnimatedPage></Lazy>} />
          <Route path="/attendee/sessions"                element={<Lazy><AnimatedPage><AttendeeSessions /></AnimatedPage></Lazy>} />
          <Route path="/attendee/schedule"                element={<Lazy><AnimatedPage><AttendeeSchedule /></AnimatedPage></Lazy>} />
          <Route path="/attendee/exhibitors"              element={<Lazy><AnimatedPage><AttendeeExhibitors /></AnimatedPage></Lazy>} />
          <Route path="/attendee/messages"                element={<Lazy><AnimatedPage><AttendeeMessages /></AnimatedPage></Lazy>} />
          <Route path="/attendee/settings"                element={<Lazy><AnimatedPage><AccountSettings /></AnimatedPage></Lazy>} />
          <Route path="/attendee/transactions"            element={<Lazy><AnimatedPage><TransactionHistory /></AnimatedPage></Lazy>} /> {/* ✅ ADD THIS */}
          <Route path="/attendee/transactions/:id" element={<Lazy><AnimatedPage><TransactionDetail /></AnimatedPage></Lazy>} />
        </Route>

        {/* ── Fallback Routes ───────────────────────────────────────── */}
        <Route path="/unauthorised" element={<Lazy><AnimatedPage><UnauthorisedPage /></AnimatedPage></Lazy>} />
        <Route path="*"             element={<Lazy><AnimatedPage><NotFoundPage /></AnimatedPage></Lazy>} />
      </Routes>
    </AnimatePresence>
  );
}

// ─── App ──────────────────────────────────────────────────────────────────────
export default function App() {
  return (
    <AuthProvider>
      <SocketProvider>
        <AnimatedRoutes />
      </SocketProvider>
    </AuthProvider>
  );
}