import { lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';

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

// ── Admin Pages ───────────────────────────────────────────────────────────────
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

// ─── App ──────────────────────────────────────────────────────────────────────
export default function App() {
  return (
    <AuthProvider>
      <SocketProvider>
        <AnimatePresence mode="wait">
          <Routes>

            {/* ── Public Layout Routes ─────────────────────────────────── */}
            <Route element={<PublicLayout />}>
              <Route
                path="/"
                element={<Lazy><LandingPage /></Lazy>}
              />
            </Route>

            {/* ── Auth Routes (redirect if already logged in) ──────────── */}
            <Route element={<PublicRoute />}>
              <Route path="/login"    element={<Lazy><LoginPage /></Lazy>} />
              <Route path="/register" element={<Lazy><RegisterPage /></Lazy>} />
              <Route path="/forgot-password"         element={<Lazy><ForgotPasswordPage /></Lazy>} />
              <Route path="/reset-password/:token"   element={<Lazy><ResetPasswordPage /></Lazy>} />
              <Route path="/verify-email/:token"     element={<Lazy><VerifyEmailPage /></Lazy>} />
            </Route>

            {/* ── Admin Routes ─────────────────────────────────────────── */}
            <Route
              element={
                <ProtectedRoute allowedRoles={['admin']}>
                  <DashboardLayout role="admin" />
                </ProtectedRoute>
              }
            >
              <Route path="/admin" element={<Navigate to="/admin/dashboard" replace />} />
              <Route path="/admin/dashboard"                  element={<Lazy><AdminDashboard /></Lazy>} />
              <Route path="/admin/expos"                      element={<Lazy><AdminExpos /></Lazy>} />
              <Route path="/admin/expos/create"               element={<Lazy><AdminExpoCreate /></Lazy>} />
              <Route path="/admin/expos/:id"                  element={<Lazy><AdminExpoDetail /></Lazy>} />
              <Route path="/admin/expos/:id/edit"             element={<Lazy><AdminExpoEdit /></Lazy>} />
              <Route path="/admin/expos/:id/floor-plan"       element={<Lazy><AdminFloorPlan /></Lazy>} />
              <Route path="/admin/expos/:id/sessions"         element={<Lazy><AdminSessions /></Lazy>} />
              <Route path="/admin/expos/:id/sessions/:sid"    element={<Lazy><AdminSessionDetail /></Lazy>} />
              <Route path="/admin/exhibitors"                 element={<Lazy><AdminExhibitors /></Lazy>} />
              <Route path="/admin/exhibitors/:id"             element={<Lazy><AdminExhibitorDetail /></Lazy>} />
              <Route path="/admin/messages"                   element={<Lazy><AdminMessages /></Lazy>} />
              <Route path="/admin/analytics"                  element={<Lazy><AdminAnalytics /></Lazy>} />
              <Route path="/admin/users"                      element={<Lazy><AdminUsers /></Lazy>} />
              <Route path="/admin/users/:id"                  element={<Lazy><AdminUserDetail /></Lazy>} />
              <Route path="/admin/settings"                   element={<Lazy><AccountSettings /></Lazy>} />
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
              <Route path="/exhibitor/dashboard"              element={<Lazy><ExhibitorDashboard /></Lazy>} />
              <Route path="/exhibitor/profile"                element={<Lazy><ExhibitorProfile /></Lazy>} />
              <Route path="/exhibitor/expos"                  element={<Lazy><ExhibitorExpos /></Lazy>} />
              <Route path="/exhibitor/expos/:id"              element={<Lazy><ExhibitorExpoDetail /></Lazy>} />
              <Route path="/exhibitor/expos/:id/floor-plan"   element={<Lazy><ExhibitorFloorPlan /></Lazy>} />
              <Route path="/exhibitor/sessions"               element={<Lazy><ExhibitorSessions /></Lazy>} />
              <Route path="/exhibitor/messages"               element={<Lazy><ExhibitorMessages /></Lazy>} />
              <Route path="/exhibitor/settings"               element={<Lazy><AccountSettings /></Lazy>} />
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
              <Route path="/attendee/dashboard"               element={<Lazy><AttendeeDashboard /></Lazy>} />
              <Route path="/attendee/expos"                   element={<Lazy><AttendeeExpos /></Lazy>} />
              <Route path="/attendee/expos/:id"               element={<Lazy><AttendeeExpoDetail /></Lazy>} />
              <Route path="/attendee/sessions"                element={<Lazy><AttendeeSessions /></Lazy>} />
              <Route path="/attendee/schedule"                element={<Lazy><AttendeeSchedule /></Lazy>} />
              <Route path="/attendee/exhibitors"              element={<Lazy><AttendeeExhibitors /></Lazy>} />
              <Route path="/attendee/messages"                element={<Lazy><AttendeeMessages /></Lazy>} />
              <Route path="/attendee/settings"                element={<Lazy><AccountSettings /></Lazy>} />
            </Route>

            {/* ── Fallback Routes ───────────────────────────────────────── */}
            <Route path="/unauthorised" element={<Lazy><UnauthorisedPage /></Lazy>} />
            <Route path="*"             element={<Lazy><NotFoundPage /></Lazy>} />

          </Routes>
        </AnimatePresence>
      </SocketProvider>
    </AuthProvider>
  );
}