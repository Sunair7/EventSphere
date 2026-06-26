import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft,
  ZoomIn,
  ZoomOut,
  RefreshCw,
  CheckCircle2,
  XCircle,
  RotateCcw,
  User,
  LayoutGrid,
  Info,
  Maximize2,
  Lock,
} from "lucide-react";
import toast from "react-hot-toast";
import api from "@/utils/api";
import { useSocket } from "@/context/SocketContext";
import { cn } from "@/utils/cn";

// ─── Query keys ───────────────────────────────────────────────────────────────
const floorPlanKeys = {
  plan: (expoId) => ["floor-plan", expoId],
};

// ─── Booth status config ──────────────────────────────────────────────────────
const STATUS_CONFIG = {
  available: {
    label: "Available",
    bg: "bg-surface-container-low hover:bg-secondary-container/60",
    border: "border-outline-variant hover:border-secondary",
    text: "text-on-surface-variant",
    activeBg: "bg-secondary-container",
    activeBorder: "border-secondary",
  },
  pending: {
    label: "Pending",
    bg: "bg-warning-container/40 hover:bg-warning-container/70",
    border: "border-warning/40 hover:border-warning",
    text: "text-on-warning-container",
    activeBg: "bg-warning-container",
    activeBorder: "border-warning",
  },
  assigned: {
    label: "Assigned",
    bg: "bg-surface-container-highest hover:bg-surface-container-highest",
    border: "border-outline",
    text: "text-on-surface-variant",
    activeBg: "bg-primary-container",
    activeBorder: "border-primary",
  },
};

// ─── Skeleton grid ────────────────────────────────────────────────────────────
function GridSkeleton({ rows = 6, cols = 8 }) {
  return (
    <div
      className="inline-grid gap-2"
      style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
    >
      {Array.from({ length: rows * cols }).map((_, i) => (
        <div key={i} className="skeleton h-16 w-16 rounded-sm" />
      ))}
    </div>
  );
}

// ─── Booth cell ───────────────────────────────────────────────────────────────
function BoothCell({ booth, selected, onClick, scale }) {
  const cfg = STATUS_CONFIG[booth.status] || STATUS_CONFIG.available;
  const isLocked =
    booth.lockedUntil && new Date(booth.lockedUntil) > new Date();
  const isSelected = selected?._id === booth._id;

  const cellSize = Math.max(48, Math.round(64 * scale));

  return (
    <motion.button
      layout
      whileHover={{ scale: 1.04 }}
      whileTap={{ scale: 0.97 }}
      transition={{ duration: 0.12 }}
      onClick={() => onClick(booth)}
      title={`${booth.boothNumber} — ${booth.status}`}
      aria-label={`Booth ${booth.boothNumber}, ${booth.status}`}
      aria-pressed={isSelected}
      className={cn(
        "relative flex flex-col items-center justify-center rounded-sm border-2",
        "text-center transition-colors duration-200 cursor-pointer",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary",
        isSelected
          ? `${cfg.activeBg} ${cfg.activeBorder}`
          : `${cfg.bg} ${cfg.border}`,
        isLocked && "opacity-60 cursor-not-allowed",
      )}
      style={{ width: cellSize, height: cellSize }}
    >
      {/* Booth number */}
      <span
        className={cn("font-mono font-semibold leading-none", cfg.text)}
        style={{ fontSize: Math.max(9, 11 * scale) }}
      >
        {booth.boothNumber}
      </span>

      {/* Status indicator dot */}
      <span
        className={cn(
          "mt-1 h-1.5 w-1.5 rounded-full",
          booth.status === "available" && "bg-secondary",
          booth.status === "pending" && "bg-warning",
          booth.status === "assigned" && "bg-on-surface-variant",
        )}
      />

      {/* Lock icon overlay */}
      {isLocked && (
        <span className="absolute right-0.5 top-0.5">
          <Lock size={8} className="text-on-surface-variant" />
        </span>
      )}

      {/* Selection ring */}
      {isSelected && (
        <motion.span
          layoutId="booth-ring"
          className="absolute inset-0 rounded-sm ring-2 ring-secondary ring-offset-1"
        />
      )}
    </motion.button>
  );
}

// ─── Detail side panel ────────────────────────────────────────────────────────
function BoothDetailPanel({
  booth,
  onClose,
  onApprove,
  onReject,
  onRelease,
  isMutating,
}) {
  const cfg = STATUS_CONFIG[booth.status] || STATUS_CONFIG.available;

  return (
    <motion.aside
      initial={{ opacity: 0, x: 24 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 24 }}
      transition={{ duration: 0.2 }}
      className="flex w-72 shrink-0 flex-col gap-4 rounded-md border border-outline-variant
                 bg-surface-bright p-5 shadow-level-2"
    >
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h3 className="font-mono text-headline-sm font-bold text-on-surface">
            {booth.boothNumber}
          </h3>
          <span
            className={cn(
              "badge mt-1",
              booth.status === "available" && "badge-success",
              booth.status === "pending" && "badge-warning",
              booth.status === "assigned" && "badge-neutral",
            )}
          >
            {booth.status}
          </span>
        </div>
        <button
          onClick={onClose}
          className="rounded p-1 text-on-surface-variant hover:bg-surface-container
                     hover:text-on-surface transition-colors"
          aria-label="Close panel"
        >
          <XCircle size={16} />
        </button>
      </div>

      <div className="divider" />

      {/* Booth info */}
      <div className="flex flex-col gap-3">
        <InfoRow label="Dimensions" value={booth.dimensions} />
        <InfoRow label="Type" value={booth.type} />
        <InfoRow label="Size" value={booth.size} />
        <InfoRow
          label="Grid"
          value={`Row ${booth.gridCoordinates?.row}, Col ${booth.gridCoordinates?.col}`}
        />
        {booth.pricing?.basePrice > 0 && (
          <InfoRow
            label="Price"
            value={`$${(booth.pricing.basePrice / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${booth.pricing.currency || "USD"}`}
          />
        )}
      </div>

      {/* Amenities */}
      {booth.amenities && Object.values(booth.amenities).some(Boolean) && (
        <>
          <div className="divider" />
          <div>
            <p className="mb-2 font-mono text-label-sm uppercase tracking-wider text-on-surface-variant">
              Amenities
            </p>
            <div className="flex flex-wrap gap-1.5">
              {Object.entries(booth.amenities)
                .filter(([, v]) => v)
                .map(([key]) => (
                  <span key={key} className="badge badge-info capitalize">
                    {key}
                  </span>
                ))}
            </div>
          </div>
        </>
      )}

      {/* Assignee */}
      {booth.assignedTo && (
        <>
          <div className="divider" />
          <div>
            <p className="mb-2 font-mono text-label-sm uppercase tracking-wider text-on-surface-variant">
              Reserved By
            </p>
            <div className="flex items-center gap-2">
              {booth.assignedTo?.avatar ? (
                <img
                  src={booth.assignedTo.avatar}
                  alt={booth.assignedTo.name}
                  className="h-8 w-8 rounded-full object-cover"
                />
              ) : (
                <div
                  className="flex h-8 w-8 items-center justify-center rounded-full
                  bg-primary-container text-on-primary-container"
                >
                  <User size={14} />
                </div>
              )}
              <div>
                <p className="text-body-sm font-medium text-on-surface">
                  {booth.assignedTo.name}
                </p>
                <p className="font-mono text-label-sm text-on-surface-variant">
                  {booth.assignedTo.email}
                </p>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Actions */}
      {(booth.status === "pending" || booth.status === "assigned") && (
        <>
          <div className="divider" />
          <div className="flex flex-col gap-2">
            <p className="font-mono text-label-sm uppercase tracking-wider text-on-surface-variant">
              Actions
            </p>

            {booth.status === "pending" && (
              <>
                <p className="text-body-sm text-on-surface-variant rounded-md bg-warning-container/30 border border-warning/30 px-3 py-2">
                  Awaiting exhibitor payment. The booth will be assigned automatically once payment is confirmed.
                </p>
                <button
                  onClick={onReject}
                  disabled={isMutating}
                  className="btn-danger w-full gap-2 justify-center"
                >
                  <XCircle size={15} />
                  {isMutating ? "Cancelling…" : "Cancel Reservation"}
                </button>
              </>
            )}

            {booth.status === "assigned" && (
              <button
                onClick={onRelease}
                disabled={isMutating}
                className="btn-ghost w-full gap-2 justify-center text-error hover:bg-error-container"
              >
                <RotateCcw size={15} />
                {isMutating ? "Releasing…" : "Force Release"}
              </button>
            )}
          </div>
        </>
      )}
    </motion.aside>
  );
}

function InfoRow({ label, value }) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <span className="font-mono text-label-sm text-on-surface-variant shrink-0">
        {label}
      </span>
      <span className="font-mono text-label-md text-on-surface capitalize text-right">
        {value ?? "—"}
      </span>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function AdminFloorPlan() {
  const { id: expoId } = useParams();
  const queryClient = useQueryClient();
  const { joinExpoFloorPlan, leaveExpoFloorPlan, onBoothEvent } = useSocket();

  const [selectedBooth, setSelectedBooth] = useState(null);
  const [scale, setScale] = useState(1);
  const [statusFilter, setStatusFilter] = useState("all");
  const containerRef = useRef(null);

  // ── Fetch floor plan ────────────────────────────────────────────────────────
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: floorPlanKeys.plan(expoId),
    queryFn: async () => {
      const { data } = await api.get(`/booths/expo/${expoId}/floor-plan`);
      return data.data;
    },
    staleTime: 30 * 1000,
  });

  // ── Socket.io real-time updates ─────────────────────────────────────────────
  useEffect(() => {
    if (!expoId) return;

    joinExpoFloorPlan(expoId);

    const unsub = onBoothEvent("booth:state_changed", (payload) => {
      queryClient.setQueryData(floorPlanKeys.plan(expoId), (old) => {
        if (!old?.booths) return old;
        return {
          ...old,
          booths: old.booths.map((b) =>
            b._id === payload.boothId
              ? {
                  ...b,
                  status: payload.status,
                  assignedTo: payload.assignedTo ?? b.assignedTo,
                }
              : b,
          ),
          summary: computeSummary(
            old.booths.map((b) =>
              b._id === payload.boothId ? { ...b, status: payload.status } : b,
            ),
          ),
        };
      });

      // Update selected booth panel if it's the one that changed
      setSelectedBooth((prev) =>
        prev?._id === payload.boothId
          ? { ...prev, status: payload.status }
          : prev,
      );
    });

    return () => {
      unsub();
      leaveExpoFloorPlan(expoId);
    };
  }, [
    expoId,
    joinExpoFloorPlan,
    leaveExpoFloorPlan,
    onBoothEvent,
    queryClient,
  ]);

  // ── Mutations ────────────────────────────────────────────────────────────────
  const invalidatePlan = () => {
    queryClient.invalidateQueries({ queryKey: floorPlanKeys.plan(expoId) });
  };

  const approveMutation = useMutation({
    mutationFn: (boothId) => api.patch(`/booths/${boothId}/approve`),
    onSuccess: () => {
      toast.success(`Booth ${selectedBooth?.boothNumber} approved.`);
      setSelectedBooth(null);
      invalidatePlan();
    },
    onError: (err) => toast.error(err.message || "Failed to approve booth."),
  });

  const rejectMutation = useMutation({
    mutationFn: (boothId) => api.patch(`/booths/${boothId}/reject`),
    onSuccess: () => {
      toast.success(
        `Booth ${selectedBooth?.boothNumber} reservation rejected.`,
      );
      setSelectedBooth(null);
      invalidatePlan();
    },
    onError: (err) => toast.error(err.message || "Failed to reject booth."),
  });

  const releaseMutation = useMutation({
    mutationFn: (boothId) => api.patch(`/booths/${boothId}/release`),
    onSuccess: () => {
      toast.success(`Booth ${selectedBooth?.boothNumber} released.`);
      setSelectedBooth(null);
      invalidatePlan();
    },
    onError: (err) => toast.error(err.message || "Failed to release booth."),
  });

  const isMutating =
    approveMutation.isPending ||
    rejectMutation.isPending ||
    releaseMutation.isPending;

  // ── Derived data ────────────────────────────────────────────────────────────
  const expo = data?.expo;
  const booths = data?.booths || [];
  const summary = data?.summary || {};
  const config = expo?.floorPlanConfig || {};

  const filteredBooths =
    statusFilter === "all"
      ? booths
      : booths.filter((b) => b.status === statusFilter);

  // Build grid map: key = "row-col" → booth
  const gridMap = booths.reduce((acc, b) => {
    acc[`${b.gridCoordinates.row}-${b.gridCoordinates.col}`] = b;
    return acc;
  }, {});

  const rows = config.rows || 0;
  const cols = config.cols || 0;

  return (
    <div className="flex flex-col gap-6">
      {/* ── Header ───────────────────────────────────────────────── */}
      <div className="page-header">
        <div className="flex items-center gap-3">
          <Link
            to={`/admin/expos/${expoId}`}
            className="btn-ghost btn-sm gap-1.5"
          >
            <ArrowLeft size={15} /> Detail
          </Link>
          <div>
            <h1 className="page-title">
              {isLoading ? (
                <span className="skeleton inline-block h-6 w-48 rounded align-middle" />
              ) : (
                expo?.title
              )}
            </h1>
            <p className="page-subtitle">Interactive floor plan</p>
          </div>
        </div>
        <button
          onClick={() => refetch()}
          className="btn-ghost btn-sm gap-1.5"
          aria-label="Refresh floor plan"
        >
          <RefreshCw size={14} /> Refresh
        </button>
      </div>

      {/* ── Summary bar ──────────────────────────────────────────── */}
      <div className="flex flex-wrap gap-3">
        {[
          { key: "all", label: "All", count: booths.length },
          {
            key: "available",
            label: "Available",
            count: summary.available ?? 0,
          },
          { key: "pending", label: "Pending", count: summary.pending ?? 0 },
          { key: "assigned", label: "Assigned", count: summary.assigned ?? 0 },
        ].map(({ key, label, count }) => (
          <button
            key={key}
            onClick={() => setStatusFilter(key)}
            className={cn(
              "flex items-center gap-2 rounded border px-3 py-1.5 text-body-sm font-medium",
              "transition-all duration-200",
              statusFilter === key
                ? "border-primary bg-primary text-on-primary"
                : "border-outline-variant bg-surface-bright text-on-surface-variant hover:border-outline hover:text-on-surface",
            )}
          >
            {label}
            <span
              className={cn(
                "font-mono text-label-sm rounded-sm px-1.5 py-0.5",
                statusFilter === key
                  ? "bg-white/20 text-on-primary"
                  : "bg-surface-container text-on-surface",
              )}
            >
              {count}
            </span>
          </button>
        ))}

        {/* Zoom controls */}
        <div className="ml-auto flex items-center gap-1 rounded border border-outline-variant bg-surface-bright px-1">
          <button
            onClick={() =>
              setScale((s) => Math.max(0.4, +(s - 0.15).toFixed(2)))
            }
            className="rounded p-1.5 text-on-surface-variant hover:bg-surface-container
                       hover:text-on-surface transition-colors"
            aria-label="Zoom out"
          >
            <ZoomOut size={15} />
          </button>
          <span className="min-w-[40px] text-center font-mono text-label-sm text-on-surface">
            {Math.round(scale * 100)}%
          </span>
          <button
            onClick={() => setScale((s) => Math.min(2, +(s + 0.15).toFixed(2)))}
            className="rounded p-1.5 text-on-surface-variant hover:bg-surface-container
                       hover:text-on-surface transition-colors"
            aria-label="Zoom in"
          >
            <ZoomIn size={15} />
          </button>
          <button
            onClick={() => setScale(1)}
            className="rounded p-1.5 text-on-surface-variant hover:bg-surface-container
                       hover:text-on-surface transition-colors"
            aria-label="Reset zoom"
            title="Reset zoom"
          >
            <Maximize2 size={14} />
          </button>
        </div>
      </div>
<button
  onClick={async () => {
    try {
      await api.post(`/booths/expo/${expoId}/generate`);
      toast.success('Booths generated successfully!');
      refetch();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to generate booths.');
    }
  }}
  className="btn-secondary btn-sm gap-1.5"
>
  <LayoutGrid size={14} /> Generate Booths
</button>

      {/* ── Main content: grid + panel ───────────────────────────── */}
      <div className="flex gap-5 items-start">
        {/* Floor plan grid */}
        <div
          ref={containerRef}
          className="flex-1 overflow-auto rounded-md border border-outline-variant
                     bg-surface-container-low p-6 min-h-[400px]"
        >
          {isLoading ? (
            <GridSkeleton rows={6} cols={8} />
          ) : isError ? (
            <div className="empty-state">
              <div className="empty-state-icon text-error">
                <LayoutGrid size={24} />
              </div>
              <h3 className="empty-state-title">Failed to load floor plan</h3>
              <button
                onClick={() => refetch()}
                className="btn-ghost btn-sm mt-3 gap-1"
              >
                <RefreshCw size={13} /> Retry
              </button>
            </div>
          ) : booths.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon">
                <LayoutGrid size={24} />
              </div>
              <h3 className="empty-state-title">No booths generated</h3>
              <p className="empty-state-body">
                Booths are created automatically when an expo is saved.
              </p>
            </div>
          ) : (
            <div
              className="inline-grid gap-2"
              style={{
                gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
                width: "max-content",
              }}
              role="grid"
              aria-label="Floor plan grid"
            >
              {Array.from({ length: rows }).flatMap((_, rowIdx) =>
                Array.from({ length: cols }).map((_, colIdx) => {
                  const booth = gridMap[`${rowIdx}-${colIdx}`];
                  if (!booth) {
                    return (
                      <div
                        key={`empty-${rowIdx}-${colIdx}`}
                        style={{
                          width: Math.max(48, Math.round(64 * scale)),
                          height: Math.max(48, Math.round(64 * scale)),
                        }}
                        className="rounded-sm border-2 border-dashed border-outline-variant/40"
                        aria-hidden="true"
                      />
                    );
                  }

                  const isFiltered =
                    statusFilter !== "all" && booth.status !== statusFilter;

                  return (
                    <div
                      key={booth._id}
                      className={cn(
                        "transition-opacity duration-200",
                        isFiltered && "opacity-20 pointer-events-none",
                      )}
                    >
                      <BoothCell
                        booth={booth}
                        selected={selectedBooth}
                        onClick={setSelectedBooth}
                        scale={scale}
                      />
                    </div>
                  );
                }),
              )}
            </div>
          )}
        </div>

        {/* Side panel */}
        <AnimatePresence mode="wait">
          {selectedBooth && (
            <BoothDetailPanel
              key={selectedBooth._id}
              booth={selectedBooth}
              onClose={() => setSelectedBooth(null)}
              onApprove={() => approveMutation.mutate(selectedBooth._id)}
              onReject={() => rejectMutation.mutate(selectedBooth._id)}
              onRelease={() => releaseMutation.mutate(selectedBooth._id)}
              isMutating={isMutating}
            />
          )}
        </AnimatePresence>
      </div>

      {/* ── Legend ───────────────────────────────────────────────── */}
      <div
        className="flex flex-wrap items-center gap-4 rounded-md border border-outline-variant
                      bg-surface-bright px-4 py-3"
      >
        <div className="flex items-center gap-1.5">
          <Info size={13} className="text-on-surface-variant" />
          <span className="font-mono text-label-sm text-on-surface-variant">
            Legend:
          </span>
        </div>
        {[
          { dot: "bg-secondary", label: "Available" },
          { dot: "bg-warning", label: "Pending approval" },
          { dot: "bg-on-surface-variant", label: "Assigned" },
        ].map(({ dot, label }) => (
          <div key={label} className="flex items-center gap-1.5">
            <span className={cn("h-2.5 w-2.5 rounded-full", dot)} />
            <span className="font-mono text-label-sm text-on-surface-variant">
              {label}
            </span>
          </div>
        ))}
        <span className="font-mono text-label-sm text-on-surface-variant ml-auto hidden sm:inline">
          Click a booth to view details and take action
        </span>
      </div>
    </div>
  );
}

// ─── Helper ───────────────────────────────────────────────────────────────────
function computeSummary(booths) {
  return booths.reduce(
    (acc, b) => {
      acc[b.status] = (acc[b.status] || 0) + 1;
      return acc;
    },
    { available: 0, pending: 0, assigned: 0 },
  );
}
