import { useState }                              from 'react';
import { useParams, Link }                       from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence }               from 'framer-motion';
import {
  ArrowLeft, Building2, FileText, LayoutGrid,
  CheckCircle2, XCircle, Ban, Clock, ShieldCheck,
  ExternalLink, User, Globe, Linkedin, Twitter,
  Mail, Phone, Briefcase, AlertCircle, ChevronDown,
  ChevronUp, RefreshCw,
} from 'lucide-react';
import { format }                               from 'date-fns';
import toast                                    from 'react-hot-toast';
import api                                      from '@/utils/api';
import { cn }                                   from '@/utils/cn';

// ─── Query key ────────────────────────────────────────────────────────────────
const profileKey = (id) => ['admin', 'exhibitors', id];

// ─── Status config ────────────────────────────────────────────────────────────
const STATUS_CFG = {
  pending:   { badge: 'badge-warning', icon: Clock,        label: 'Pending Review'  },
  approved:  { badge: 'badge-success', icon: CheckCircle2, label: 'Approved'        },
  rejected:  { badge: 'badge-error',   icon: XCircle,      label: 'Not Approved'    },
  suspended: { badge: 'badge-error',   icon: Ban,          label: 'Suspended'       },
};

const DOC_CFG = {
  pending:  { badge: 'badge-warning', label: 'Awaiting Review' },
  verified: { badge: 'badge-success', label: 'Verified'        },
  rejected: { badge: 'badge-error',   label: 'Flagged'         },
};

const DOC_TYPE_LABELS = {
  business_registration: 'Business Registration',
  tax_certificate:       'Tax Certificate',
  identity_document:     'Identity Document',
  product_catalog:       'Product Catalog',
  insurance_certificate: 'Insurance Certificate',
  other:                 'Other',
};

// ─── Skeleton ─────────────────────────────────────────────────────────────────
function PageSkeleton() {
  return (
    <div className="flex flex-col gap-6">
      <div className="skeleton h-8 w-64 rounded" />
      <div className="skeleton h-40 rounded-md" />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="skeleton h-52 rounded-md" />
        <div className="skeleton h-52 rounded-md" />
      </div>
    </div>
  );
}

// ─── Action modal ─────────────────────────────────────────────────────────────
function ActionModal({ action, profile, onConfirm, onCancel, isMutating }) {
  const [note, setNote] = useState('');
  const requireNote     = action === 'reject';

  const cfg = {
    approve: {
      title:  'Approve application?',
      body:   `"${profile.companyName}" will be approved and can proceed to book booths.`,
      icon:   CheckCircle2,
      iconBg: 'bg-success-container',
      iconFg: 'text-on-success-container',
      btn:    'btn-secondary',
      label:  'Approve',
    },
    reject: {
      title:  'Reject application?',
      body:   `"${profile.companyName}" will be notified with your reason.`,
      icon:   XCircle,
      iconBg: 'bg-error-container',
      iconFg: 'text-on-error-container',
      btn:    'btn-danger',
      label:  'Reject',
    },
    suspend: {
      title:  'Suspend exhibitor?',
      body:   `"${profile.companyName}" will lose access to booth reservations.`,
      icon:   Ban,
      iconBg: 'bg-warning-container',
      iconFg: 'text-on-warning-container',
      btn:    'btn-danger',
      label:  'Suspend',
    },
  }[action] || {};

  const Icon = cfg.icon;

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true">
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1    }}
        exit={{ opacity: 0, scale: 0.96    }}
        transition={{ duration: 0.18 }}
        className="modal-panel max-w-md p-6"
      >
        <div className={cn('mb-4 flex h-10 w-10 items-center justify-center rounded-md', cfg.iconBg)}>
          <Icon size={18} className={cfg.iconFg} />
        </div>
        <h2 className="mb-1 text-headline-sm font-semibold text-on-surface">{cfg.title}</h2>
        <p className="mb-4 text-body-sm text-on-surface-variant">{cfg.body}</p>

        <div className="flex flex-col gap-1.5 mb-5">
          <label className="font-mono text-label-md text-on-surface">
            {requireNote ? 'Reason' : 'Note (optional)'}
            {requireNote && <span className="text-error ml-1">*</span>}
          </label>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={3}
            className="input resize-none"
            placeholder={requireNote ? 'Explain why this application was not approved…' : 'Optional note…'}
            maxLength={1000}
            autoFocus
          />
          <p className="font-mono text-label-sm text-on-surface-variant text-right">
            {note.length}/1000
          </p>
        </div>

        <div className="flex justify-end gap-3">
          <button onClick={onCancel} disabled={isMutating} className="btn-ghost">Cancel</button>
          <button
            onClick={() => onConfirm(note || null)}
            disabled={isMutating || (requireNote && !note.trim())}
            className={cfg.btn}
          >
            {isMutating ? 'Processing…' : cfg.label}
          </button>
        </div>
      </motion.div>
    </div>
  );
}

// ─── Document review row ──────────────────────────────────────────────────────
function DocumentRow({ doc, profileId, onReviewed }) {
  const [reviewing, setReviewing] = useState(false);
  const [note, setNote]           = useState('');
  const queryClient               = useQueryClient();

  const reviewMutation = useMutation({
    mutationFn: ({ status, note }) =>
      api.patch(`/exhibitors/${profileId}/documents/${doc._id}/review`, { status, note }),
    onSuccess: () => {
      toast.success('Document reviewed.');
      queryClient.invalidateQueries({ queryKey: profileKey(profileId) });
      setReviewing(false);
      setNote('');
      onReviewed?.();
    },
    onError: (err) => toast.error(err.message || 'Failed to review document.'),
  });

  const dCfg = DOC_CFG[doc.status] || DOC_CFG.pending;

  return (
    <div className="rounded-md border border-outline-variant bg-surface-bright">
      <div className="flex items-center gap-3 px-4 py-3">
        <FileText size={15} className="text-on-surface-variant shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-body-sm font-medium text-on-surface truncate">
            {doc.label || doc.fileName}
          </p>
          <p className="font-mono text-label-sm text-on-surface-variant">
            {DOC_TYPE_LABELS[doc.type] || doc.type}
          </p>
        </div>
        <span className={cn('badge shrink-0', dCfg.badge)}>{dCfg.label}</span>
        <a href={doc.fileUrl} target="_blank" rel="noopener noreferrer"
          className="shrink-0 rounded p-1.5 text-on-surface-variant hover:bg-surface-container
                     hover:text-on-surface transition-colors">
          <ExternalLink size={14} />
        </a>
        {doc.status === 'pending' && (
          <button
            onClick={() => setReviewing((v) => !v)}
            className="shrink-0 btn-ghost btn-sm gap-1"
          >
            Review {reviewing ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
          </button>
        )}
      </div>

      {doc.reviewNote && (
        <div className="border-t border-outline-variant px-4 py-2">
          <p className="font-mono text-label-sm text-on-surface-variant">
            Note: <span className="text-on-surface">{doc.reviewNote}</span>
          </p>
        </div>
      )}

      <AnimatePresence>
        {reviewing && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.18 }}
            className="overflow-hidden"
          >
            <div className="border-t border-outline-variant px-4 py-3 flex flex-col gap-3">
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={2}
                className="input resize-none text-body-sm"
                placeholder="Optional review note…"
                maxLength={500}
              />
              <div className="flex gap-2 justify-end">
                <button
                  onClick={() => reviewMutation.mutate({ status: 'rejected', note: note || null })}
                  disabled={reviewMutation.isPending}
                  className="btn-ghost btn-sm gap-1 text-error hover:bg-error-container"
                >
                  <XCircle size={13} /> Flag
                </button>
                <button
                  onClick={() => reviewMutation.mutate({ status: 'verified', note: note || null })}
                  disabled={reviewMutation.isPending}
                  className="btn-secondary btn-sm gap-1"
                >
                  <CheckCircle2 size={13} />
                  {reviewMutation.isPending ? 'Verifying…' : 'Verify'}
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function AdminExhibitorDetail() {
  const { id }       = useParams();
  const queryClient  = useQueryClient();
  const [modal, setModal] = useState(null);
  const [showHistory, setShowHistory] = useState(false);

  // ── Fetch profile ───────────────────────────────────────────────────────────
  const { data: profile, isLoading, isError, refetch } = useQuery({
    queryKey: profileKey(id),
    queryFn:  async () => {
      const { data } = await api.get(`/exhibitors/${id}`);
      return data.data.profile;
    },
  });

  // ── Mutations ────────────────────────────────────────────────────────────────
  const invalidate = () => queryClient.invalidateQueries({ queryKey: profileKey(id) });

  const approveMutation = useMutation({
    mutationFn: (note) => api.patch(`/exhibitors/${id}/approve`, { note }),
    onSuccess:  () => { toast.success('Application approved.'); invalidate(); setModal(null); },
    onError:    (err) => toast.error(err.message || 'Failed to approve.'),
  });

  const rejectMutation = useMutation({
    mutationFn: (note) => api.patch(`/exhibitors/${id}/reject`, { note }),
    onSuccess:  () => { toast.success('Application rejected.'); invalidate(); setModal(null); },
    onError:    (err) => toast.error(err.message || 'Failed to reject.'),
  });

  const suspendMutation = useMutation({
    mutationFn: (note) => api.patch(`/exhibitors/${id}/suspend`, { note }),
    onSuccess:  () => { toast.success('Exhibitor suspended.'); invalidate(); setModal(null); },
    onError:    (err) => toast.error(err.message || 'Failed to suspend.'),
  });

  const isMutating =
    approveMutation.isPending ||
    rejectMutation.isPending  ||
    suspendMutation.isPending;

  const handleConfirm = (note) => {
    if (modal === 'approve') approveMutation.mutate(note);
    if (modal === 'reject')  rejectMutation.mutate(note);
    if (modal === 'suspend') suspendMutation.mutate(note);
  };

  // ── States ──────────────────────────────────────────────────────────────────
  if (isLoading) return <PageSkeleton />;

  if (isError || !profile) {
    return (
      <div className="empty-state py-20">
        <div className="empty-state-icon text-error"><AlertCircle size={28} /></div>
        <h3 className="empty-state-title">Profile not found</h3>
        <button onClick={() => refetch()} className="btn-ghost btn-sm mt-3 gap-1">
          <RefreshCw size={13} /> Retry
        </button>
      </div>
    );
  }

  const statusCfg = STATUS_CFG[profile.applicationStatus] || STATUS_CFG.pending;
  const StatusIcon = statusCfg.icon;

  return (
    <>
      <div className="flex flex-col gap-6">

        {/* ── Header ──────────────────────────────────────────────── */}
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <Link to="/admin/exhibitors" className="btn-ghost btn-sm gap-1.5">
              <ArrowLeft size={15} /> Exhibitors
            </Link>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-headline-md font-semibold text-on-surface">
                  {profile.companyName}
                </h1>
                <span className={cn('badge', statusCfg.badge)}>
                  {profile.applicationStatus}
                </span>
                {profile.isVerified && (
                  <span className="flex items-center gap-1 font-mono text-label-sm text-secondary">
                    <ShieldCheck size={13} /> Verified
                  </span>
                )}
              </div>
              <p className="font-mono text-label-sm text-on-surface-variant mt-0.5">
                {profile.userId?.email}
              </p>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2 flex-wrap">
            {profile.applicationStatus === 'pending' && (
              <>
                <button onClick={() => setModal('approve')}
                  className="btn-secondary btn-sm gap-1.5">
                  <CheckCircle2 size={14} /> Approve
                </button>
                <button onClick={() => setModal('reject')}
                  className="btn-danger btn-sm gap-1.5">
                  <XCircle size={14} /> Reject
                </button>
              </>
            )}
            {profile.applicationStatus === 'approved' && (
              <button onClick={() => setModal('suspend')}
                className="btn-ghost btn-sm gap-1.5 text-error hover:bg-error-container">
                <Ban size={14} /> Suspend
              </button>
            )}
            {(profile.applicationStatus === 'rejected' ||
              profile.applicationStatus === 'suspended') && (
              <button onClick={() => setModal('approve')}
                className="btn-secondary btn-sm gap-1.5">
                <CheckCircle2 size={14} /> Re-approve
              </button>
            )}
          </div>
        </div>

        {/* ── Application status card ──────────────────────────────── */}
        <div className="card">
          <div className="flex items-start gap-3">
            <div className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded',
              profile.applicationStatus === 'approved' ? 'bg-success-container'
              : profile.applicationStatus === 'pending' ? 'bg-warning-container'
              : 'bg-error-container'
            )}>
              <StatusIcon size={17} className={
                profile.applicationStatus === 'approved' ? 'text-on-success-container'
                : profile.applicationStatus === 'pending' ? 'text-on-warning-container'
                : 'text-on-error-container'
              } />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-body-sm font-medium text-on-surface">
                {statusCfg.label}
                {profile.reviewedBy && (
                  <span className="text-on-surface-variant font-normal">
                    {' '}by <span className="font-medium">{profile.reviewedBy?.name}</span>
                    {profile.reviewedAt && (
                      <> on {format(new Date(profile.reviewedAt), 'MMM d, yyyy')}</>
                    )}
                  </span>
                )}
              </p>
              {profile.applicationNote && (
                <div className="mt-1.5 rounded bg-surface-container px-3 py-2">
                  <p className="font-mono text-label-sm text-on-surface-variant">
                    Note: <span className="text-on-surface">{profile.applicationNote}</span>
                  </p>
                </div>
              )}
            </div>

            {/* History toggle */}
            <button onClick={() => setShowHistory((v) => !v)}
              className="btn-ghost btn-sm gap-1 shrink-0">
              History
              {showHistory ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
            </button>
          </div>

          {/* Application history */}
          <AnimatePresence>
            {showHistory && profile.applicationHistory?.length > 0 && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden"
              >
                <div className="mt-4 border-t border-outline-variant pt-4 flex flex-col gap-2">
                  <p className="font-mono text-label-sm uppercase tracking-wider text-on-surface-variant mb-1">
                    Application History
                  </p>
                  {profile.applicationHistory.map((entry, i) => (
                    <div key={i} className="flex items-start gap-2 text-body-sm">
                      <span className="font-mono text-label-sm text-on-surface-variant shrink-0 mt-0.5">
                        {entry.changedAt ? format(new Date(entry.changedAt), 'MMM d, HH:mm') : '—'}
                      </span>
                      <span className="text-on-surface">
                        <span className="badge badge-neutral capitalize mr-1">{entry.fromStatus}</span>
                        → <span className="badge capitalize ml-1">{entry.toStatus}</span>
                        {entry.reason && (
                          <span className="ml-2 text-on-surface-variant">"{entry.reason}"</span>
                        )}
                      </span>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* ── Two column layout ────────────────────────────────────── */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">

          {/* Company info */}
          <div className="card flex flex-col gap-4">
            <div className="flex items-start gap-3 border-b border-outline-variant pb-4">
              {profile.logo ? (
                <img src={profile.logo} alt={profile.companyName}
                  className="h-12 w-12 rounded object-contain border border-outline-variant bg-surface-bright shrink-0" />
              ) : (
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded
                                bg-primary-container text-on-primary-container">
                  <Building2 size={20} />
                </div>
              )}
              <div className="min-w-0">
                <h2 className="text-headline-sm font-semibold text-on-surface">
                  {profile.companyName}
                </h2>
                {profile.tagline && (
                  <p className="text-body-sm text-on-surface-variant mt-0.5">{profile.tagline}</p>
                )}
                {profile.industry && (
                  <span className="badge badge-info mt-1 inline-block">{profile.industry}</span>
                )}
              </div>
            </div>

            {profile.description && (
              <p className="text-body-sm text-on-surface-variant leading-relaxed line-clamp-4">
                {profile.description}
              </p>
            )}

            {profile.products?.length > 0 && (
              <div>
                <p className="font-mono text-label-sm uppercase tracking-wider text-on-surface-variant mb-2">
                  Products & Services
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {profile.products.slice(0, 8).map((p) => (
                    <span key={p} className="badge badge-neutral">{p}</span>
                  ))}
                  {profile.products.length > 8 && (
                    <span className="badge badge-neutral">+{profile.products.length - 8}</span>
                  )}
                </div>
              </div>
            )}

            {/* Contact */}
            <div className="border-t border-outline-variant pt-4">
              <p className="font-mono text-label-sm uppercase tracking-wider text-on-surface-variant mb-2">
                Primary Contact
              </p>
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center gap-2 text-body-sm text-on-surface">
                  <User size={13} className="text-on-surface-variant shrink-0" />
                  {profile.contactPerson?.name}
                  {profile.contactPerson?.title && (
                    <span className="text-on-surface-variant">· {profile.contactPerson.title}</span>
                  )}
                </div>
                <div className="flex items-center gap-2 text-body-sm text-on-surface-variant">
                  <Mail size={13} className="shrink-0" />
                  {profile.contactPerson?.email}
                </div>
                {profile.contactPerson?.phone && (
                  <div className="flex items-center gap-2 text-body-sm text-on-surface-variant">
                    <Phone size={13} className="shrink-0" />
                    {profile.contactPerson.phone}
                  </div>
                )}
              </div>
            </div>

            {/* Social links */}
            {(profile.socialLinks?.website || profile.socialLinks?.linkedin || profile.socialLinks?.twitter) && (
              <div className="flex items-center gap-3 flex-wrap">
                {profile.socialLinks.website && (
                  <a href={profile.socialLinks.website} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-1 font-mono text-label-sm text-tertiary hover:text-secondary transition-colors">
                    <Globe size={13} /> Website
                  </a>
                )}
                {profile.socialLinks.linkedin && (
                  <a href={profile.socialLinks.linkedin} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-1 font-mono text-label-sm text-tertiary hover:text-secondary transition-colors">
                    <Linkedin size={13} /> LinkedIn
                  </a>
                )}
                {profile.socialLinks.twitter && (
                  <a href={profile.socialLinks.twitter} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-1 font-mono text-label-sm text-tertiary hover:text-secondary transition-colors">
                    <Twitter size={13} /> Twitter
                  </a>
                )}
              </div>
            )}
          </div>

          {/* Right column: documents + account info */}
          <div className="flex flex-col gap-6">

            {/* User account */}
            <div className="card flex flex-col gap-3">
              <h3 className="text-headline-sm font-semibold text-on-surface border-b border-outline-variant pb-3">
                Account Details
              </h3>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: 'Name',          value: profile.userId?.name                                     },
                  { label: 'Email',         value: profile.userId?.email                                    },
                  { label: 'Registered',    value: profile.userId?.createdAt
                    ? format(new Date(profile.userId.createdAt), 'MMM d, yyyy') : '—'                       },
                  { label: 'Last Login',    value: profile.userId?.lastLoginAt
                    ? format(new Date(profile.userId.lastLoginAt), 'MMM d, HH:mm') : 'Never'                },
                  { label: 'Email Verified',value: profile.userId?.isEmailVerified ? 'Yes' : 'No'           },
                  { label: 'Profile Since', value: profile.createdAt
                    ? format(new Date(profile.createdAt), 'MMM d, yyyy') : '—'                              },
                ].map(({ label, value }) => (
                  <div key={label} className="flex flex-col gap-0.5">
                    <span className="font-mono text-label-sm text-on-surface-variant">{label}</span>
                    <span className="text-body-sm font-medium text-on-surface truncate">
                      {value ?? '—'}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Documents */}
            <div className="card flex flex-col gap-3">
              <div className="flex items-center justify-between border-b border-outline-variant pb-3">
                <h3 className="text-headline-sm font-semibold text-on-surface">
                  Documents ({profile.documents?.length || 0})
                </h3>
                {profile.documents?.length > 0 && (
                  <span className="font-mono text-label-sm text-on-surface-variant">
                    {profile.documents.filter((d) => d.status === 'verified').length} verified
                    · {profile.documents.filter((d) => d.status === 'pending').length} pending
                  </span>
                )}
              </div>

              {!profile.documents?.length ? (
                <div className="py-6 text-center">
                  <p className="text-body-sm text-on-surface-variant">No documents uploaded yet.</p>
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  {profile.documents.map((doc) => (
                    <DocumentRow
                      key={doc._id}
                      doc={doc}
                      profileId={id}
                      onReviewed={() => {}}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── Assigned booths ──────────────────────────────────────── */}
        {profile.assignedBooths?.length > 0 && (
          <div className="card flex flex-col gap-3">
            <h3 className="text-headline-sm font-semibold text-on-surface border-b border-outline-variant pb-3">
              Assigned Booths ({profile.assignedBooths.length})
            </h3>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {profile.assignedBooths.map((ab, i) => (
                <div key={i} className="flex items-center gap-3 rounded-md border border-outline-variant
                                        bg-surface-bright px-4 py-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-sm
                                  bg-primary-container font-mono text-label-md font-bold text-on-primary-container">
                    {ab.boothId?.boothNumber ?? '—'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-body-sm font-medium text-on-surface truncate">
                      {ab.expoId?.title ?? 'Expo'}
                    </p>
                    <p className="font-mono text-label-sm text-on-surface-variant">
                      {ab.boothId?.dimensions ?? ''}
                      {ab.assignedAt ? ` · ${format(new Date(ab.assignedAt), 'MMM d, yyyy')}` : ''}
                    </p>
                  </div>
                  {ab.expoId?._id && (
                    <Link to={`/admin/expos/${ab.expoId._id}/floor-plan`}
                      className="shrink-0 rounded p-1.5 text-on-surface-variant hover:bg-surface-container
                                 hover:text-on-surface transition-colors">
                      <LayoutGrid size={14} />
                    </Link>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ── Action modal ──────────────────────────────────────────── */}
      <AnimatePresence>
        {modal && (
          <ActionModal
            action={modal}
            profile={profile}
            onConfirm={handleConfirm}
            onCancel={() => setModal(null)}
            isMutating={isMutating}
          />
        )}
      </AnimatePresence>
    </>
  );
}