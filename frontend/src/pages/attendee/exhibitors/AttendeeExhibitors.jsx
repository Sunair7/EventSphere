import { useState, useCallback }    from 'react';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import { useQuery }                 from '@tanstack/react-query';
import { motion, AnimatePresence }  from 'framer-motion';
import {
  Search, X, Building2, Globe, 
  MessageSquare, AlertCircle,
  RefreshCw, ChevronLeft, ChevronRight,
  Tag, ShieldCheck, ArrowRight,
} from 'lucide-react';
import { FaLinkedin, FaXTwitter } from 'react-icons/fa6';
import api                          from '@/utils/api';
import { cn }                       from '@/utils/cn';

// ─── Query keys ───────────────────────────────────────────────────────────────
const exhibitorKeys = {
  public: (params) => ['exhibitors', 'public', params],
};

// ─── Common industries for quick-filter pills ─────────────────────────────────
const INDUSTRIES = [
  'Technology', 'Healthcare', 'Finance', 'Retail',
  'Manufacturing', 'Education', 'Sustainability', 'Logistics',
];

// ─── Skeleton card ────────────────────────────────────────────────────────────
function ExhibitorCardSkeleton() {
  return (
    <div className="card flex flex-col gap-3">
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
      <div className="skeleton h-8 w-28 rounded mt-1" />
    </div>
  );
}

// ─── Exhibitor card ───────────────────────────────────────────────────────────
function ExhibitorCard({ exhibitor, index, onMessage }) {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0  }}
      exit={{ opacity: 0, scale: 0.98 }}
      transition={{ duration: 0.2, delay: index * 0.04 }}
      className="card flex flex-col gap-3 hover:shadow-level-2 transition-shadow duration-200 group"
    >
      {/* Company header */}
      <div className="flex items-start gap-3">
        {exhibitor.logo ? (
          <img
            src={exhibitor.logo}
            alt={exhibitor.companyName}
            className="h-12 w-12 shrink-0 rounded border border-outline-variant object-contain bg-surface-bright"
          />
        ) : (
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded
                          bg-primary-container text-on-primary-container">
            <Building2 size={20} />
          </div>
        )}

        <div className="flex-1 min-w-0">
          <div className="flex items-start gap-1.5 flex-wrap">
            <h3 className="text-body-md font-semibold text-on-surface line-clamp-1
                           group-hover:text-secondary transition-colors">
              {exhibitor.companyName}
            </h3>
            {exhibitor.isVerified && (
              <ShieldCheck size={14} className="text-secondary shrink-0 mt-0.5" title="Verified" />
            )}
          </div>
          {exhibitor.tagline && (
            <p className="text-body-sm text-on-surface-variant line-clamp-1 mt-0.5">
              {exhibitor.tagline}
            </p>
          )}
          {exhibitor.industry && (
            <span className="badge badge-info mt-1 inline-block">{exhibitor.industry}</span>
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
          {exhibitor.products.slice(0, 4).map((p) => (
            <span key={p} className="badge badge-neutral text-label-sm line-clamp-1 max-w-[120px]">
              {p}
            </span>
          ))}
          {exhibitor.products.length > 4 && (
            <span className="badge badge-neutral text-label-sm">
              +{exhibitor.products.length - 4} more
            </span>
          )}
        </div>
      )}

      {/* Footer: social links + CTA */}
      <div className="flex items-center justify-between gap-2 mt-auto pt-1 border-t border-outline-variant">
        {/* Social links */}
        <div className="flex items-center gap-2">
          {exhibitor.socialLinks?.website && (
            <a
              href={exhibitor.socialLinks.website}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="rounded p-1 text-on-surface-variant hover:text-secondary transition-colors"
              title="Website"
            >
              <Globe size={14} />
            </a>
          )}
          {exhibitor.socialLinks?.linkedin && (
            <a
              href={exhibitor.socialLinks.linkedin}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="rounded p-1 text-on-surface-variant hover:text-tertiary transition-colors"
              title="LinkedIn"
            >
              <FaLinkedin size={14} />
            </a>
          )}
          {exhibitor.socialLinks?.twitter && (
            <a
              href={exhibitor.socialLinks.twitter}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="rounded p-1 text-on-surface-variant hover:text-tertiary transition-colors"
              title="Twitter / X"
            >
              <FaXTwitter size={14} />
            </a>
          )}
        </div>

        {/* Message CTA */}
        <button
          onClick={() => onMessage(exhibitor)}
          className="flex items-center gap-1 rounded px-2.5 py-1.5 font-mono text-label-md
                     text-on-surface-variant border border-outline-variant
                     hover:border-secondary hover:text-secondary hover:bg-secondary-container/20
                     transition-all duration-200"
        >
          <MessageSquare size={13} />
          Message
        </button>
      </div>
    </motion.div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function AttendeeExhibitors() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [activeIndustry, setActiveIndustry] = useState('');
  const navigate = useNavigate();

  const page   = parseInt(searchParams.get('page')   || '1', 10);
  const search = searchParams.get('search') || '';
  const LIMIT  = 12;

  const setParam = useCallback((key, value) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (value) next.set(key, value);
      else        next.delete(key);
      if (key !== 'page') next.delete('page');
      return next;
    });
  }, [setSearchParams]);

  // ── Fetch approved exhibitors ───────────────────────────────────────────────
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: exhibitorKeys.public({ page, search, industry: activeIndustry, limit: LIMIT }),
    queryFn:  async () => {
      const params = new URLSearchParams({
        page:  String(page),
        limit: String(LIMIT),
      });
      if (search)         params.set('search',   search);
      if (activeIndustry) params.set('industry', activeIndustry);
      const { data } = await api.get(`/exhibitors/public?${params}`);
      return data.data;
    },
    keepPreviousData: true,
  });

  const handleMessage = useCallback((exhibitor) => {
    // Navigate to messages with the exhibitor's userId pre-selected
    // The exhibitor profile doesn't expose userId directly in the public endpoint,
    // so we navigate to messages and let the user search
    navigate('/attendee/messages');
  }, [navigate]);

  const profiles   = data?.profiles   || [];
  const pagination = data?.pagination || {};

  return (
    <div className="flex flex-col gap-6">

      {/* ── Header ──────────────────────────────────────────────── */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Exhibitors</h1>
          <p className="page-subtitle">
            {pagination.total !== undefined
              ? `${pagination.total} exhibiting compan${pagination.total !== 1 ? 'ies' : 'y'}`
              : 'Discover companies and brands at EventSphere expos.'}
          </p>
        </div>
      </div>

      {/* ── Search ───────────────────────────────────────────────── */}
      <div className="relative max-w-lg">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant" />
        <input
          type="search"
          placeholder="Search companies, products, or industries…"
          value={search}
          onChange={(e) => setParam('search', e.target.value)}
          className="input pl-9 pr-8"
        />
        {search && (
          <button
            onClick={() => setParam('search', '')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-on-surface-variant
                       hover:text-on-surface transition-colors"
            aria-label="Clear search"
          >
            <X size={14} />
          </button>
        )}
      </div>

      {/* ── Industry filter pills ─────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1.5 font-mono text-label-sm text-on-surface-variant shrink-0">
          <Tag size={13} />
          <span>Industry:</span>
        </div>

        <button
          onClick={() => setActiveIndustry('')}
          className={cn(
            'badge transition-all duration-200 cursor-pointer',
            activeIndustry === ''
              ? 'bg-primary text-on-primary'
              : 'badge-neutral hover:bg-surface-container-high'
          )}
        >
          All
        </button>

        {INDUSTRIES.map((industry) => (
          <button
            key={industry}
            onClick={() => setActiveIndustry(activeIndustry === industry ? '' : industry)}
            className={cn(
              'badge transition-all duration-200 cursor-pointer',
              activeIndustry === industry
                ? 'bg-secondary text-on-secondary'
                : 'badge-neutral hover:bg-surface-container-high'
            )}
          >
            {industry}
            {activeIndustry === industry && (
              <X size={10} className="ml-0.5 inline" />
            )}
          </button>
        ))}
      </div>

      {/* ── Results count ─────────────────────────────────────────── */}
      {!isLoading && (search || activeIndustry) && (
        <div className="flex items-center justify-between">
          <p className="font-mono text-label-sm text-on-surface-variant">
            {pagination.total ?? 0} result{pagination.total !== 1 ? 's' : ''}
            {search && <> for "<span className="text-on-surface">{search}</span>"</>}
            {activeIndustry && <> in <span className="text-on-surface">{activeIndustry}</span></>}
          </p>
          <button
            onClick={() => { setParam('search', ''); setActiveIndustry(''); }}
            className="font-mono text-label-sm text-tertiary hover:text-secondary transition-colors gap-1 flex items-center"
          >
            <X size={12} /> Clear filters
          </button>
        </div>
      )}

      {/* ── Exhibitor grid ────────────────────────────────────────── */}
      {isLoading ? (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => <ExhibitorCardSkeleton key={i} />)}
        </div>
      ) : isError ? (
        <div className="empty-state py-16">
          <div className="empty-state-icon text-error"><AlertCircle size={24} /></div>
          <h3 className="empty-state-title">Failed to load exhibitors</h3>
          <button onClick={() => refetch()} className="btn-ghost btn-sm mt-3 gap-1">
            <RefreshCw size={13} /> Retry
          </button>
        </div>
      ) : profiles.length === 0 ? (
        <div className="empty-state py-16">
          <div className="empty-state-icon"><Building2 size={28} /></div>
          <h3 className="empty-state-title">No exhibitors found</h3>
          <p className="empty-state-body">
            {search || activeIndustry
              ? 'Try adjusting your search or industry filter.'
              : 'No approved exhibitors are available yet.'}
          </p>
          {(search || activeIndustry) && (
            <button
              onClick={() => { setParam('search', ''); setActiveIndustry(''); }}
              className="btn-ghost btn-sm mt-3 gap-1"
            >
              <X size={13} /> Clear filters
            </button>
          )}
        </div>
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
        <div className="flex items-center justify-between">
          <p className="font-mono text-label-sm text-on-surface-variant">
            Page {pagination.page} of {pagination.totalPages}
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setParam('page', String(page - 1))}
              disabled={!pagination.hasPrevPage}
              className="btn-ghost btn-sm gap-1 disabled:opacity-40"
            >
              <ChevronLeft size={15} /> Prev
            </button>
            <button
              onClick={() => setParam('page', String(page + 1))}
              disabled={!pagination.hasNextPage}
              className="btn-ghost btn-sm gap-1 disabled:opacity-40"
            >
              Next <ChevronRight size={15} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}