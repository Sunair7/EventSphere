import { useState, useCallback, useRef, useEffect } from "react";
import { Link, useSearchParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { motion, AnimatePresence, useInView } from "framer-motion";
import {
  Search,
  X,
  Building2,
  Globe,
  MessageSquare,
  AlertCircle,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  Tag,
  ShieldCheck,
  ArrowRight,
  Sparkles,
  MapPin,
  Users,
  Star,
  ExternalLink,
} from "lucide-react";
import { FaLinkedin, FaXTwitter } from "react-icons/fa6";
import api from "@/utils/api";
import { cn } from "@/utils/cn";

// ─── Animated Counter ─────────────────────────────────────────────────────────
function CountUp({ end, duration = 1 }) {
  const [display, setDisplay] = useState(0);
  const ref = useRef(null);
  const inView = useInView(ref, { once: true });

  useEffect(() => {
    if (!inView || (!end && end !== 0)) return;
    let startTime;
    const step = (timestamp) => {
      if (!startTime) startTime = timestamp;
      const progress = Math.min((timestamp - startTime) / (duration * 1000), 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(Math.floor(end * eased));
      if (progress < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }, [inView, end, duration]);

  return (
    <span ref={ref} className="tabular-nums">
      {display.toLocaleString()}
    </span>
  );
}

// ─── Query keys ───────────────────────────────────────────────────────────────
const exhibitorKeys = {
  public: (params) => ["exhibitors", "public", params],
};

// ─── Common industries for quick-filter pills ─────────────────────────────────
const INDUSTRIES = [
  "Technology",
  "Healthcare",
  "Finance",
  "Retail",
  "Manufacturing",
  "Education",
  "Sustainability",
  "Logistics",
];

// ─── Skeleton card ────────────────────────────────────────────────────────────
function ExhibitorCardSkeleton() {
  return (
    <div className="card flex flex-col gap-3 overflow-hidden">
      <div className="skeleton h-32 -mx-6 -mt-6 rounded-b-none" />
      <div className="flex items-start gap-3">
        <div className="skeleton h-12 w-12 rounded shrink-0" />
        <div className="flex flex-col gap-1.5 flex-1">
          <div className="skeleton h-4 w-3/4 rounded" />
          <div className="skeleton h-3 w-1/2 rounded" />
        </div>
      </div>
      <div className="skeleton h-3 w-full rounded" />
      <div className="skeleton h-3 w-2/3 rounded" />
      <div className="flex gap-1.5 mt-1">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="skeleton h-5 w-16 rounded-sm" />
        ))}
      </div>
      <div className="skeleton h-9 w-28 rounded mt-1" />
    </div>
  );
}

// ─── Exhibitor card ───────────────────────────────────────────────────────────
function ExhibitorCard({ exhibitor, index, onMessage }) {
  const industries = exhibitor.industry ? [exhibitor.industry] : [];
  const colors = [
    "from-secondary/20 to-secondary/5",
    "from-tertiary/20 to-tertiary/5",
    "from-primary/20 to-primary/5",
    "from-warning/20 to-warning/5",
  ];
  const gradientColor = colors[index % colors.length];

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{
        duration: 0.3,
        delay: index * 0.05,
        ease: [0.4, 0, 0.2, 1],
      }}
      whileHover={{ y: -4 }}
      className="card flex flex-col gap-3 hover:shadow-level-2 transition-all duration-300 group overflow-hidden"
    >
      {/* Banner/Gradient Header */}
      <div
        className={cn(
          "relative -mx-6 -mt-6 mb-2 h-24 overflow-hidden bg-gradient-to-br",
          gradientColor,
        )}
      >
        {/* Decorative circles */}
        <div className="absolute -top-4 -right-4 w-20 h-20 rounded-full bg-white/10" />
        <div className="absolute -bottom-6 -left-2 w-16 h-16 rounded-full bg-white/5" />

        {/* Verified badge */}
        {exhibitor.isVerified && (
          <div className="absolute top-3 right-3">
            <motion.span
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{
                type: "spring",
                stiffness: 300,
                delay: index * 0.05 + 0.1,
              }}
              className="badge badge-success gap-1 shadow-sm"
            >
              <ShieldCheck size={11} /> Verified
            </motion.span>
          </div>
        )}
      </div>

      {/* Company header */}
      <div className="flex items-start gap-3 -mt-8">
        {exhibitor.logo ? (
          <motion.img
            whileHover={{ scale: 1.05 }}
            src={exhibitor.logo}
            alt={exhibitor.companyName}
            className="h-14 w-14 shrink-0 rounded-xl border-2 border-surface-bright object-contain bg-surface-bright shadow-sm"
          />
        ) : (
          <div
            className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl
                          border-2 border-surface-bright bg-primary-container text-on-primary-container shadow-sm"
          >
            <Building2 size={22} />
          </div>
        )}

        <div className="flex-1 min-w-0 pt-1">
          <h3
            className="text-body-md font-semibold text-on-surface line-clamp-1
                         group-hover:text-secondary transition-colors"
          >
            {exhibitor.companyName}
          </h3>
          {exhibitor.tagline && (
            <p className="text-body-sm text-on-surface-variant line-clamp-1 mt-0.5">
              {exhibitor.tagline}
            </p>
          )}
          {exhibitor.industry && (
            <span className="badge badge-info mt-1 inline-block text-label-sm">
              {exhibitor.industry}
            </span>
          )}
        </div>
      </div>

      {/* Description */}
      {exhibitor.description && (
        <p className="text-body-sm text-on-surface-variant line-clamp-3 leading-relaxed">
          {exhibitor.description}
        </p>
      )}

      {/* Products */}
      {exhibitor.products?.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {exhibitor.products.slice(0, 4).map((p, i) => (
            <motion.span
              key={p}
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: index * 0.05 + i * 0.03 }}
              className="badge badge-neutral text-label-sm line-clamp-1 max-w-[120px]"
            >
              {p}
            </motion.span>
          ))}
          {exhibitor.products.length > 4 && (
            <span className="badge badge-neutral text-label-sm">
              +{exhibitor.products.length - 4} more
            </span>
          )}
        </div>
      )}

      {/* Footer: social links + CTA */}
      <div className="flex items-center justify-between gap-2 mt-auto pt-3 border-t border-outline-variant">
        {/* Social links */}
        <div className="flex items-center gap-1.5">
          {exhibitor.socialLinks?.website && (
            <motion.a
              whileHover={{ scale: 1.15 }}
              whileTap={{ scale: 0.9 }}
              href={exhibitor.socialLinks.website}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="rounded-lg p-1.5 text-on-surface-variant hover:text-secondary hover:bg-surface-container transition-all"
              title="Website"
            >
              <Globe size={14} />
            </motion.a>
          )}
          {exhibitor.socialLinks?.linkedin && (
            <motion.a
              whileHover={{ scale: 1.15 }}
              whileTap={{ scale: 0.9 }}
              href={exhibitor.socialLinks.linkedin}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="rounded-lg p-1.5 text-on-surface-variant hover:text-tertiary hover:bg-surface-container transition-all"
              title="LinkedIn"
            >
              <FaLinkedin size={14} />
            </motion.a>
          )}
          {exhibitor.socialLinks?.twitter && (
            <motion.a
              whileHover={{ scale: 1.15 }}
              whileTap={{ scale: 0.9 }}
              href={exhibitor.socialLinks.twitter}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="rounded-lg p-1.5 text-on-surface-variant hover:text-tertiary hover:bg-surface-container transition-all"
              title="Twitter / X"
            >
              <FaXTwitter size={14} />
            </motion.a>
          )}
        </div>

        {/* Message CTA */}
        <motion.button
          whileHover={{ scale: 1.03 }}
          whileTap={{ scale: 0.97 }}
          onClick={() => onMessage(exhibitor)}
          className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-body-sm font-medium
                     text-on-surface-variant border border-outline-variant
                     hover:border-secondary hover:text-secondary hover:bg-secondary-container/20
                     transition-all duration-200"
        >
          <MessageSquare size={13} />
          Message
        </motion.button>
      </div>
    </motion.div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function AttendeeExhibitors() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [activeIndustry, setActiveIndustry] = useState("");
  const navigate = useNavigate();

  const page = parseInt(searchParams.get("page") || "1", 10);
  const search = searchParams.get("search") || "";
  const LIMIT = 12;

  const setParam = useCallback(
    (key, value) => {
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        if (value) next.set(key, value);
        else next.delete(key);
        if (key !== "page") next.delete("page");
        return next;
      });
    },
    [setSearchParams],
  );

  // ── Fetch approved exhibitors ───────────────────────────────────────────────
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: exhibitorKeys.public({
      page,
      search,
      industry: activeIndustry,
      limit: LIMIT,
    }),
    queryFn: async () => {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(LIMIT),
      });
      if (search) params.set("search", search);
      if (activeIndustry) params.set("industry", activeIndustry);
      const { data } = await api.get(`/exhibitors/public?${params}`);
      return data.data;
    },
    keepPreviousData: true,
  });

 const handleMessage = useCallback((exhibitor) => {
  const participantId = exhibitor.userId?._id || exhibitor.userId;
  if (participantId) {
    navigate('/attendee/messages', { 
      state: { openChatWith: participantId } 
    });
  } else {
    navigate('/attendee/messages');
  }
}, [navigate]);

  const profiles = data?.profiles || [];
  const pagination = data?.pagination || {};

  return (
    <div className="flex flex-col gap-6">
      {/* ── Header ──────────────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="page-header"
      >
        <div>
          <h1 className="page-title flex items-center gap-2">
            <Sparkles size={20} className="text-secondary" />
            Exhibitors
          </h1>
          <p className="page-subtitle">
            {!isLoading && pagination.total !== undefined ? (
              <span>
                <CountUp end={pagination.total} /> exhibiting compan
                {pagination.total !== 1 ? "ies" : "y"}
              </span>
            ) : (
              "Discover companies and brands at EventSphere expos."
            )}
          </p>
        </div>
      </motion.div>

      {/* ── Search ───────────────────────────────────────────────── */}
      <div className="relative max-w-lg">
        <Search
          size={15}
          className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant"
        />
        <input
          type="search"
          placeholder="Search companies, products, or industries…"
          value={search}
          onChange={(e) => setParam("search", e.target.value)}
          className="input pl-9 pr-8"
        />
        {search && (
          <motion.button
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            onClick={() => setParam("search", "")}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-on-surface-variant
                       hover:text-on-surface transition-colors"
            aria-label="Clear search"
          >
            <X size={14} />
          </motion.button>
        )}
      </div>

      {/* ── Industry filter pills ─────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1.5 font-mono text-label-sm text-on-surface-variant shrink-0">
          <Tag size={13} />
          <span>Industry:</span>
        </div>

        <motion.button
          whileHover={{ scale: 1.03 }}
          whileTap={{ scale: 0.97 }}
          onClick={() => setActiveIndustry("")}
          className={cn(
            "badge transition-all duration-200 cursor-pointer",
            activeIndustry === ""
              ? "bg-primary text-on-primary shadow-sm"
              : "badge-neutral hover:bg-surface-container-high",
          )}
        >
          All
        </motion.button>

        {INDUSTRIES.map((industry) => (
          <motion.button
            key={industry}
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            onClick={() =>
              setActiveIndustry(activeIndustry === industry ? "" : industry)
            }
            className={cn(
              "badge transition-all duration-200 cursor-pointer",
              activeIndustry === industry
                ? "bg-secondary text-on-secondary shadow-sm"
                : "badge-neutral hover:bg-surface-container-high",
            )}
          >
            {industry}
            {activeIndustry === industry && (
              <X size={10} className="ml-0.5 inline" />
            )}
          </motion.button>
        ))}
      </div>

      {/* ── Results count ─────────────────────────────────────────── */}
      {!isLoading && (search || activeIndustry) && (
        <motion.div
          initial={{ opacity: 0, y: -5 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-between"
        >
          <p className="font-mono text-label-sm text-on-surface-variant">
            {pagination.total ?? 0} result{pagination.total !== 1 ? "s" : ""}
            {search && (
              <>
                {" "}
                for "<span className="text-on-surface">{search}</span>"
              </>
            )}
            {activeIndustry && (
              <>
                {" "}
                in <span className="text-on-surface">{activeIndustry}</span>
              </>
            )}
          </p>
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => {
              setParam("search", "");
              setActiveIndustry("");
            }}
            className="font-mono text-label-sm text-tertiary hover:text-secondary transition-colors gap-1 flex items-center"
          >
            <X size={12} /> Clear filters
          </motion.button>
        </motion.div>
      )}

      {/* ── Exhibitor grid ────────────────────────────────────────── */}
      {isLoading ? (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <ExhibitorCardSkeleton key={i} />
          ))}
        </div>
      ) : isError ? (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="empty-state py-16"
        >
          <motion.div
            animate={{ rotate: [0, 10, -10, 0] }}
            transition={{ duration: 0.5, delay: 0.3 }}
            className="empty-state-icon text-error"
          >
            <AlertCircle size={24} />
          </motion.div>
          <h3 className="empty-state-title">Failed to load exhibitors</h3>
          <motion.button
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            onClick={() => refetch()}
            className="btn-ghost btn-sm mt-3 gap-1"
          >
            <RefreshCw size={13} /> Retry
          </motion.button>
        </motion.div>
      ) : profiles.length === 0 ? (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="empty-state py-16"
        >
          <motion.div
            animate={{ y: [0, -8, 0] }}
            transition={{ repeat: Infinity, duration: 3, ease: "easeInOut" }}
            className="empty-state-icon"
          >
            <Building2 size={28} />
          </motion.div>
          <h3 className="empty-state-title">No exhibitors found</h3>
          <p className="empty-state-body">
            {search || activeIndustry
              ? "Try adjusting your search or industry filter."
              : "No approved exhibitors are available yet."}
          </p>
          {(search || activeIndustry) && (
            <motion.button
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              onClick={() => {
                setParam("search", "");
                setActiveIndustry("");
              }}
              className="btn-ghost btn-sm mt-3 gap-1"
            >
              <X size={13} /> Clear filters
            </motion.button>
          )}
        </motion.div>
      ) : (
        <AnimatePresence mode="popLayout">
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {profiles.map((exhibitor, i) => (
              <ExhibitorCard
                key={exhibitor._id}
                exhibitor={exhibitor}
                index={i}
                onMessage={handleMessage}
              />
            ))}
          </div>
        </AnimatePresence>
      )}

      {/* ── Pagination ───────────────────────────────────────────── */}
      {!isLoading && pagination.totalPages > 1 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="flex items-center justify-between"
        >
          <p className="font-mono text-label-sm text-on-surface-variant">
            Page {pagination.page} of {pagination.totalPages} ·{" "}
            {pagination.total.toLocaleString()} total
          </p>
          <div className="flex items-center gap-2">
            <motion.button
              whileHover={{ x: -2 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setParam("page", String(page - 1))}
              disabled={!pagination.hasPrevPage}
              className="btn-ghost btn-sm gap-1 disabled:opacity-40"
            >
              <ChevronLeft size={15} /> Prev
            </motion.button>
            <motion.button
              whileHover={{ x: 2 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setParam("page", String(page + 1))}
              disabled={!pagination.hasNextPage}
              className="btn-ghost btn-sm gap-1 disabled:opacity-40"
            >
              Next <ChevronRight size={15} />
            </motion.button>
          </div>
        </motion.div>
      )}
    </div>
  );
}
