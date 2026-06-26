import { useState } from "react";
import { useParams, Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft,
  User,
  Mail,
  ShieldCheck,
  Building2,
  Ticket,
  CalendarDays,
  Clock,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  UserX,
  UserCheck,
  Edit2,
  Save,
  X,
} from "lucide-react";
import { format } from "date-fns";
import toast from "react-hot-toast";
import api from "@/utils/api";
import { cn } from "@/utils/cn";

// ─── Query keys ───────────────────────────────────────────────────────────────
const userKey = (id) => ["admin", "users", id];

// ─── Role config ──────────────────────────────────────────────────────────────
const ROLE_CONFIG = {
  admin: { badge: "badge-info", icon: ShieldCheck, label: "Admin" },
  exhibitor: { badge: "badge-success", icon: Building2, label: "Exhibitor" },
  attendee: { badge: "badge-neutral", icon: Ticket, label: "Attendee" },
};

// ─── Skeleton ─────────────────────────────────────────────────────────────────
function PageSkeleton() {
  return (
    <div className="flex flex-col gap-6 max-w-2xl">
      <div className="skeleton h-8 w-48 rounded" />
      <div className="skeleton h-32 rounded-md" />
      <div className="grid grid-cols-2 gap-4">
        <div className="skeleton h-40 rounded-md" />
        <div className="skeleton h-40 rounded-md" />
      </div>
    </div>
  );
}

// ─── Inline edit field ────────────────────────────────────────────────────────
function EditableField({ label, value, onSave, type = "text", options }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (draft === value) {
      setEditing(false);
      return;
    }
    setSaving(true);
    try {
      await onSave(draft);
      setEditing(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col gap-1">
      <span className="font-mono text-label-sm text-on-surface-variant">
        {label}
      </span>
      {editing ? (
        <div className="flex items-center gap-2">
          {options ? (
            <select
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              className="input flex-1 py-1.5 text-body-sm"
              autoFocus
            >
              {options.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          ) : (
            <input
              type={type}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              className="input flex-1 py-1.5 text-body-sm"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSave();
                if (e.key === "Escape") {
                  setDraft(value);
                  setEditing(false);
                }
              }}
            />
          )}
          <button
            onClick={handleSave}
            disabled={saving}
            className="rounded p-1.5 text-secondary hover:bg-secondary-container/30 transition-colors"
            aria-label="Save"
          >
            <Save size={14} />
          </button>
          <button
            onClick={() => {
              setDraft(value);
              setEditing(false);
            }}
            className="rounded p-1.5 text-on-surface-variant hover:bg-surface-container transition-colors"
            aria-label="Cancel"
          >
            <X size={14} />
          </button>
        </div>
      ) : (
        <div className="flex items-center gap-2 group">
          <span className="text-body-sm font-medium text-on-surface">
            {value || "—"}
          </span>
          <button
            onClick={() => {
              setDraft(value);
              setEditing(true);
            }}
            className="rounded p-1 text-on-surface-variant sm:opacity-0 sm:group-hover:opacity-100
                       hover:bg-surface-container transition-all"
            aria-label={`Edit ${label}`}
          >
            <Edit2 size={12} />
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function AdminUserDetail() {
  const { id } = useParams();
  const queryClient = useQueryClient();
  const [showDeactivateModal, setShowDeactivateModal] = useState(false);

  // ── Fetch user ──────────────────────────────────────────────────────────────
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: userKey(id),
    queryFn: async () => {
      const { data } = await api.get(`/users/${id}`);
      return data.data;
    },
  });

  const user = data?.user;
  const exhibitorProfile = data?.exhibitorProfile;

  // ── Update mutation ─────────────────────────────────────────────────────────
  const updateMutation = useMutation({
    mutationFn: async (updates) => {
      const { data } = await api.patch(`/users/${id}`, updates);
      return data.data.user;
    },
    onSuccess: () => {
      toast.success("User updated.");
      queryClient.invalidateQueries({ queryKey: userKey(id) });
      queryClient.invalidateQueries({ queryKey: ["admin", "users"] });
    },
    onError: (err) => toast.error(err.message || "Failed to update user."),
  });

  // ── Toggle active mutation ──────────────────────────────────────────────────
  const toggleMutation = useMutation({
    mutationFn: async () => {
      if (user.isActive) {
        await api.delete(`/users/${id}`);
      } else {
        await api.patch(`/users/${id}`, { isActive: true });
      }
    },
    onSuccess: () => {
      toast.success(
        user.isActive ? "Account deactivated." : "Account reactivated.",
      );
      setShowDeactivateModal(false);
      queryClient.invalidateQueries({ queryKey: userKey(id) });
      queryClient.invalidateQueries({ queryKey: ["admin", "users"] });
    },
    onError: (err) =>
      toast.error(err.message || "Failed to update account status."),
  });

  // ── States ──────────────────────────────────────────────────────────────────
  if (isLoading) return <PageSkeleton />;

  if (isError || !user) {
    return (
      <div className="empty-state py-20">
        <div className="empty-state-icon text-error">
          <AlertCircle size={28} />
        </div>
        <h3 className="empty-state-title">User not found</h3>
        <div className="flex gap-2 mt-3">
          <button onClick={() => refetch()} className="btn-ghost btn-sm gap-1">
            <RefreshCw size={13} /> Retry
          </button>
          <Link to="/admin/users" className="btn-ghost btn-sm gap-1.5">
            <ArrowLeft size={14} /> Back
          </Link>
        </div>
      </div>
    );
  }

  const roleCfg = ROLE_CONFIG[user.role] || ROLE_CONFIG.attendee;
  const RoleIcon = roleCfg.icon;

  return (
    <>
      <div className="mx-auto max-w-2xl flex flex-col gap-6">
        {/* ── Header ──────────────────────────────────────────────── */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link to="/admin/users" className="btn-ghost btn-sm gap-1.5">
              <ArrowLeft size={15} /> Users
            </Link>
          </div>
          {/* Only show deactivate/reactivate for non-admin users */}
          {user.role !== "admin" && (
            <button
              onClick={() => setShowDeactivateModal(true)}
              className={cn(
                "btn-ghost btn-sm gap-1.5",
                user.isActive
                  ? "text-error hover:bg-error-container"
                  : "text-secondary hover:bg-secondary-container/30",
              )}
            >
              {user.isActive ? (
                <>
                  <UserX size={14} /> Deactivate
                </>
              ) : (
                <>
                  <UserCheck size={14} /> Reactivate
                </>
              )}
            </button>
          )}
        </div>

        {/* ── Profile card ─────────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="card flex items-start gap-4"
        >
          {/* Avatar */}
          <div
            className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full
                          bg-primary text-on-primary font-sans text-headline-sm font-bold"
          >
            {user.avatar ? (
              <img
                src={user.avatar}
                alt={user.name}
                className="h-16 w-16 rounded-full object-cover"
              />
            ) : (
              user.name?.charAt(0).toUpperCase()
            )}
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <h1 className="text-headline-sm font-semibold text-on-surface">
                {user.name}
              </h1>
              <span className={cn("badge", roleCfg.badge, "capitalize")}>
                {user.role}
              </span>
              {!user.isActive && (
                <span className="badge badge-error">Inactive</span>
              )}
            </div>
            <p className="font-mono text-label-sm text-on-surface-variant">
              {user.email}
            </p>
            <div className="flex items-center gap-3 mt-2 flex-wrap">
              {user.isEmailVerified ? (
                <span className="flex items-center gap-1 font-mono text-label-sm text-secondary">
                  <CheckCircle2 size={12} /> Email verified
                </span>
              ) : (
                <span className="flex items-center gap-1 font-mono text-label-sm text-warning">
                  <AlertCircle size={12} /> Email unverified
                </span>
              )}
              <span className="font-mono text-label-sm text-on-surface-variant">
                Joined {format(new Date(user.createdAt), "MMM d, yyyy")}
              </span>
            </div>
          </div>
        </motion.div>

        {/* ── Editable fields ──────────────────────────────────────── */}
        <div className="card flex flex-col gap-5">
          <h2 className="text-headline-sm font-semibold text-on-surface border-b border-outline-variant pb-3">
            Account Details
          </h2>

          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            <EditableField
              label="Full Name"
              value={user.name}
              onSave={(name) => updateMutation.mutateAsync({ name })}
            />
            <EditableField
              label="Role"
              value={user.role}
              options={[
                { value: "admin", label: "Admin" },
                { value: "exhibitor", label: "Exhibitor" },
                { value: "attendee", label: "Attendee" },
              ]}
              onSave={(role) => updateMutation.mutateAsync({ role })}
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {[
              { label: "Email", value: user.email },
              {
                label: "Last Login",
                value: user.lastLoginAt
                  ? format(new Date(user.lastLoginAt), "MMM d, yyyy HH:mm")
                  : "Never",
              },
              {
                label: "Profile Complete",
                value: user.profileIsComplete ? "Yes" : "No",
              },
              {
                label: "Account Status",
                value: user.isActive ? "Active" : "Inactive",
              },
            ].map(({ label, value }) => (
              <div key={label} className="flex flex-col gap-0.5">
                <span className="font-mono text-label-sm text-on-surface-variant">
                  {label}
                </span>
                <span className="text-body-sm font-medium text-on-surface">
                  {value}
                </span>
              </div>
            ))}
          </div>

          {/* Avatar URL */}
          <EditableField
            label="Avatar URL"
            value={user.avatar || ""}
            type="url"
            onSave={(avatar) =>
              updateMutation.mutateAsync({ avatar: avatar || undefined })
            }
          />
        </div>

        {/* ── Activity stats ───────────────────────────────────────── */}
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {[
            {
              icon: CalendarDays,
              label: "Member Since",
              value: format(new Date(user.createdAt), "MMM yyyy"),
              bg: "bg-primary-container",
              fg: "text-on-primary-container",
            },
            {
              icon: Clock,
              label: "Last Login",
              value: user.lastLoginAt
                ? format(new Date(user.lastLoginAt), "MMM d")
                : "Never",
              bg: "bg-surface-container",
              fg: "text-on-surface-variant",
            },
            {
              icon: RoleIcon,
              label: "Role",
              value: roleCfg.label,
              bg: "bg-secondary-container",
              fg: "text-on-secondary-container",
            },
            {
              icon: user.isEmailVerified ? CheckCircle2 : AlertCircle,
              label: "Email",
              value: user.isEmailVerified ? "Verified" : "Unverified",
              bg: user.isEmailVerified
                ? "bg-success-container"
                : "bg-warning-container",
              fg: user.isEmailVerified
                ? "text-on-success-container"
                : "text-on-warning-container",
            },
          ].map(({ icon: Icon, label, value, bg, fg }) => (
            <div
              key={label}
              className="card flex flex-col items-center gap-2 py-4 text-center"
            >
              <div
                className={cn(
                  "flex h-8 w-8 items-center justify-center rounded",
                  bg,
                )}
              >
                <Icon size={16} className={fg} />
              </div>
              <div>
                <p className="font-mono text-label-sm text-on-surface-variant">
                  {label}
                </p>
                <p className="text-body-sm font-semibold text-on-surface">
                  {value}
                </p>
              </div>
            </div>
          ))}
        </div>

        {/* ── Exhibitor profile snapshot ───────────────────────────── */}
        {user.role === "exhibitor" && (
          <div className="card flex flex-col gap-4">
            <h2 className="text-headline-sm font-semibold text-on-surface border-b border-outline-variant pb-3">
              Exhibitor Profile
            </h2>

            {exhibitorProfile ? (
              <div className="flex items-start gap-3">
                {exhibitorProfile.logo ? (
                  <img
                    src={exhibitorProfile.logo}
                    alt={exhibitorProfile.companyName}
                    className="h-10 w-10 rounded border border-outline-variant object-contain bg-surface-bright shrink-0"
                  />
                ) : (
                  <div
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded
                                  bg-primary-container text-on-primary-container"
                  >
                    <Building2 size={16} />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-body-sm font-semibold text-on-surface">
                      {exhibitorProfile.companyName}
                    </p>
                    <span
                      className={cn("badge", {
                        "badge-warning":
                          exhibitorProfile.applicationStatus === "pending",
                        "badge-success":
                          exhibitorProfile.applicationStatus === "approved",
                        "badge-error": ["rejected", "suspended"].includes(
                          exhibitorProfile.applicationStatus,
                        ),
                      })}
                    >
                      {exhibitorProfile.applicationStatus}
                    </span>
                  </div>
                  {exhibitorProfile.industry && (
                    <p className="font-mono text-label-sm text-on-surface-variant mt-0.5">
                      {exhibitorProfile.industry}
                    </p>
                  )}
                </div>
                <Link
                  to={`/admin/exhibitors/${exhibitorProfile._id}`}
                  className="btn-ghost btn-sm gap-1 shrink-0"
                >
                  Review Profile →
                </Link>
              </div>
            ) : (
              <p className="text-body-sm text-on-surface-variant">
                No exhibitor profile created yet.
              </p>
            )}
          </div>
        )}
      </div>

      {/* ── Deactivate modal ──────────────────────────────────────── */}
      <AnimatePresence>
        {showDeactivateModal && (
          <div className="modal-overlay" role="dialog" aria-modal="true">
            <motion.div
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96 }}
              transition={{ duration: 0.18 }}
              className="modal-panel max-w-md p-6"
            >
              <div
                className={cn(
                  "mb-4 flex h-10 w-10 items-center justify-center rounded-md",
                  user.isActive ? "bg-error-container" : "bg-success-container",
                )}
              >
                {user.isActive ? (
                  <UserX size={18} className="text-on-error-container" />
                ) : (
                  <UserCheck size={18} className="text-on-success-container" />
                )}
              </div>
              <h2 className="mb-1 text-headline-sm font-semibold text-on-surface">
                {user.isActive ? "Deactivate account?" : "Reactivate account?"}
              </h2>
              <p className="mb-5 text-body-sm text-on-surface-variant">
                {user.isActive
                  ? `${user.name} will immediately lose access. Their data is preserved for audit purposes.`
                  : `${user.name} will regain access to the platform.`}
              </p>
              <div className="flex justify-end gap-3">
                <button
                  onClick={() => setShowDeactivateModal(false)}
                  disabled={toggleMutation.isPending}
                  className="btn-ghost"
                >
                  Cancel
                </button>
                <button
                  onClick={() => toggleMutation.mutate()}
                  disabled={toggleMutation.isPending}
                  className={
                    user.isActive
                      ? "btn-danger gap-1.5"
                      : "btn-secondary gap-1.5"
                  }
                >
                  {toggleMutation.isPending ? (
                    "Processing…"
                  ) : user.isActive ? (
                    <>
                      <UserX size={14} /> Deactivate
                    </>
                  ) : (
                    <>
                      <UserCheck size={14} /> Reactivate
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
