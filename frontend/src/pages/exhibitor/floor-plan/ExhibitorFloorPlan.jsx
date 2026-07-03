import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft,
  ZoomIn,
  ZoomOut,
  Maximize2,
  LayoutGrid,
  Info,
  Lock,
  CheckCircle2,
  X,
  DollarSign,
  Ruler,
  Wifi,
  Zap,
  Droplets,
  Lamp,
  Package,
  Wind,
  Loader2,
} from "lucide-react";
import toast from "react-hot-toast";
import api from "@/utils/api";
import { useSocket } from "@/context/SocketContext";
import { useAuth } from "@/context/AuthContext";
import { cn } from "@/utils/cn";
import { usePayment } from "@/hooks/usePayment";
import PaymentModal from "@/components/payment/PaymentModal.jsx"; // ⬅️ ADD THIS IMPORT

// ─── Query keys ───────────────────────────────────────────────────────────────
const floorPlanKey = (expoId) => ["floor-plan", "exhibitor", expoId];

// ─── Amenity icon map ─────────────────────────────────────────────────────────
const AMENITY_ICONS = {
  power: Zap,
  wifi: Wifi,
  water: Droplets,
  lighting: Lamp,
  storage: Package,
  carpeted: Wind,
};

// ─── Cell status colours ──────────────────────────────────────────────────────
const cellStyle = (status, isOwn, isLocked, isSelected) => {
  if (isOwn)
    return {
      cell: "bg-secondary border-secondary cursor-default",
      number: "text-on-secondary",
      dot: "bg-on-secondary/60",
    };
  if (status === "assigned")
    return {
      cell: "bg-surface-container-highest border-outline cursor-not-allowed opacity-60",
      number: "text-on-surface-variant",
      dot: "bg-on-surface-variant/40",
    };
  if (status === "pending" && !isOwn)
    return {
      cell: "bg-warning-container/40 border-warning/40 cursor-not-allowed opacity-70",
      number: "text-on-warning-container",
      dot: "bg-warning",
    };
  if (isLocked)
    return {
      cell: "bg-surface-container border-outline-variant cursor-not-allowed opacity-50",
      number: "text-on-surface-variant",
      dot: "bg-outline",
    };
  if (isSelected)
    return {
      cell: "bg-secondary-container border-secondary ring-2 ring-secondary ring-offset-1",
      number: "text-on-secondary-container",
      dot: "bg-secondary",
    };
  return {
    cell: "bg-surface-container-low border-outline-variant hover:bg-secondary-container/50 hover:border-secondary cursor-pointer",
    number: "text-on-surface-variant",
    dot: "bg-secondary",
  };
};

// ─── Booth cell ───────────────────────────────────────────────────────────────
function BoothCell({ booth, userId, selected, scale, isReserving, onReserve }) {
  const isOwn = booth.assignedTo?._id === userId || booth.assignedTo === userId;
  const isLocked =
    booth.lockedUntil && new Date(booth.lockedUntil) > new Date() && !isOwn;
  const isSelected = selected?._id === booth._id;
const canSelect = booth.status === "available" && !isLocked;
  const isThisReserving = isReserving === booth._id;

  // Exhibitor: allow selecting booths that are pending ONLY if it's owned by this exhibitor
  const canInteract = booth.status === 'pending' && isOwn;
  const canSelectPendingOwn = canInteract;
  const isClickable = canSelect || canSelectPendingOwn;

  const cellPx = Math.max(44, Math.round(60 * scale));
  const styles = cellStyle(booth.status, isOwn, isLocked, isSelected);

  return (
    <motion.button
      layout
      whileHover={(canSelect || canSelectPendingOwn) && !isThisReserving ? { scale: 1.06 } : {}}
      whileTap={(canSelect || canSelectPendingOwn) && !isThisReserving ? { scale: 0.95 } : {}}

      transition={{ duration: 0.1 }}
      onClick={() => {
        if (canSelect) onReserve(booth);
        if (!canSelect && canSelectPendingOwn) onReserve(booth);
      }}
      disabled={!isClickable || isThisReserving}


      aria-label={`Booth ${booth.boothNumber} — ${isOwn ? "yours" : booth.status}`}
      aria-pressed={isSelected}
      style={{ width: cellPx, height: cellPx }}
      className={cn(
        "relative flex flex-col items-center justify-center rounded-sm border-2",
        "transition-colors duration-150 focus-visible:outline-none",
        "focus-visible:ring-2 focus-visible:ring-secondary",
        styles.cell,
        isThisReserving && "animate-pulse",
      )}
    >
      {isThisReserving ? (
        <div className="flex flex-col items-center">
          <Loader2 size={14} className="animate-spin text-secondary" />
          <span className="mt-0.5 text-[8px] font-mono text-on-surface-variant">
            ...
          </span>
        </div>
      ) : (
        <>
          <span
            className={cn(
              "font-mono font-semibold leading-none",
              styles.number,
            )}
            style={{ fontSize: Math.max(8, 10 * scale) }}
          >
            {booth.boothNumber}
          </span>
          <span className={cn("mt-1 h-1.5 w-1.5 rounded-full", styles.dot)} />
        </>
      )}

      {isLocked && !isThisReserving && (
        <Lock
          size={7}
          className="absolute right-0.5 top-0.5 text-on-surface-variant"
        />
      )}

      {isOwn && !isThisReserving && (
        <CheckCircle2
          size={8}
          className="absolute right-0.5 top-0.5 text-on-secondary"
        />
      )}
    </motion.button>
  );
}

// ─── Reservation panel ────────────────────────────────────────────────────────
function ReservationPanel({ booth, expoId, onClose, onSuccess }) {
  const [confirming, setConfirming] = useState(false);
  const queryClient = useQueryClient();
  const { lockBoothOptimistic } = useSocket();

  // Acquire a soft UI lock when the panel opens
  useEffect(() => {
    lockBoothOptimistic(expoId, booth._id);
  }, [expoId, booth._id, lockBoothOptimistic]);

  const reserveMutation = useMutation({
    mutationFn: () => api.post(`/booths/${booth._id}/reserve`),
    onSuccess: () => {
      toast.success(
        `Booth ${booth.boothNumber} reserved! Complete payment to confirm.`,
      );
      queryClient.invalidateQueries({ queryKey: floorPlanKey(expoId) });
      onSuccess();
    },
    onError: (err) => {
      toast.error(err.message || "Failed to reserve booth. Please try again.");
      setConfirming(false);
    },
  });

  const amenities = Object.entries(booth.amenities || {}).filter(([, v]) => v);

  return (
    <motion.aside
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20 }}
      transition={{ duration: 0.2 }}
      className="flex w-72 shrink-0 flex-col gap-4 rounded-md border border-outline-variant
                 bg-surface-bright p-5 shadow-level-2"
    >
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h3 className="font-mono text-headline-sm font-bold text-on-surface">
            Booth {booth.boothNumber}
          </h3>
          <span className="badge badge-success mt-1">Available</span>
        </div>
        <button
          onClick={onClose}
          className="rounded p-1 text-on-surface-variant hover:bg-surface-container
                     hover:text-on-surface transition-colors"
          aria-label="Close"
        >
          <X size={16} />
        </button>
      </div>

      <div className="divider" />

      {/* Details */}
      <div className="flex flex-col gap-2.5">
        <div className="flex items-center gap-2">
          <Ruler size={14} className="text-on-surface-variant shrink-0" />
          <span className="text-body-sm text-on-surface">
            {booth.dimensions}
          </span>
        </div>

        {booth.pricing?.basePrice > 0 && (
          <div className="flex items-center gap-2">
            <DollarSign
              size={14}
              className="text-on-surface-variant shrink-0"
            />
            <span className="text-body-sm text-on-surface">
              $
              {(booth.pricing.basePrice / 100).toLocaleString(undefined, {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}{" "}
              <span className="text-on-surface-variant">
                {booth.pricing.currency || "USD"}
              </span>
              {booth.pricing.isPremium && (
                <span className="ml-1.5 badge badge-warning">Premium</span>
              )}
            </span>
          </div>
        )}

        <div className="flex items-start gap-2">
          <LayoutGrid
            size={14}
            className="text-on-surface-variant shrink-0 mt-0.5"
          />
          <span className="font-mono text-label-md text-on-surface">
            {booth.type} · {booth.size} · Row {booth.gridCoordinates?.row}, Col{" "}
            {booth.gridCoordinates?.col}
          </span>
        </div>
      </div>

      {/* Amenities */}
      {amenities.length > 0 && (
        <>
          <div className="divider" />
          <div>
            <p className="mb-2 font-mono text-label-sm uppercase tracking-wider text-on-surface-variant">
              Included Amenities
            </p>
            <div className="flex flex-wrap gap-1.5">
              {amenities.map(([key]) => {
                const Icon = AMENITY_ICONS[key];
                return (
                  <span key={key} className="badge badge-info gap-1 capitalize">
                    {Icon && <Icon size={10} />}
                    {key}
                  </span>
                );
              })}
            </div>
          </div>
        </>
      )}

      {/* Description */}
      {booth.description && (
        <>
          <div className="divider" />
          <p className="text-body-sm text-on-surface-variant">
            {booth.description}
          </p>
        </>
      )}

      <div className="divider" />

      {/* Notice */}
      <div className="flex items-start gap-2 rounded bg-primary-container px-3 py-2.5">
        <Info size={14} className="shrink-0 mt-0.5 text-on-primary-container" />
        <p className="font-mono text-label-sm text-on-primary-container">
          Reservation requires admin approval. You'll be notified within 24
          hours.
        </p>
      </div>

      {/* CTA */}
      {!confirming ? (
        <button
          onClick={() => setConfirming(true)}
          className="btn-secondary w-full gap-2 justify-center"
        >
          <LayoutGrid size={15} /> Reserve This Booth
        </button>
      ) : (
        <div className="flex flex-col gap-2">
          <p className="text-body-sm font-medium text-on-surface text-center">
            Confirm reservation for Booth {booth.boothNumber}?
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => setConfirming(false)}
              disabled={reserveMutation.isPending}
              className="btn-ghost flex-1"
            >
              Cancel
            </button>
            <button
              onClick={() => reserveMutation.mutate()}
              disabled={reserveMutation.isPending}
              className="btn-secondary flex-1 gap-1.5"
            >
              {reserveMutation.isPending ? (
                <>
                  <motion.span
                    animate={{ rotate: 360 }}
                    transition={{
                      repeat: Infinity,
                      duration: 0.8,
                      ease: "linear",
                    }}
                    className="inline-block h-3.5 w-3.5 rounded-full border-2
                               border-on-secondary/30 border-t-on-secondary"
                  />
                  Reserving…
                </>
              ) : (
                <>
                  <CheckCircle2 size={14} /> Confirm
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </motion.aside>
  );
}

// ─── Grid skeleton ────────────────────────────────────────────────────────────
function GridSkeleton() {
  return (
    <div
      className="inline-grid gap-2"
      style={{ gridTemplateColumns: "repeat(8, 1fr)" }}
    >
      {Array.from({ length: 48 }).map((_, i) => (
        <div key={i} className="skeleton h-14 w-14 rounded-sm" />
      ))}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function ExhibitorFloorPlan() {

  const { id: expoId } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { joinExpoFloorPlan, leaveExpoFloorPlan, onBoothEvent } = useSocket();

  const [selected, setSelected] = useState(null);
  const [scale, setScale] = useState(1);
  const [statusFilter, setFilter] = useState("all");
  const [reservingBoothId, setReservingBoothId] = useState(null);
  const [activeBooth, setActiveBooth] = useState(null);

  const {
    createBoothPayment,
    showPaymentModal,
    transaction,
    setShowPaymentModal,
    cancelTransaction, // ← add this
    setTransaction, // ← add this
  } = usePayment();

  const handleReserve = useCallback(
    async (booth) => {
      if (reservingBoothId) return;
      setReservingBoothId(booth._id);
      setActiveBooth(booth);
      try {
        await createBoothPayment.mutateAsync({
          boothId: booth._id,
          paymentMethod: "mock",
        });
      } catch (error) {
        console.error("Reservation failed:", error);
      } finally {
        setReservingBoothId(null);
      }
    },
    [createBoothPayment, reservingBoothId],
  );

  // ── Fetch floor plan ────────────────────────────────────────────────────────
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: floorPlanKey(expoId),
    queryFn: async () => {
      const { data } = await api.get(`/booths/expo/${expoId}/floor-plan`);
      return data.data;
    },
    staleTime: 30 * 1000,
  });

  // ── Real-time booth updates ─────────────────────────────────────────────────
  useEffect(() => {
    if (!expoId) return;
    joinExpoFloorPlan(expoId);

    const unsubState = onBoothEvent("booth:state_changed", (payload) => {
      queryClient.setQueryData(floorPlanKey(expoId), (old) => {
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
        };
      });
      if (selected?._id === payload.boothId && payload.status !== "available") {
        setSelected(null);
        toast("This booth is no longer available.", { icon: "ℹ️" });
      }
    });

    const unsubLock = onBoothEvent("booth:locked_preview", (payload) => {
      queryClient.setQueryData(floorPlanKey(expoId), (old) => {
        if (!old?.booths) return old;
        return {
          ...old,
          booths: old.booths.map((b) =>
            b._id === payload.boothId
              ? {
                  ...b,
                  lockedUntil: payload.expiresAt,
                  lockedBy: payload.lockedBy,
                }
              : b,
          ),
        };
      });
    });

    return () => {
      unsubState();
      unsubLock();
      leaveExpoFloorPlan(expoId);
    };
  }, [
    expoId,
    joinExpoFloorPlan,
    leaveExpoFloorPlan,
    onBoothEvent,
    queryClient,
    selected,
  ]);

  // ── Derived values ──────────────────────────────────────────────────────────
  const expo = data?.expo;
  const booths = data?.booths || [];
  const summary = data?.summary || {};
  const config = expo?.floorPlanConfig || {};
  const rows = config.rows || 0;
  const cols = config.cols || 0;

  const filteredSet = useMemo(
    () =>
      new Set(
        statusFilter === "all"
          ? booths.map((b) => b._id)
          : booths.filter((b) => b.status === statusFilter).map((b) => b._id),
      ),
    [booths, statusFilter],
  );

  const gridMap = useMemo(
    () =>
      booths.reduce((acc, b) => {
        acc[`${b.gridCoordinates.row}-${b.gridCoordinates.col}`] = b;
        return acc;
      }, {}),
    [booths],
  );

  const handleSelect = useCallback((booth) => {
    setSelected((prev) => (prev?._id === booth._id ? null : booth));
  }, []);

  const handleReserveSuccess = () => setSelected(null);

  return (
    <div className="flex flex-col gap-5">
      {/* ── Header ──────────────────────────────────────────────── */}
      <div className="page-header">
        <div className="flex items-center gap-3">
          <Link
            to={`/exhibitor/expos/${expoId}`}
            className="btn-ghost btn-sm gap-1.5"
          >
            <ArrowLeft size={15} /> Back
          </Link>
          <div>
            <h1 className="page-title">
              {isLoading ? (
                <span className="skeleton inline-block h-6 w-48 rounded" />
              ) : (
                expo?.title
              )}
            </h1>
            <p className="page-subtitle">
              Select an available booth to reserve
            </p>
          </div>
        </div>
      </div>

      {/* ── Filter + zoom bar ────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-3">
        {[
          { key: "all", label: "All", count: booths.length },
          {
            key: "available",
            label: "Available",
            count: summary.available ?? 0,
          },
          { key: "pending", label: "Pending", count: summary.pending ?? 0 },
          { key: "assigned", label: "Taken", count: summary.assigned ?? 0 },
        ].map(({ key, label, count }) => (
          <button
            key={key}
            onClick={() => setFilter(key)}
            className={cn(
              "flex items-center gap-1.5 rounded border px-3 py-1.5 text-body-sm font-medium",
              "transition-all duration-200",
              statusFilter === key
                ? "border-primary bg-primary text-on-primary"
                : "border-outline-variant bg-surface-bright text-on-surface-variant hover:border-outline hover:text-on-surface",
            )}
          >
            {label}
            <span
              className={cn(
                "font-mono text-label-sm rounded-sm px-1 py-0.5",
                statusFilter === key ? "bg-white/20" : "bg-surface-container",
              )}
            >
              {count}
            </span>
          </button>
        ))}

        <div className="ml-auto flex items-center gap-1 rounded border border-outline-variant bg-surface-bright px-1">
          <button
            onClick={() =>
              setScale((s) => Math.max(0.4, +(s - 0.15).toFixed(2)))
            }
            className="rounded p-1.5 text-on-surface-variant hover:bg-surface-container transition-colors"
            aria-label="Zoom out"
          >
            <ZoomOut size={15} className="rotate-180" />
          </button>
          <span className="min-w-[40px] text-center font-mono text-label-sm text-on-surface">
            {Math.round(scale * 100)}%
          </span>
          <button
            onClick={() => setScale((s) => Math.min(2, +(s + 0.15).toFixed(2)))}
            className="rounded p-1.5 text-on-surface-variant hover:bg-surface-container transition-colors"
            aria-label="Zoom in"
          >
            <ZoomIn size={15} />
          </button>
          <button
            onClick={() => setScale(1)}
            className="rounded p-1.5 text-on-surface-variant hover:bg-surface-container transition-colors"
            aria-label="Reset zoom"
          >
            <Maximize2 size={14} />
          </button>
        </div>
      </div>

      {/* ── Grid + panel ─────────────────────────────────────────── */}
      <div className="flex items-start gap-5">
        {/* Grid */}
        <div
          className="flex-1 overflow-auto rounded-md border border-outline-variant
                        bg-surface-container-low p-6 min-h-[360px]"
        >
          {isLoading ? (
            <GridSkeleton />
          ) : isError ? (
            <div className="empty-state">
              <div className="empty-state-icon text-error">
                <LayoutGrid size={24} />
              </div>
              <h3 className="empty-state-title">Failed to load floor plan</h3>
              <button
                onClick={() => refetch()}
                className="btn-ghost btn-sm mt-3"
              >
                Retry
              </button>
            </div>
          ) : (
            <div
              className="inline-grid gap-2"
              style={{
                gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
                width: "max-content",
              }}
              role="grid"
              aria-label="Expo floor plan"
            >
              {Array.from({ length: rows }).flatMap((_, r) =>
                Array.from({ length: cols }).map((_, c) => {
                  const booth = gridMap[`${r}-${c}`];
                  if (!booth) {
                    return (
                      <div
                        key={`e-${r}-${c}`}
                        style={{
                          width: Math.max(44, Math.round(60 * scale)),
                          height: Math.max(44, Math.round(60 * scale)),
                        }}
                        className="rounded-sm border-2 border-dashed border-outline-variant/30"
                        aria-hidden="true"
                      />
                    );
                  }

                  const dimmed =
                    statusFilter !== "all" && !filteredSet.has(booth._id);

                  return (
                    <div
                      key={booth._id}
                      className={cn(
                        "transition-opacity duration-200",
                        dimmed && "opacity-15 pointer-events-none",
                      )}
                    >
                      <BoothCell
                        booth={booth}
                        userId={user?._id}
                        selected={selected}
                        scale={scale}
                        isReserving={reservingBoothId}
                        onReserve={handleReserve}
                      />
                    </div>
                  );
                }),
              )}
            </div>
          )}
        </div>

        {/* Reservation panel */}
        <AnimatePresence mode="wait">
          {selected && (
            <ReservationPanel
              key={selected._id}
              booth={selected}
              expoId={expoId}
              onClose={() => setSelected(null)}
              onSuccess={handleReserveSuccess}
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
          { dot: "bg-secondary", label: "Available — click to reserve" },
          { dot: "bg-warning", label: "Pending — complete payment" },
          { dot: "bg-on-surface-variant/40", label: "Already taken" },
          { dot: "bg-secondary ring-2 ring-secondary", label: "Your booth" },
        ].map(({ dot, label }) => (
          <div key={label} className="flex items-center gap-1.5">
            <span className={cn("h-2.5 w-2.5 rounded-full", dot)} />
            <span className="font-mono text-label-sm text-on-surface-variant">
              {label}
            </span>
          </div>
        ))}
      </div>

      {showPaymentModal && transaction && activeBooth && (
        <PaymentModal
          isOpen={showPaymentModal}
          onClose={() => {
            setShowPaymentModal(false);
          }}
          transaction={transaction}
          type="booth"
          itemName={`Booth ${activeBooth.boothNumber}`}
          amount={transaction.amount}
          currency={transaction.currency}
          expiresAt={transaction.expiresAt}
          isFree={transaction.amount === 0}
          onSuccess={() => {
            setShowPaymentModal(false);
            setActiveBooth(null); // ← clear stale booth
            setTransaction(null); // ← clear stale transaction
            refetch();
            queryClient.invalidateQueries({
              queryKey: ["exhibitor", "profile", "me"],
            });
            queryClient.invalidateQueries({ queryKey: ["transactions"] });
          }}
          onCancel={() => {
            // Cancel the transaction via the hook (which invalidates floor-plan query)
            if (transaction?._id) {
              cancelTransaction.mutate(transaction._id);
            }
            setActiveBooth(null); // ← clear stale booth
            setTransaction(null); // ← clear stale transaction
            setShowPaymentModal(false);
          }}
        />
      )}
    </div>
  );
}
