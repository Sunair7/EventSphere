import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useNavigate }   from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import toast              from 'react-hot-toast';

import api                from '@/utils/api';
import { ROLE_HOME }      from '@/App';

// ─── Context ──────────────────────────────────────────────────────────────────
const AuthContext = createContext(null);

// ─── Token helpers (memory-only — never localStorage) ─────────────────────────
let _accessToken = null;

export const getAccessToken  = ()      => _accessToken;
export const setAccessToken  = (token) => { _accessToken = token; };
export const clearAccessToken = ()     => { _accessToken = null;  };

// ─── Provider ─────────────────────────────────────────────────────────────────
export function AuthProvider({ children }) {
  const navigate     = useNavigate();
  const queryClient  = useQueryClient();

  const [user,          setUser]          = useState(null);
  const [isLoading,     setIsLoading]     = useState(true);  // true on mount (hydration)
  const [isRefreshing,  setIsRefreshing]  = useState(false);

  const refreshTimerRef = useRef(null);

  // ── Schedule silent token refresh ──────────────────────────────────────────
  // Refreshes the access token 60 seconds before it expires.
  // JWT_ACCESS_EXPIRES_IN defaults to 15 minutes = 900s.
  const scheduleRefresh = useCallback((expiresInMs = 14 * 60 * 1000) => {
    if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);

    const delay = Math.max(expiresInMs - 60_000, 10_000);

    refreshTimerRef.current = setTimeout(async () => {
      try {
        const { data } = await api.post('/auth/refresh-token');
        setAccessToken(data.data.accessToken);
        scheduleRefresh();
      } catch {
        // Refresh failed — session has ended
        handleLogout({ silent: true });
      }
    }, delay);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Hydrate user on mount (silent refresh) ─────────────────────────────────
  useEffect(() => {
    const hydrate = async () => {
      try {
        // Attempt to get a fresh access token using the HttpOnly refresh cookie
        const { data: refreshData } = await api.post('/auth/refresh-token');
        setAccessToken(refreshData.data.accessToken);

        // Fetch the authenticated user's profile
        const { data: meData } = await api.get('/auth/me');
        setUser(meData.data.user);

        // Schedule next silent refresh
        scheduleRefresh();
      } catch {
        // No valid session — user is unauthenticated
        clearAccessToken();
        setUser(null);
      } finally {
        setIsLoading(false);
      }
    };

    hydrate();

    return () => {
      if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Login ──────────────────────────────────────────────────────────────────
  const login = useCallback(async ({ email, password }) => {
    const { data } = await api.post('/auth/login', { email, password });
    const { accessToken, user: loggedInUser } = data.data;

    setAccessToken(loggedInUser);
    setAccessToken(accessToken);
    setUser(loggedInUser);
    scheduleRefresh();

    toast.success(`Welcome back, ${loggedInUser.name.split(' ')[0]}!`);

    // Role-based redirect
    navigate(ROLE_HOME[loggedInUser.role] || '/', { replace: true });

    return loggedInUser;
  }, [navigate, scheduleRefresh]);

  // ── Register ───────────────────────────────────────────────────────────────
  const register = useCallback(async (payload) => {
    const { data } = await api.post('/auth/register', payload);
    const { accessToken, user: newUser } = data.data;

    setAccessToken(accessToken);
    setUser(newUser);
    scheduleRefresh();

    toast.success('Account created successfully!');
    navigate(ROLE_HOME[newUser.role] || '/', { replace: true });

    return newUser;
  }, [navigate, scheduleRefresh]);

  // ── Logout ─────────────────────────────────────────────────────────────────
  const handleLogout = useCallback(async ({ silent = false } = {}) => {
    if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);

    try {
      await api.post('/auth/logout');
    } catch {
      // Best-effort — cookie will expire regardless
    }

    clearAccessToken();
    setUser(null);

    // Clear all cached query data on logout
    queryClient.clear();

    if (!silent) {
      toast.success('Logged out successfully.');
    }

    navigate('/login', { replace: true });
  }, [navigate, queryClient]);

  // ── Update local user state (used after profile edits) ────────────────────
  const updateUser = useCallback((updates) => {
    setUser((prev) => prev ? { ...prev, ...updates } : prev);
  }, []);

  // ── Refresh current user from API ─────────────────────────────────────────
  const refreshUser = useCallback(async () => {
    try {
      const { data } = await api.get('/auth/me');
      setUser(data.data.user);
      return data.data.user;
    } catch {
      return null;
    }
  }, []);

  // ── Role helpers ───────────────────────────────────────────────────────────
  const isAdmin     = user?.role === 'admin';
  const isExhibitor = user?.role === 'exhibitor';
  const isAttendee  = user?.role === 'attendee';
  const isAuth      = !!user;

  const hasRole = useCallback(
    (...roles) => !!user && roles.includes(user.role),
    [user]
  );

  // ─── Memoised context value ────────────────────────────────────────────────
  const value = useMemo(() => ({
    user,
    isLoading,
    isRefreshing,
    isAuth,
    isAdmin,
    isExhibitor,
    isAttendee,
    hasRole,
    login,
    register,
    logout:      handleLogout,
    updateUser,
    refreshUser,
  }), [
    user,
    isLoading,
    isRefreshing,
    isAuth,
    isAdmin,
    isExhibitor,
    isAttendee,
    hasRole,
    login,
    register,
    handleLogout,
    updateUser,
    refreshUser,
  ]);

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

// ─── Hook ─────────────────────────────────────────────────────────────────────
export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error('useAuth must be used within an <AuthProvider>.');
  }

  return context;
}

export default AuthContext;