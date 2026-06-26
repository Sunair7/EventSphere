import { useState, useEffect, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Outlet,
  NavLink,
  useLocation,
  useNavigate,
  Link,
} from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  LayoutDashboard,
  CalendarDays,
  MapPin,
  Bell,
  Users,
  MessageSquare,
  BarChart3,
  Settings,
  LogOut,
  Menu,
  Mail,
  X,
  ChevronLeft,
  ChevronRight,
  Building2,
  Ticket,
  BookOpen,
  UserCircle,
  ShieldCheck,
  Compass,
} from "lucide-react";

import { useAuth } from "@/context/AuthContext";
import { useSocket } from "@/context/SocketContext";
import { useUnreadCount } from "@/hooks/useMessages";
import { cn } from "@/utils/cn";
import api from "@/utils/api"; // ← ADD THIS
import NotificationPanel from "@/components/ui/NotificationPanel"; // ← ADD THIS

// ─── Navigation config per role ───────────────────────────────────────────────
const NAV_CONFIG = {
  admin: [
    { label: "Dashboard", path: "/admin/dashboard", icon: LayoutDashboard },
    { label: "Expos", path: "/admin/expos", icon: CalendarDays },
    { label: "Exhibitors", path: "/admin/exhibitors", icon: Building2 },
    { label: "Users", path: "/admin/users", icon: Users },
    { label: "Messages", path: "/admin/messages", icon: MessageSquare },
    { label: "Analytics", path: "/admin/analytics", icon: BarChart3 },
    { label: "Settings", path: "/admin/settings", icon: Settings },
  ],
  exhibitor: [
    { label: "Dashboard", path: "/exhibitor/dashboard", icon: LayoutDashboard },
    { label: "My Profile", path: "/exhibitor/profile", icon: UserCircle },
    { label: "Browse Expos", path: "/exhibitor/expos", icon: Compass },
    { label: "Sessions", path: "/exhibitor/sessions", icon: BookOpen },
    { label: "Messages", path: "/exhibitor/messages", icon: MessageSquare },
    { label: "Settings", path: "/exhibitor/settings", icon: Settings },
  ],
  attendee: [
    { label: "Dashboard", path: "/attendee/dashboard", icon: LayoutDashboard },
    { label: "Expos", path: "/attendee/expos", icon: Compass },
    { label: "Schedule", path: "/attendee/schedule", icon: CalendarDays },
    { label: "Sessions", path: "/attendee/sessions", icon: BookOpen },
    { label: "Exhibitors", path: "/attendee/exhibitors", icon: Building2 },
    { label: "Messages", path: "/attendee/messages", icon: MessageSquare },
    { label: "Settings", path: "/attendee/settings", icon: Settings },
  ],
};

const ROLE_LABELS = {
  admin: "Admin",
  exhibitor: "Exhibitor",
  attendee: "Attendee",
};

// ─── Page transition variants ─────────────────────────────────────────────────
const pageVariants = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -4 },
};

const pageTransition = {
  duration: 0.2,
  ease: [0.4, 0, 0.2, 1],
};

// ─── Sidebar (unchanged) ─────────────────────────────────────────────────────
function Sidebar({
  role,
  onClose,
  isMobile = false,
  collapsed,
  onToggleCollapse,
}) {
  const { user, logout } = useAuth();
  const { data: unreadData } = useUnreadCount();
  const unreadCount = unreadData?.data?.unreadCount || 0;
  const location = useLocation();
  const navigate = useNavigate();
  const navItems = NAV_CONFIG[role] || [];

  const handleLogout = async () => {
    if (isMobile && onClose) onClose();
    await logout();
  };

  return (
    <aside
      className={cn(
        "flex h-full flex-col bg-primary transition-all duration-300 ease-in-out",
        collapsed && !isMobile ? "w-[72px]" : "w-sidebar",
      )}
    >
      <div
        className={cn(
          "flex h-16 shrink-0 items-center border-b border-white/10 px-4 transition-all duration-300",
          collapsed && !isMobile ? "justify-center" : "justify-between px-6",
        )}
      >
        {(!collapsed || isMobile) && (
          <div className="flex flex-col min-w-0">
            <span className="font-sans text-headline-sm font-semibold leading-tight text-inverse-on-surface truncate">
              EventSphere
            </span>
            <span className="font-mono text-label-sm uppercase tracking-widest text-inverse-on-surface/40">
              {ROLE_LABELS[role]}
            </span>
          </div>
        )}
        {collapsed && !isMobile && (
          <span className="font-mono text-label-md font-bold text-secondary">
            ES
          </span>
        )}
        {isMobile ? (
          <button
            onClick={onClose}
            className="rounded p-1.5 text-inverse-on-surface/60 hover:bg-white/10 hover:text-inverse-on-surface transition-colors"
            aria-label="Close navigation"
          >
            <X size={18} />
          </button>
        ) : (
          <button
            onClick={onToggleCollapse}
            className="rounded p-1.5 text-inverse-on-surface/40 hover:bg-white/10 hover:text-inverse-on-surface/80 transition-colors"
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
          </button>
        )}
      </div>
      <nav
        className="flex-1 overflow-y-auto scrollbar-hidden px-2 py-4"
        aria-label="Main navigation"
      >
        <ul className="flex flex-col gap-0.5">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isMessages = item.path.includes("/messages");
            const isActive =
              location.pathname === item.path ||
              (item.path !== `/${role}/dashboard` &&
                location.pathname.startsWith(item.path));
            return (
              <li key={item.path}>
                <NavLink
                  to={item.path}
                  onClick={isMobile ? onClose : undefined}
                  className={({ isActive: navActive }) =>
                    cn(
                      "group relative flex items-center gap-3 rounded-lg transition-all duration-200",
                      collapsed && !isMobile
                        ? "justify-center px-2 py-3"
                        : "px-3 py-2.5",
                      "text-body-sm font-medium",
                      navActive || isActive
                        ? "bg-white/10 text-inverse-on-surface"
                        : "text-inverse-on-surface/60 hover:bg-white/8 hover:text-inverse-on-surface/90",
                    )
                  }
                  end={item.path === `/${role}/dashboard`}
                  title={collapsed && !isMobile ? item.label : undefined}
                >
                  {({ isActive: navActive }) => (
                    <>
                      {(navActive || isActive) && (
                        <span
                          className={cn(
                            "absolute bg-secondary rounded-r transition-all",
                            collapsed && !isMobile
                              ? "left-0 top-1/2 h-6 w-1 -translate-y-1/2"
                              : "left-0 top-1/2 h-8 w-selection -translate-y-1/2",
                          )}
                        />
                      )}
                      <div className="relative shrink-0">
                        <Icon
                          size={18}
                          className={cn(
                            "transition-colors duration-200",
                            navActive || isActive
                              ? "text-secondary"
                              : "text-inverse-on-surface/50 group-hover:text-inverse-on-surface/80",
                          )}
                        />
                        {isMessages && unreadCount > 0 && (
                          <span
                            className={cn(
                              "absolute flex items-center justify-center rounded-full bg-error font-mono text-label-sm text-on-error",
                              collapsed && !isMobile
                                ? "-top-1 -right-1 h-3.5 w-3.5 text-[8px]"
                                : "-top-1 -right-1 h-4 min-w-[16px] px-1 text-[10px]",
                            )}
                          >
                            {collapsed && !isMobile
                              ? ""
                              : unreadCount > 99
                                ? "99+"
                                : unreadCount}
                          </span>
                        )}
                      </div>
                      {(!collapsed || isMobile) && (
                        <span className="flex-1 truncate">{item.label}</span>
                      )}
                      {isMessages &&
                        unreadCount > 0 &&
                        (!collapsed || isMobile) && (
                          <span className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-error px-1.5 font-mono text-label-sm text-on-error">
                            {unreadCount > 99 ? "99+" : unreadCount}
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
      <div className="shrink-0 border-t border-white/10 p-2">
        <div
          className={cn(
            "flex items-center gap-3 rounded-lg px-2 py-2 transition-all duration-200",
            collapsed && !isMobile && "justify-center px-1",
          )}
        >
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
          {(!collapsed || isMobile) && (
            <>
              <div className="min-w-0 flex-1">
                <p className="truncate text-body-sm font-medium text-inverse-on-surface">
                  {user?.name}
                </p>
                <p className="font-mono text-label-sm capitalize text-inverse-on-surface/40">
                  {user?.role}
                </p>
              </div>
              <button
                onClick={handleLogout}
                className="shrink-0 rounded p-1.5 text-inverse-on-surface/40 hover:bg-white/10 hover:text-error transition-colors duration-200"
                aria-label="Log out"
              >
                <LogOut size={16} />
              </button>
            </>
          )}
        </div>
      </div>
    </aside>
  );
}

// ─── Top Bar ──────────────────────────────────────────────────────────────────
function TopBar({ role, onMenuClick, collapsed, onToggleCollapse }) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { onNotifyEvent } = useSocket();
  const { data: unreadData } = useUnreadCount();
  const unreadCount = unreadData?.data?.unreadCount || 0;
  const navigate = useNavigate();
  const location = useLocation();
  const [showNotifPanel, setShowNotifPanel] = useState(false);

  const segment = location.pathname.split("/").filter(Boolean);
  const rawLabel = segment[segment.length - 1] || "dashboard";
  const pageTitle =
    rawLabel.charAt(0).toUpperCase() + rawLabel.slice(1).replace(/-/g, " ");

  // ── Notifications ─────────────────────────────────────────────────────
  const { data: notifData } = useQuery({
    queryKey: ["notifications", "unread-count"],
    queryFn: async () => {
      const { data } = await api.get("/notifications/unread-count");
      return data.data;
    },
    refetchInterval: 30 * 1000,
  });

  const unreadNotifCount = notifData?.unreadCount || 0;

  // 🔑 Real-time notification badge update via Socket.io
  useEffect(() => {
    const unsubNew = onNotifyEvent("notification:new", () => {
      queryClient.invalidateQueries({
        queryKey: ["notifications", "unread-count"],
      });
      queryClient.invalidateQueries({ queryKey: ["notifications", "list"] });
    });

    const unsubCount = onNotifyEvent("notification:unread_count", () => {
      queryClient.invalidateQueries({
        queryKey: ["notifications", "unread-count"],
      });
    });

    return () => {
      unsubNew();
      unsubCount();
    };
  }, [onNotifyEvent, queryClient]);

  return (
    <header className="flex h-16 shrink-0 items-center justify-between border-b border-outline-variant bg-surface-bright px-4 sm:px-6">
      <div className="flex items-center gap-3">
        <button
          onClick={onMenuClick}
          className="rounded p-2 text-on-surface-variant hover:bg-surface-container lg:hidden transition-colors duration-200"
          aria-label="Open navigation"
        >
          <Menu size={20} />
        </button>
        <button
          onClick={onToggleCollapse}
          className="hidden lg:flex rounded p-1.5 text-on-surface-variant hover:bg-surface-container hover:text-on-surface transition-colors duration-200"
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
        </button>
        <h1 className="text-headline-sm font-semibold text-on-surface capitalize truncate">
          {pageTitle}
        </h1>
      </div>

      <div className="flex items-center gap-1 sm:gap-2">
        {/* Messages */}
        <button
          onClick={() => navigate(`/${role}/messages`)}
          className="relative rounded p-2 text-on-surface-variant hover:bg-surface-container transition-colors duration-200"
          aria-label={`Messages${unreadCount > 0 ? ` (${unreadCount} unread)` : ""}`}
        >
          <MessageSquare size={20} />
          {unreadCount > 0 && (
            <motion.span
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              className="absolute -right-0.5 -top-0.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-error px-1 font-mono text-label-sm text-on-error"
            >
              {unreadCount > 9 ? "9+" : unreadCount}
            </motion.span>
          )}
        </button>

        {/* Notifications Bell */}
        <div className="relative">
          <button
            onClick={() => setShowNotifPanel(!showNotifPanel)}
            className="relative rounded p-2 text-on-surface-variant hover:bg-surface-container transition-colors duration-200"
            aria-label={`Notifications${unreadNotifCount > 0 ? ` (${unreadNotifCount} unread)` : ""}`}
          >
            <Bell size={20} />
            {unreadNotifCount > 0 && (
              <motion.span
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                className="absolute -right-0.5 -top-0.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-error px-1 font-mono text-label-sm text-on-error"
              >
                {unreadNotifCount > 9 ? "9+" : unreadNotifCount}
              </motion.span>
            )}
          </button>
          <AnimatePresence>
            {showNotifPanel && (
              <NotificationPanel
                onClose={() => {
                  setShowNotifPanel(false);
                  queryClient.invalidateQueries({
                    queryKey: ["notifications", "unread-count"],
                  });
                }}
              />
            )}
          </AnimatePresence>
        </div>

        {/* User chip */}
        <button
          onClick={() => navigate(`/${role}/settings`)}
          className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-surface-container transition-colors duration-200"
        >
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary-container text-on-primary-container">
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
            {user?.name?.split(" ")[0]}
          </span>
        </button>
      </div>
    </header>
  );
}

// ─── DashboardLayout ──────────────────────────────────────────────────────────
export default function DashboardLayout({ role }) {
  const { user } = useAuth();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    const saved = localStorage.getItem("sidebarCollapsed");
    return saved === "true";
  });
  const location = useLocation();

  const toggleCollapse = useCallback(() => {
    setSidebarCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem("sidebarCollapsed", String(next));
      return next;
    });
  }, []);

  useEffect(() => {
    setMobileNavOpen(false);
  }, [location.pathname]);
  useEffect(() => {
    document.body.style.overflow = mobileNavOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [mobileNavOpen]);

  const openNav = useCallback(() => setMobileNavOpen(true), []);
  const closeNav = useCallback(() => setMobileNavOpen(false), []);

  return (
    <div className="flex h-dvh overflow-hidden bg-background">
      <div className="hidden lg:flex lg:shrink-0">
        <Sidebar
          role={role}
          collapsed={sidebarCollapsed}
          onToggleCollapse={toggleCollapse}
        />
      </div>
      <AnimatePresence>
        {mobileNavOpen && (
          <>
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
            <motion.div
              key="mobile-drawer"
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ type: "spring", damping: 28, stiffness: 280 }}
              className="fixed inset-y-0 left-0 z-sidebar flex lg:hidden"
            >
              <Sidebar role={role} onClose={closeNav} isMobile />
            </motion.div>
          </>
        )}
      </AnimatePresence>
      <div className="flex flex-1 flex-col overflow-hidden">
        <TopBar
          role={role}
          onMenuClick={openNav}
          collapsed={sidebarCollapsed}
          onToggleCollapse={toggleCollapse}
        />
        {user && !user.isEmailVerified && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            className="shrink-0 bg-warning-container border-b border-warning/20"
          >
            <div className="flex items-center justify-between px-4 sm:px-6 py-2.5">
              <div className="flex items-center gap-2 min-w-0">
                <Mail
                  size={14}
                  className="text-on-warning-container shrink-0"
                />
                <p className="text-body-sm text-on-warning-container truncate">
                  <span className="font-semibold">Verify your email</span> —
                  Check your inbox for the verification link.{" "}
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0 ml-3">
                <Link
                  to={`/${role}/settings`}
                  className="font-mono text-label-sm font-medium text-on-warning-container underline hover:opacity-80 whitespace-nowrap"
                >
                  Resend
                </Link>
              </div>
            </div>
          </motion.div>
        )}
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
