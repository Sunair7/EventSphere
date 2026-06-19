import { useState, useEffect, useCallback } from 'react';
import { Outlet, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence }                    from 'framer-motion';
import {
  LayoutDashboard,
  CalendarDays,
  MapPin,
  Users,
  MessageSquare,
  BarChart3,
  Settings,
  LogOut,
  Menu,
  X,
  Bell,
  ChevronDown,
  Building2,
  Ticket,
  BookOpen,
  UserCircle,
  ShieldCheck,
  Compass,
} from 'lucide-react';

import { useAuth }          from '@/context/AuthContext';
import { useSocket }        from '@/context/SocketContext';
import { useUnreadCount }   from '@/hooks/useMessages';
import { clsx }             from '@/utils/cn';

// ─── Navigation config per role ───────────────────────────────────────────────
const NAV_CONFIG = {
  admin: [
    { label: 'Dashboard',   path: '/admin/dashboard',   icon: LayoutDashboard },
    { label: 'Expos',       path: '/admin/expos',       icon: CalendarDays    },
    { label: 'Exhibitors',  path: '/admin/exhibitors',  icon: Building2       },
    { label: 'Users',       path: '/admin/users',       icon: Users           },
    { label: 'Messages',    path: '/admin/messages',    icon: MessageSquare   },
    { label: 'Analytics',   path: '/admin/analytics',   icon: BarChart3       },
    { label: 'Settings',    path: '/admin/settings',    icon: Settings        },
  ],
  exhibitor: [
    { label: 'Dashboard',   path: '/exhibitor/dashboard',   icon: LayoutDashboard },
    { label: 'My Profile',  path: '/exhibitor/profile',     icon: UserCircle      },
    { label: 'Browse Expos',path: '/exhibitor/expos',       icon: Compass         },
    { label: 'Sessions',    path: '/exhibitor/sessions',    icon: BookOpen        },
    { label: 'Messages',    path: '/exhibitor/messages',    icon: MessageSquare   },
    { label: 'Settings',    path: '/exhibitor/settings',    icon: Settings        },
  ],
  attendee: [
    { label: 'Dashboard',   path: '/attendee/dashboard',    icon: LayoutDashboard },
    { label: 'Expos',       path: '/attendee/expos',        icon: Compass         },
    { label: 'Schedule',    path: '/attendee/schedule',     icon: CalendarDays    },
    { label: 'Sessions',    path: '/attendee/sessions',     icon: BookOpen        },
    { label: 'Exhibitors',  path: '/attendee/exhibitors',   icon: Building2       },
    { label: 'Messages',    path: '/attendee/messages',     icon: MessageSquare   },
    { label: 'Settings',    path: '/attendee/settings',     icon: Settings        },
  ],
};

const ROLE_LABELS = {
  admin:     'Admin Portal',
  exhibitor: 'Exhibitor Portal',
  attendee:  'Attendee Hub',
};

// ─── Page transition variants ─────────────────────────────────────────────────
const pageVariants = {
  initial: { opacity: 0, y: 8  },
  animate: { opacity: 1, y: 0  },
  exit:    { opacity: 0, y: -4 },
};

const pageTransition = {
  duration: 0.2,
  ease:     [0.4, 0, 0.2, 1],
};

// ─── Sidebar ──────────────────────────────────────────────────────────────────
function Sidebar({ role, onClose, isMobile = false }) {
  const { user, logout } = useAuth();
  const { data: unreadData } = useUnreadCount();
  const unreadCount = unreadData?.data?.unreadCount || 0;
  const location    = useLocation();
  const navigate    = useNavigate();

  const navItems = NAV_CONFIG[role] || [];

  const handleLogout = async () => {
    if (isMobile && onClose) onClose();
    await logout();
  };

  return (
    <aside className="flex h-full w-sidebar flex-col bg-primary">

      {/* ── Brand header ──────────────────────────────────────────────── */}
      <div className="flex h-16 shrink-0 items-center justify-between px-6 border-b border-white/10">
        <div className="flex flex-col">
          <span className="font-sans text-headline-sm font-semibold leading-tight text-inverse-on-surface">
            EventSphere
          </span>
          <span className="font-mono text-label-sm uppercase tracking-widest text-inverse-on-surface/40">
            {ROLE_LABELS[role]}
          </span>
        </div>
        {isMobile && (
          <button
            onClick={onClose}
            className="rounded p-1.5 text-inverse-on-surface/60 hover:bg-white/10 hover:text-inverse-on-surface transition-colors"
            aria-label="Close navigation"
          >
            <X size={18} />
          </button>
        )}
      </div>

      {/* ── Navigation items ───────────────────────────────────────────── */}
      <nav className="flex-1 overflow-y-auto scrollbar-hidden px-3 py-4" aria-label="Main navigation">
        <ul className="flex flex-col gap-0.5">
          {navItems.map((item) => {
            const Icon        = item.icon;
            const isMessages  = item.path.includes('/messages');
            const isActive    = location.pathname === item.path ||
                                (item.path !== `/${role}/dashboard` &&
                                 location.pathname.startsWith(item.path));

            return (
              <li key={item.path}>
                <NavLink
                  to={item.path}
                  onClick={isMobile ? onClose : undefined}
                  className={({ isActive: navActive }) =>
                    clsx(
                      'group relative flex items-center gap-3 rounded px-3 py-2.5',
                      'text-body-sm font-medium transition-all duration-200',
                      navActive || isActive
                        ? 'bg-white/10 text-inverse-on-surface'
                        : 'text-inverse-on-surface/60 hover:bg-white/8 hover:text-inverse-on-surface/90'
                    )
                  }
                  end={item.path === `/${role}/dashboard`}
                >
                  {({ isActive: navActive }) => (
                    <>
                      {/* Active left-border indicator */}
                      {(navActive || isActive) && (
                        <span className="absolute left-0 top-1/2 h-8 w-selection -translate-y-1/2 rounded-r bg-secondary" />
                      )}

                      <Icon
                        size={18}
                        className={clsx(
                          'shrink-0 transition-colors duration-200',
                          (navActive || isActive)
                            ? 'text-secondary'
                            : 'text-inverse-on-surface/50 group-hover:text-inverse-on-surface/80'
                        )}
                      />

                      <span className="flex-1 truncate">{item.label}</span>

                      {/* Unread badge on messages */}
                      {isMessages && unreadCount > 0 && (
                        <span className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-error px-1.5 font-mono text-label-sm text-on-error">
                          {unreadCount > 99 ? '99+' : unreadCount}
                        </span>
                      )}
                    </>
                  )}
                </NavLink>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* ── User profile footer ────────────────────────────────────────── */}
      <div className="shrink-0 border-t border-white/10 p-3">
        <div className="flex items-center gap-3 rounded px-3 py-2.5">
          {/* Avatar */}
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-secondary/20 text-secondary">
            {user?.avatar ? (
              <img
                src={user.avatar}
                alt={user.name}
                className="h-8 w-8 rounded-full object-cover"
              />
            ) : (
              <span className="font-mono text-label-md font-semibold">
                {user?.name?.charAt(0).toUpperCase()}
              </span>
            )}
          </div>

          {/* Name + role */}
          <div className="min-w-0 flex-1">
            <p className="truncate text-body-sm font-medium text-inverse-on-surface">
              {user?.name}
            </p>
            <p className="font-mono text-label-sm capitalize text-inverse-on-surface/40">
              {user?.role}
            </p>
          </div>

          {/* Logout button */}
          <button
            onClick={handleLogout}
            className="shrink-0 rounded p-1.5 text-inverse-on-surface/40
                       hover:bg-white/10 hover:text-error transition-colors duration-200"
            aria-label="Log out"
            title="Log out"
          >
            <LogOut size={16} />
          </button>
        </div>
      </div>
    </aside>
  );
}

// ─── Top Bar ──────────────────────────────────────────────────────────────────
function TopBar({ role, onMenuClick }) {
  const { user }            = useAuth();
  const { data: unreadData } = useUnreadCount();
  const unreadCount          = unreadData?.data?.unreadCount || 0;
  const navigate             = useNavigate();
  const location             = useLocation();

  // Derive page title from the current path segment
  const segment  = location.pathname.split('/').filter(Boolean);
  const rawLabel = segment[segment.length - 1] || 'dashboard';
  const pageTitle = rawLabel.charAt(0).toUpperCase() + rawLabel.slice(1).replace(/-/g, ' ');

  return (
    <header className="flex h-16 shrink-0 items-center justify-between border-b border-outline-variant bg-surface-bright px-6">

      {/* ── Left: mobile hamburger + breadcrumb ─────────────────────── */}
      <div className="flex items-center gap-3">
        <button
          onClick={onMenuClick}
          className="rounded p-2 text-on-surface-variant hover:bg-surface-container lg:hidden
                     transition-colors duration-200"
          aria-label="Open navigation"
        >
          <Menu size={20} />
        </button>

        <h1 className="text-headline-sm font-semibold text-on-surface capitalize">
          {pageTitle}
        </h1>
      </div>

      {/* ── Right: notifications + user ─────────────────────────────── */}
      <div className="flex items-center gap-2">

        {/* Messages / notification bell */}
        <button
          onClick={() => navigate(`/${role}/messages`)}
          className="relative rounded p-2 text-on-surface-variant
                     hover:bg-surface-container transition-colors duration-200"
          aria-label={`Messages${unreadCount > 0 ? ` (${unreadCount} unread)` : ''}`}
        >
          <MessageSquare size={20} />
          {unreadCount > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-[16px] items-center
                             justify-center rounded-full bg-error px-1 font-mono text-label-sm
                             text-on-error">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </button>

        {/* User chip */}
        <button
          onClick={() => navigate(`/${role}/settings`)}
          className="flex items-center gap-2 rounded px-2 py-1.5
                     hover:bg-surface-container transition-colors duration-200"
        >
          <div className="flex h-7 w-7 items-center justify-center rounded-full
                          bg-primary-container text-on-primary-container">
            {user?.avatar ? (
              <img
                src={user.avatar}
                alt={user.name}
                className="h-7 w-7 rounded-full object-cover"
              />
            ) : (
              <span className="font-mono text-label-sm font-semibold">
                {user?.name?.charAt(0).toUpperCase()}
              </span>
            )}
          </div>
          <span className="hidden text-body-sm font-medium text-on-surface sm:block">
            {user?.name?.split(' ')[0]}
          </span>
        </button>
      </div>
    </header>
  );
}

// ─── DashboardLayout ──────────────────────────────────────────────────────────
export default function DashboardLayout({ role }) {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const location = useLocation();

  // Close mobile nav on route change
  useEffect(() => {
    setMobileNavOpen(false);
  }, [location.pathname]);

  // Prevent body scroll when mobile nav is open
  useEffect(() => {
    document.body.style.overflow = mobileNavOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [mobileNavOpen]);

  const openNav  = useCallback(() => setMobileNavOpen(true),  []);
  const closeNav = useCallback(() => setMobileNavOpen(false), []);

  return (
    <div className="flex h-dvh overflow-hidden bg-background">

      {/* ── Desktop Sidebar (always visible ≥ lg) ───────────────────── */}
      <div className="hidden lg:flex lg:shrink-0">
        <Sidebar role={role} />
      </div>

      {/* ── Mobile Sidebar Drawer ────────────────────────────────────── */}
      <AnimatePresence>
        {mobileNavOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              key="mobile-backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 z-sidebar bg-primary/60 backdrop-blur-sm lg:hidden"
              onClick={closeNav}
              aria-hidden="true"
            />

            {/* Drawer */}
            <motion.div
              key="mobile-drawer"
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', damping: 28, stiffness: 280 }}
              className="fixed inset-y-0 left-0 z-sidebar flex lg:hidden"
            >
              <Sidebar role={role} onClose={closeNav} isMobile />
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* ── Main Content Area ────────────────────────────────────────── */}
      <div className="flex flex-1 flex-col overflow-hidden">

        {/* Top bar */}
        <TopBar role={role} onMenuClick={openNav} />

        {/* Scrollable page content */}
        <main className="flex-1 overflow-y-auto">
          <AnimatePresence mode="wait">
            <motion.div
              key={location.pathname}
              variants={pageVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              transition={pageTransition}
              className="mx-auto w-full max-w-container px-container-pad py-section-gap"
            >
              <Outlet />
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
    </div>
  );
}