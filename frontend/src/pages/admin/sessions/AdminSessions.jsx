import { useState, useCallback, useEffect } from "react"; // ← Added useEffect
import { useParams, Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  ArrowLeft,
  Plus,
  Edit2,
  Trash2,
  Users,
  Clock,
  MapPin,
  Send,
  X,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  BookOpen,
  ChevronLeft,
  ChevronRight,
  Search,
} from "lucide-react";
import { format } from "date-fns";
import toast from "react-hot-toast";
import api from "@/utils/api";
import { cn } from "@/utils/cn";

// ─── Query keys ───────────────────────────────────────────────────────────────
const sessionsKey = (expoId, params) => ["admin", "sessions", expoId, params];
const expoKey = (id) => ["expos", id];

// ─── Status config ────────────────────────────────────────────────────────────
const STATUS_BADGE = {
  scheduled: "badge-info",
  live: "badge-success",
  completed: "badge-neutral",
  cancelled: "badge-error",
};

const SESSION_FORMATS = [
  "keynote",
  "panel",
  "workshop",
  "presentation",
  "networking",
  "demo",
  "other",
];

// ─── Validation schema ────────────────────────────────────────────────────────
const sessionSchema = z
  .object({
    title: z.string().min(3, "At least 3 characters.").max(200),
    description: z.string().max(3000).optional().or(z.literal("")),
    format: z.enum(SESSION_FORMATS),
    location: z.string().min(1, "Room / location is required.").max(150),
    startTime: z.string().min(1, "Start time is required."),
    endTime: z.string().min(1, "End time is required."),
    maxCapacity: z
      .number({ invalid_type_error: "Must be a number." })
      .int()
      .min(1)
      .optional()
      .nullable(),
    isPublic: z.boolean().optional(),
    isFeatured: z.boolean().optional(),
    streamUrl: z.string().url().optional().or(z.literal("")),
  })
  .refine((d) => new Date(d.endTime) > new Date(d.startTime), {
    message: "End time must be after start time.",
    path: ["endTime"],
  });

// ─── Helpers ──────────────────────────────────────────────────────────────────
const toLocal = (iso) => {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

const Field = ({ label, htmlFor, error, required, children }) => (
  <div className="flex flex-col gap-1.5">
    {label && (
      <label
        htmlFor={htmlFor}
        className="font-mono text-label-md text-on-surface"
      >
        {label}
        {required && <span className="text-error ml-0.5">*</span>}
      </label>
    )}
    {children}
    {error && (
      <p className="text-body-sm text-error" role="alert">
        {error}
      </p>
    )}
  </div>
);

// ─── Session form slide-over ──────────────────────────────────────────────────
function SessionFormPanel({ expoId, session, onClose, onSaved }) {
  const isEdit = !!session;
  const [speakers, setSpeakers] = useState([]);
  const [selectedExhibitor, setSelectedExhibitor] = useState("");
  const [newSpeaker, setNewSpeaker] = useState({
    name: "",
    title: "",
    company: "",
    userId: null,
  });

  // Load speakers when editing
  useEffect(() => {
    if (session?.speakers) {
      setSpeakers(session.speakers);
    }
  }, [session]);

  // Fetch approved exhibitors for the dropdown
  const { data: exhibitorsData } = useQuery({
    queryKey: ["exhibitors", "approved", "dropdown"],
    queryFn: async () => {
      const { data } = await api.get("/exhibitors/public?limit=100");
      return data.data.profiles || [];
    },
  });

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(sessionSchema),
    defaultValues: session
      ? {
          title: session.title || "",
          description: session.description || "",
          format: session.format || "presentation",
          location: session.location || "",
          startTime: toLocal(session.startTime),
          endTime: toLocal(session.endTime),
          maxCapacity: session.maxCapacity || null,
          isPublic: session.isPublic !== false,
          isFeatured: session.isFeatured || false,
          streamUrl: session.streamUrl || "",
        }
      : {
          format: "presentation",
          isPublic: true,
          isFeatured: false,
        },
  });

  const mutation = useMutation({
    mutationFn: async (values) => {
      const payload = {
        ...values,
        startTime: new Date(values.startTime).toISOString(),
        endTime: new Date(values.endTime).toISOString(),
        maxCapacity: values.maxCapacity || undefined,
        streamUrl: values.streamUrl || undefined,
        description: values.description || undefined,
        speakers, // ← Include speakers in payload
      };
      if (isEdit) {
        const { data } = await api.put(`/sessions/${session._id}`, payload);
        return data.data.session;
      }
      const { data } = await api.post(`/sessions/expo/${expoId}`, payload);
      return data.data.session;
    },
    onSuccess: (s) => {
      toast.success(isEdit ? "Session updated." : "Session created.");
      onSaved(s);
    },
    onError: (err) => toast.error(err.message || "Failed to save session."),
  });

  const addSpeaker = () => {
    if (newSpeaker.name.trim()) {
      setSpeakers([...speakers, { ...newSpeaker }]);
      setNewSpeaker({ name: "", title: "", company: "", userId: null });
      setSelectedExhibitor("");
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: "100%" }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: "100%" }}
      transition={{ type: "spring", damping: 30, stiffness: 300 }}
      className="fixed inset-y-0 right-0 z-modal flex w-full max-w-lg flex-col
                 border-l border-outline-variant bg-surface-bright shadow-level-3"
    >
      {/* Header */}
      <div className="flex h-16 items-center justify-between border-b border-outline-variant px-6">
        <h2 className="text-headline-sm font-semibold text-on-surface">
          {isEdit ? "Edit Session" : "New Session"}
        </h2>
        <button
          onClick={onClose}
          className="rounded p-1.5 text-on-surface-variant hover:bg-surface-container transition-colors"
        >
          <X size={18} />
        </button>
      </div>

      {/* Form */}
      <div className="flex-1 overflow-y-auto px-6 py-5">
        <form
          id="session-form"
          onSubmit={handleSubmit((v) => mutation.mutate(v))}
          noValidate
          className="flex flex-col gap-5"
        >
          <Field
            label="Title"
            htmlFor="s-title"
            required
            error={errors.title?.message}
          >
            <input
              id="s-title"
              type="text"
              autoFocus
              {...register("title")}
              className={cn("input", errors.title && "input-error")}
            />
          </Field>

          <div className="grid grid-cols-2 gap-4">
            <Field
              label="Format"
              htmlFor="s-format"
              required
              error={errors.format?.message}
            >
              <select id="s-format" {...register("format")} className="input">
                {SESSION_FORMATS.map((f) => (
                  <option key={f} value={f} className="capitalize">
                    {f}
                  </option>
                ))}
              </select>
            </Field>
            <Field
              label="Room / Location"
              htmlFor="s-location"
              required
              error={errors.location?.message}
            >
              <input
                id="s-location"
                type="text"
                placeholder="e.g. Hall A"
                {...register("location")}
                className={cn("input", errors.location && "input-error")}
              />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Field
              label="Start Time"
              htmlFor="s-start"
              required
              error={errors.startTime?.message}
            >
              <input
                id="s-start"
                type="datetime-local"
                {...register("startTime")}
                className={cn("input", errors.startTime && "input-error")}
              />
            </Field>
            <Field
              label="End Time"
              htmlFor="s-end"
              required
              error={errors.endTime?.message}
            >
              <input
                id="s-end"
                type="datetime-local"
                {...register("endTime")}
                className={cn("input", errors.endTime && "input-error")}
              />
            </Field>
          </div>

          <Field
            label="Description"
            htmlFor="s-desc"
            error={errors.description?.message}
          >
            <textarea
              id="s-desc"
              rows={3}
              {...register("description")}
              className="input resize-none"
              placeholder="Optional session description…"
            />
          </Field>

          <Field
            label="Max Capacity"
            htmlFor="s-cap"
            error={errors.maxCapacity?.message}
          >
            <input
              id="s-cap"
              type="number"
              min={1}
              placeholder="Unlimited if blank"
              {...register("maxCapacity", { valueAsNumber: true })}
              className={cn("input", errors.maxCapacity && "input-error")}
            />
          </Field>

          <Field
            label="Stream URL"
            htmlFor="s-stream"
            error={errors.streamUrl?.message}
          >
            <input
              id="s-stream"
              type="url"
              placeholder="https://…"
              {...register("streamUrl")}
              className={cn("input", errors.streamUrl && "input-error")}
            />
          </Field>

          <div className="flex flex-col gap-2">
            {[
              { name: "isPublic", label: "Publicly visible to attendees" },
              { name: "isFeatured", label: "Featured session" },
            ].map(({ name, label }) => (
              <label
                key={name}
                className="flex items-center gap-2 cursor-pointer"
              >
                <input
                  type="checkbox"
                  {...register(name)}
                  className="h-4 w-4 accent-secondary rounded"
                />
                <span className="text-body-sm text-on-surface">{label}</span>
              </label>
            ))}
          </div>

          {/* ── Speakers Section ──────────────────────────────────────── */}
          <div className="border-t border-outline-variant pt-5">
            <h3 className="text-body-sm font-semibold text-on-surface mb-3 flex items-center gap-2">
              <Users size={15} className="text-secondary" />
              Speakers ({speakers.length})
            </h3>

            {/* Quick-add from Exhibitors */}
            <div className="mb-4 p-3 rounded-lg bg-surface-container-low border border-outline-variant">
              <label className="font-mono text-label-sm text-on-surface-variant mb-1.5 block">
                Quick-add from Exhibitors
              </label>
              <select
                value={selectedExhibitor}
                onChange={(e) => {
                  const exhibitorId = e.target.value;
                  setSelectedExhibitor(exhibitorId);
                  if (exhibitorId) {
                    const exhibitor = exhibitorsData?.find(
                      (ep) =>
                        ep.userId?._id === exhibitorId ||
                        ep.userId === exhibitorId,
                    );
                    if (exhibitor) {
                      setNewSpeaker({
                        name:
                          exhibitor.contactPerson?.name ||
                          exhibitor.userId?.name ||
                          "",
                        title: exhibitor.contactPerson?.title || "",
                        company: exhibitor.companyName || "",
                        userId:
                          exhibitor.userId?._id || exhibitor.userId || null,
                      });
                    }
                  } else {
                    setNewSpeaker({
                      name: "",
                      title: "",
                      company: "",
                      userId: null,
                    });
                  }
                }}
                className="input mb-2"
              >
                <option value="">— Select exhibitor —</option>
                {exhibitorsData?.map((ep) => (
                  <option key={ep._id} value={ep.userId?._id || ep.userId}>
                    {ep.companyName} ({ep.contactPerson?.name || "No contact"})
                  </option>
                ))}
              </select>
            </div>

            {/* Manual speaker input */}
            <div className="grid grid-cols-3 gap-2 mb-3">
              <input
                type="text"
                placeholder="Name *"
                value={newSpeaker.name}
                onChange={(e) =>
                  setNewSpeaker({ ...newSpeaker, name: e.target.value })
                }
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addSpeaker();
                  }
                }}
                className="input text-body-sm"
              />
              <input
                type="text"
                placeholder="Title"
                value={newSpeaker.title}
                onChange={(e) =>
                  setNewSpeaker({ ...newSpeaker, title: e.target.value })
                }
                className="input text-body-sm"
              />
              <div className="flex gap-1">
                <input
                  type="text"
                  placeholder="Company"
                  value={newSpeaker.company}
                  onChange={(e) =>
                    setNewSpeaker({ ...newSpeaker, company: e.target.value })
                  }
                  className="input text-body-sm flex-1"
                />
                <button
                  type="button"
                  onClick={addSpeaker}
                  disabled={!newSpeaker.name.trim()}
                  className="btn-ghost btn-sm shrink-0"
                >
                  <Plus size={14} />
                </button>
              </div>
            </div>

            {/* Speaker list */}
            {speakers.length > 0 && (
              <div className="flex flex-col gap-1.5">
                {speakers.map((sp, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-2 rounded-md bg-surface-container px-3 py-2"
                  >
                    <div
                      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full
                                    bg-primary-container font-mono text-label-sm font-bold text-on-primary-container"
                    >
                      {sp.name.charAt(0)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-body-sm font-medium text-on-surface truncate">
                        {sp.name}
                        {sp.userId && (
                          <span className="ml-1 font-mono text-label-sm text-secondary">
                            (Exhibitor)
                          </span>
                        )}
                      </p>
                      {(sp.title || sp.company) && (
                        <p className="font-mono text-label-sm text-on-surface-variant truncate">
                          {[sp.title, sp.company].filter(Boolean).join(" · ")}
                        </p>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        setSpeakers(speakers.filter((_, idx) => idx !== i))
                      }
                      className="rounded p-1 text-on-surface-variant hover:text-error transition-colors"
                    >
                      <X size={13} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </form>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-end gap-3 border-t border-outline-variant px-6 py-4">
        <button onClick={onClose} className="btn-ghost">
          Cancel
        </button>
        <button
          form="session-form"
          type="submit"
          disabled={isSubmitting || mutation.isPending}
          className="btn-secondary gap-2"
        >
          {mutation.isPending ? (
            <>
              <motion.span
                animate={{ rotate: 360 }}
                transition={{ repeat: Infinity, duration: 0.8, ease: "linear" }}
                className="inline-block h-4 w-4 rounded-full border-2 border-on-secondary/30 border-t-on-secondary"
              />
              Saving…
            </>
          ) : (
            <>
              <CheckCircle2 size={15} />{" "}
              {isEdit ? "Save Changes" : "Create Session"}
            </>
          )}
        </button>
      </div>
    </motion.div>
  );
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────
function RowSkeleton() {
  return (
    <tr className="border-b border-outline-variant">
      {[48, 20, 28, 24, 16, 12].map((w, i) => (
        <td key={i} className="px-4 py-density-high">
          <div
            className="skeleton h-4 rounded"
            style={{ width: `${w * 3}px` }}
          />
        </td>
      ))}
    </tr>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function AdminSessions() {
  const { id: expoId } = useParams();
  const queryClient = useQueryClient();
  const [panel, setPanel] = useState(null);
  const [delTarget, setDelTarget] = useState(null);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const LIMIT = 15;

  const { data: expo } = useQuery({
    queryKey: expoKey(expoId),
    queryFn: async () => {
      const { data } = await api.get(`/expos/${expoId}`);
      return data.data.expo;
    },
    staleTime: 5 * 60 * 1000,
  });

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: sessionsKey(expoId, { page, search, limit: LIMIT }),
    queryFn: async () => {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(LIMIT),
      });
      if (search.trim()) params.set("search", search.trim());
      const { data } = await api.get(`/sessions/expo/${expoId}?${params}`);
      return data.data;
    },
    keepPreviousData: true,
  });

  const invalidate = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["admin", "sessions", expoId] });
  }, [queryClient, expoId]);

  const deleteMutation = useMutation({
    mutationFn: (sessionId) => api.delete(`/sessions/${sessionId}`),
    onSuccess: () => {
      toast.success("Session deleted.");
      setDelTarget(null);
      invalidate();
    },
    onError: (err) => toast.error(err.message || "Failed to delete session."),
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, status }) =>
      api.patch(`/sessions/${id}/status`, { status }),
    onSuccess: (_, { status }) => {
      toast.success(`Session marked as ${status}.`);
      invalidate();
    },
    onError: (err) => toast.error(err.message || "Failed to update status."),
  });

  const sessions = data?.sessions || [];
  const pagination = data?.pagination || {};

  return (
    <>
      <div className="flex flex-col gap-6">
        <div className="page-header">
          <div className="flex items-center gap-3">
            <Link
              to={`/admin/expos/${expoId}`}
              className="btn-ghost btn-sm gap-1.5"
            >
              <ArrowLeft size={15} /> {expo?.title || "Expo"}
            </Link>
            <div>
              <h1 className="page-title">Sessions</h1>
              <p className="page-subtitle">
                {pagination.total !== undefined
                  ? `${pagination.total} session${pagination.total !== 1 ? "s" : ""}`
                  : "Manage the schedule"}
              </p>
            </div>
          </div>
          <button
            onClick={() => setPanel("create")}
            className="btn-secondary gap-2"
          >
            <Plus size={15} /> New Session
          </button>
        </div>

        <div className="relative max-w-sm">
          <Search
            size={15}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant"
          />
          <input
            type="search"
            placeholder="Search sessions…"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="input pl-9 pr-8"
          />
          {search && (
            <button
              onClick={() => {
                setSearch("");
                setPage(1);
              }}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-on-surface-variant hover:text-on-surface"
            >
              <X size={14} />
            </button>
          )}
        </div>

        <div className="table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th>Title</th>
                <th>Format</th>
                <th>Date & Time</th>
                <th>Room</th>
                <th className="text-center">Registered</th>
                <th>Status</th>
                <th className="w-28" />
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                Array.from({ length: 6 }).map((_, i) => <RowSkeleton key={i} />)
              ) : isError ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center">
                    <div className="flex flex-col items-center gap-2">
                      <AlertCircle size={20} className="text-error" />
                      <span className="text-body-sm text-on-surface-variant">
                        Failed to load sessions.
                      </span>
                      <button
                        onClick={() => refetch()}
                        className="btn-ghost btn-sm gap-1"
                      >
                        <RefreshCw size={13} /> Retry
                      </button>
                    </div>
                  </td>
                </tr>
              ) : sessions.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-16">
                    <div className="empty-state">
                      <div className="empty-state-icon mx-auto mb-3">
                        <BookOpen size={24} />
                      </div>
                      <h3 className="empty-state-title">No sessions yet</h3>
                      <p className="empty-state-body">
                        {search
                          ? "No sessions match your search."
                          : "Create the first session for this expo."}
                      </p>
                      {!search && (
                        <button
                          onClick={() => setPanel("create")}
                          className="btn-secondary btn-sm mt-3 gap-1 inline-flex"
                        >
                          <Plus size={13} /> Create Session
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ) : (
                sessions.map((session) => (
                  <tr
                    key={session._id}
                    className="border-b border-outline-variant hover:bg-surface-container-low transition-colors duration-150"
                  >
                    <td className="px-4 py-density-high">
                      <div className="flex flex-col gap-0.5">
                        <Link
  to={`/admin/expos/${expoId}/sessions/${session._id}`}
  className="text-body-sm font-medium text-on-surface hover:text-secondary transition-colors line-clamp-1"
>
  {session.title}
</Link>
                        {session.isFeatured && (
                          <span className="font-mono text-label-sm text-secondary">
                            ⭐ Featured
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-density-high">
                      <span className="badge badge-neutral capitalize">
                        {session.format}
                      </span>
                    </td>
                    <td className="px-4 py-density-high">
                      <div className="flex flex-col gap-0.5">
                        <span className="font-mono text-label-md text-on-surface whitespace-nowrap">
                          {format(new Date(session.startTime), "MMM d, yyyy")}
                        </span>
                        <span className="font-mono text-label-sm text-on-surface-variant">
                          {format(new Date(session.startTime), "HH:mm")} —{" "}
                          {format(new Date(session.endTime), "HH:mm")}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-density-high">
                      <div className="flex items-center gap-1 text-body-sm text-on-surface-variant">
                        <MapPin size={12} className="shrink-0" />
                        <span className="line-clamp-1">{session.location}</span>
                      </div>
                    </td>
                    <td className="px-4 py-density-high text-center">
                      <div className="flex items-center justify-center gap-1 font-mono text-label-md text-on-surface">
                        <Users size={12} />
                        <span>
                          {session.attendeeCount ?? 0}
                          {session.maxCapacity ? `/${session.maxCapacity}` : ""}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-density-high">
                      <span
                        className={cn(
                          "badge",
                          STATUS_BADGE[session.status] || "badge-neutral",
                        )}
                      >
                        {session.status}
                      </span>
                    </td>
                    <td className="px-4 py-density-high">
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => setPanel(session)}
                          className="rounded p-1.5 text-on-surface-variant hover:bg-surface-container hover:text-on-surface transition-colors"
                          title="Edit"
                        >
                          <Edit2 size={14} />
                        </button>
                        {session.status === "scheduled" && (
                          <button
                            onClick={() =>
                              statusMutation.mutate({
                                id: session._id,
                                status: "live",
                              })
                            }
                            className="rounded p-1.5 text-on-surface-variant hover:bg-success-container hover:text-on-success-container transition-colors"
                            title="Go Live"
                          >
                            <Send size={14} />
                          </button>
                        )}
                        {session.status === "live" && (
                          <button
                            onClick={() =>
                              statusMutation.mutate({
                                id: session._id,
                                status: "completed",
                              })
                            }
                            className="rounded p-1.5 text-on-surface-variant hover:bg-surface-container hover:text-secondary transition-colors"
                            title="Mark Complete"
                          >
                            <CheckCircle2 size={14} />
                          </button>
                        )}
                        <button
                          onClick={() => setDelTarget(session)}
                          className="rounded p-1.5 text-on-surface-variant hover:bg-error-container hover:text-error transition-colors"
                          title="Delete"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {!isLoading && pagination.totalPages > 1 && (
          <div className="flex items-center justify-between">
            <p className="font-mono text-label-sm text-on-surface-variant">
              Page {pagination.page} of {pagination.totalPages}
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setPage((p) => p - 1)}
                disabled={!pagination.hasPrevPage}
                className="btn-ghost btn-sm gap-1 disabled:opacity-40"
              >
                <ChevronLeft size={15} /> Prev
              </button>
              <button
                onClick={() => setPage((p) => p + 1)}
                disabled={!pagination.hasNextPage}
                className="btn-ghost btn-sm gap-1 disabled:opacity-40"
              >
                Next <ChevronRight size={15} />
              </button>
            </div>
          </div>
        )}
      </div>

      <AnimatePresence>
        {panel && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 z-modal bg-primary/40 backdrop-blur-modal-backdrop"
              onClick={() => setPanel(null)}
            />
            <SessionFormPanel
              expoId={expoId}
              session={panel === "create" ? null : panel}
              onClose={() => setPanel(null)}
              onSaved={() => {
                setPanel(null);
                invalidate();
              }}
            />
          </>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {delTarget && (
          <div className="modal-overlay" role="dialog" aria-modal="true">
            <motion.div
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96 }}
              className="modal-panel max-w-md p-6"
            >
              <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-md bg-error-container">
                <Trash2 size={18} className="text-on-error-container" />
              </div>
              <h2 className="mb-1 text-headline-sm font-semibold text-on-surface">
                Delete session?
              </h2>
              <p className="mb-5 text-body-sm text-on-surface-variant">
                <span className="font-medium text-on-surface">
                  "{delTarget.title}"
                </span>{" "}
                and all attendee registrations will be permanently deleted.
              </p>
              <div className="flex justify-end gap-3">
                <button
                  onClick={() => setDelTarget(null)}
                  disabled={deleteMutation.isPending}
                  className="btn-ghost"
                >
                  Cancel
                </button>
                <button
                  onClick={() => deleteMutation.mutate(delTarget._id)}
                  disabled={deleteMutation.isPending}
                  className="btn-danger gap-1.5"
                >
                  {deleteMutation.isPending ? (
                    "Deleting…"
                  ) : (
                    <>
                      <Trash2 size={14} /> Delete
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
