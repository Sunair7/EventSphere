import { useState, useRef }                      from 'react';
import { useParams, Link, useNavigate }         from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence }              from 'framer-motion';
import {
  ArrowLeft, Edit2, LayoutGrid, BookOpen,
  Building2, CalendarDays, MapPin, Users,
  Send, XCircle, Trash2, BarChart3,
  CheckCircle2, Clock, AlertCircle, RefreshCw,
  ExternalLink, Tag, Globe, Lock, Image,
  Upload, X, Loader2, ChevronLeft, ChevronRight,
  Sparkles,
} from 'lucide-react';
import { format }                               from 'date-fns';
import toast                                    from 'react-hot-toast';
import api                                      from '@/utils/api';
import { cn }                                   from '@/utils/cn';

// ─── Query keys ───────────────────────────────────────────────────────────────
const expoKey    = (id) => ['expos', id];
const statsKey   = (id) => ['expos', id, 'stats'];
const sessionsKey = (id) => ['sessions', 'expo', id, 'admin'];

// ─── Status badge map ─────────────────────────────────────────────────────────
const STATUS_BADGE = {
  draft:     'badge-neutral',
  published: 'badge-info',
  ongoing:   'badge-success',
  completed: 'badge-neutral',
  cancelled: 'badge-error',
};

// ─── Skeletons ────────────────────────────────────────────────────────────────
function StatSkeleton() {
  return (
    <div className="card flex flex-col gap-2 p-4">
      <div className="skeleton h-9 w-9 rounded" />
      <div className="skeleton h-7 w-16 rounded" />
      <div className="skeleton h-4 w-24 rounded" />
    </div>
  );
}

function SessionRowSkeleton() {
  return (
    <tr className="border-b border-outline-variant">
      {[40, 20, 24, 20, 16].map((w, i) => (
        <td key={i} className="px-4 py-density-high">
          <div className="skeleton h-4 rounded" style={{ width: `${w * 3}px` }} />
        </td>
      ))}
    </tr>
  );
}

// ─── Banner Upload Component ──────────────────────────────────────────────────
function BannerUpload({ expoId, currentBanner, onSuccess }) {
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState(null);
  const fileRef = useRef(null);

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate
    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file.');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error('Image must be under 10MB.');
      return;
    }

    // Show preview
    setPreview(URL.createObjectURL(file));
    
    // Upload
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('banner', file);
      
      const { data } = await api.post(`/expos/${expoId}/banner`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      
      toast.success('Banner uploaded successfully!');
      onSuccess?.(data.data.banner);
    } catch (err) {
      toast.error(err.message || 'Failed to upload banner.');
      setPreview(null);
    } finally {
      setUploading(false);
    }
  };

  const handleRemove = async () => {
    try {
      await api.delete(`/expos/${expoId}/banner`);
      toast.success('Banner removed.');
      setPreview(null);
      onSuccess?.(null);
    } catch (err) {
      toast.error(err.message || 'Failed to remove banner.');
    }
  };

  const displayUrl = preview || currentBanner?.url;

  return (
    <div className="flex flex-col gap-3">
      {/* Banner preview */}
      {displayUrl ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="relative group rounded-lg overflow-hidden border border-outline-variant aspect-video bg-surface-container-low"
        >
          <img
            src={displayUrl}
            alt="Expo banner"
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
            <button
              onClick={() => fileRef.current?.click()}
              className="btn-ghost btn-sm gap-1.5 bg-white/20 text-white hover:bg-white/30"
            >
              <Upload size={14} /> Change
            </button>
            <button
              onClick={handleRemove}
              className="btn-ghost btn-sm gap-1.5 bg-white/20 text-white hover:bg-error/60"
            >
              <Trash2 size={14} /> Remove
            </button>
          </div>
        </motion.div>
      ) : (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          onClick={() => fileRef.current?.click()}
          className={cn(
            'flex flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed aspect-video',
            'cursor-pointer transition-all duration-200',
            'border-outline-variant hover:border-secondary/50 hover:bg-surface-container-low'
          )}
        >
          {uploading ? (
            <div className="flex flex-col items-center gap-2">
              <Loader2 size={24} className="animate-spin-slow text-secondary" />
              <span className="font-mono text-label-sm text-on-surface-variant">Uploading…</span>
            </div>
          ) : (
            <>
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary-container text-on-primary-container">
                <Image size={18} />
              </div>
              <div className="text-center">
                <p className="text-body-sm font-medium text-on-surface">Add banner image</p>
                <p className="font-mono text-label-sm text-on-surface-variant mt-0.5">
                  Recommended: 1200×630 · Max 10MB
                </p>
              </div>
            </>
          )}
        </motion.div>
      )}

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        onChange={handleFile}
        className="hidden"
      />
    </div>
  );
}

// ─── Gallery Component ────────────────────────────────────────────────────────
function GalleryManager({ expoId, images = [], onUpdate }) {
  const [uploading, setUploading] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(null);
  const fileRef = useRef(null);

  const handleFiles = async (e) => {
    const files = e.target.files;
    if (!files?.length) return;

    const formData = new FormData();
    Array.from(files).forEach((file) => {
      if (file.size > 10 * 1024 * 1024) {
        toast.error(`"${file.name}" exceeds 10MB limit.`);
        return;
      }
      formData.append('gallery', file);
    });

    setUploading(true);
    try {
      const { data } = await api.post(`/expos/${expoId}/gallery`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      toast.success(`${files.length} image(s) added to gallery.`);
      onUpdate?.(data.data.gallery);
    } catch (err) {
      toast.error(err.message || 'Failed to upload images.');
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const handleDelete = async (imageId) => {
    try {
      await api.delete(`/expos/${expoId}/gallery/${imageId}`);
      toast.success('Image removed from gallery.');
      const updated = images.filter((img) => img._id !== imageId);
      onUpdate?.(updated);
    } catch (err) {
      toast.error(err.message || 'Failed to delete image.');
    }
  };

  return (
    <div className="flex flex-col gap-3">
      {/* Gallery grid */}
      {images.length > 0 ? (
        <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-5 gap-2">
          {images.map((img, i) => (
            <motion.div
              key={img._id}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: i * 0.03 }}
              className="relative group rounded-md overflow-hidden border border-outline-variant aspect-square cursor-pointer"
              onClick={() => setLightboxIndex(i)}
            >
              <img
                src={img.url}
                alt={img.altText || `Gallery image ${i + 1}`}
                className="w-full h-full object-cover"
                loading="lazy"
              />
              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                <button
                  onClick={(e) => { e.stopPropagation(); handleDelete(img._id); }}
                  className="p-1.5 rounded bg-error/80 text-white hover:bg-error transition-colors"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            </motion.div>
          ))}
        </div>
      ) : (
        <div className="py-8 text-center border-2 border-dashed border-outline-variant rounded-lg">
          <Image size={24} className="mx-auto text-on-surface-variant/30" />
          <p className="mt-2 text-body-sm text-on-surface-variant">No gallery images yet.</p>
        </div>
      )}

      {/* Upload button */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => fileRef.current?.click()}
          disabled={uploading || images.length >= 20}
          className="btn-ghost btn-sm gap-1.5"
        >
          {uploading ? (
            <Loader2 size={14} className="animate-spin-slow" />
          ) : (
            <Upload size={14} />
          )}
          {uploading ? 'Uploading…' : 'Add Images'}
        </button>
        <span className="font-mono text-label-sm text-on-surface-variant">
          {images.length}/20 images
        </span>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          multiple
          onChange={handleFiles}
          className="hidden"
        />
      </div>

      {/* Lightbox */}
      <AnimatePresence>
        {lightboxIndex !== null && images[lightboxIndex] && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-modal bg-black/90 flex items-center justify-center"
            onClick={() => setLightboxIndex(null)}
          >
            <button
              onClick={() => setLightboxIndex(null)}
              className="absolute top-4 right-4 p-2 rounded-full bg-white/10 text-white hover:bg-white/20"
            >
              <X size={20} />
            </button>

            {lightboxIndex > 0 && (
              <button
                onClick={(e) => { e.stopPropagation(); setLightboxIndex(lightboxIndex - 1); }}
                className="absolute left-4 top-1/2 -translate-y-1/2 p-2 rounded-full bg-white/10 text-white hover:bg-white/20"
              >
                <ChevronLeft size={24} />
              </button>
            )}

            <motion.img
              key={lightboxIndex}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              src={images[lightboxIndex].url}
              alt={images[lightboxIndex].altText || `Gallery image ${lightboxIndex + 1}`}
              className="max-h-[85vh] max-w-[90vw] object-contain rounded-lg"
              onClick={(e) => e.stopPropagation()}
            />

            {lightboxIndex < images.length - 1 && (
              <button
                onClick={(e) => { e.stopPropagation(); setLightboxIndex(lightboxIndex + 1); }}
                className="absolute right-4 top-1/2 -translate-y-1/2 p-2 rounded-full bg-white/10 text-white hover:bg-white/20"
              >
                <ChevronRight size={24} />
              </button>
            )}

            <div className="absolute bottom-4 text-white font-mono text-label-sm">
              {lightboxIndex + 1} / {images.length}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Stat card ────────────────────────────────────────────────────────────────
function StatCard({ icon: Icon, iconBg, iconFg, label, value, sub, to }) {
  const content = (
    <motion.div
      whileHover={{ y: -2 }}
      transition={{ duration: 0.15 }}
      className="card flex flex-col gap-3 p-4 h-full hover:shadow-level-2 transition-shadow duration-200 relative overflow-hidden"
    >
      <div className="absolute inset-0 bg-gradient-to-br from-transparent to-secondary/[0.02] opacity-0 hover:opacity-100 transition-opacity duration-300 pointer-events-none" />
      <div className={cn('flex h-9 w-9 items-center justify-center rounded-lg relative z-10', iconBg)}>
        <Icon size={17} className={iconFg} />
      </div>
      <div className="relative z-10">
        <p className="font-mono text-headline-sm font-bold text-on-surface">{value ?? '—'}</p>
        <p className="text-body-sm text-on-surface-variant">{label}</p>
        {sub && <p className="font-mono text-label-sm text-on-surface-variant mt-0.5">{sub}</p>}
      </div>
    </motion.div>
  );

  if (to) {
    return (
      <Link to={to} className="block">
        {content}
      </Link>
    );
  }
  return content;
}

// ─── Confirm modal ────────────────────────────────────────────────────────────
function ConfirmModal({ action, title, body, onConfirm, onCancel, isLoading,
                        confirmLabel, confirmClass, icon: Icon, iconBg, iconFg }) {
  return (
    <div className="modal-overlay" role="dialog" aria-modal="true">
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1    }}
        exit={{ opacity: 0, scale: 0.96    }}
        transition={{ duration: 0.18 }}
        className="modal-panel max-w-md p-6"
      >
        <motion.div
          initial={{ rotate: -10, scale: 0 }}
          animate={{ rotate: 0, scale: 1 }}
          transition={{ type: 'spring', stiffness: 300, damping: 20, delay: 0.1 }}
          className={cn('mb-4 flex h-10 w-10 items-center justify-center rounded-md', iconBg)}
        >
          <Icon size={18} className={iconFg} />
        </motion.div>
        <h2 className="mb-1 text-headline-sm font-semibold text-on-surface">{title}</h2>
        <p className="mb-5 text-body-sm text-on-surface-variant">{body}</p>
        <div className="flex justify-end gap-3">
          <button onClick={onCancel} disabled={isLoading} className="btn-ghost">Cancel</button>
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={onConfirm}
            disabled={isLoading}
            className={cn(confirmClass, 'flex items-center gap-2')}
          >
            {isLoading ? (
              <>
                <RefreshCw size={14} className="animate-spin-slow" />
                Processing…
              </>
            ) : confirmLabel}
          </motion.button>
        </div>
      </motion.div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function AdminExpoDetail() {
  const { id }       = useParams();
  const navigate     = useNavigate();
  const queryClient  = useQueryClient();
  const [modal, setModal] = useState(null);

  // ── Fetch expo ──────────────────────────────────────────────────────────────
  const { data: expo, isLoading: expoLoading, isError } = useQuery({
    queryKey: expoKey(id),
    queryFn:  async () => {
      const { data } = await api.get(`/expos/${id}`);
      return data.data.expo;
    },
  });

  // ── Fetch stats ─────────────────────────────────────────────────────────────
  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: statsKey(id),
    queryFn:  async () => {
      const { data } = await api.get(`/analytics/expo/${id}`);
      return data.data;
    },
    enabled: !!expo,
  });

  // ── Fetch sessions (first 5) ────────────────────────────────────────────────
  const { data: sessionsData, isLoading: sessionsLoading } = useQuery({
    queryKey: sessionsKey(id),
    queryFn:  async () => {
      const { data } = await api.get(`/sessions/expo/${id}?limit=5&sort=startTime`);
      return data.data;
    },
    enabled: !!expo,
  });

  // ── Mutations ────────────────────────────────────────────────────────────────
  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: expoKey(id) });
    queryClient.invalidateQueries({ queryKey: ['expos'] });
  };

  const publishMutation = useMutation({
    mutationFn: () => api.patch(`/expos/${id}/status`, { status: 'published' }),
    onSuccess:  () => { toast.success('Expo published successfully.', { icon: '✅' }); invalidate(); setModal(null); },
    onError:    (err) => toast.error(err.message || 'Failed to publish expo.'),
  });

  const cancelMutation = useMutation({
    mutationFn: () => api.patch(`/expos/${id}/status`, { status: 'cancelled' }),
    onSuccess:  () => { toast.success('Expo cancelled.', { icon: '❌' }); invalidate(); setModal(null); },
    onError:    (err) => toast.error(err.message || 'Failed to cancel expo.'),
  });

  const deleteMutation = useMutation({
    mutationFn: () => api.delete(`/expos/${id}`),
    onSuccess:  () => {
      toast.success('Expo deleted successfully.');
      queryClient.invalidateQueries({ queryKey: ['expos'] });
      navigate('/admin/expos', { replace: true });
    },
    onError: (err) => toast.error(err.message || 'Failed to delete expo.'),
  });

  // ── Error state ─────────────────────────────────────────────────────────────
  if (isError) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="empty-state py-20"
      >
        <motion.div
          animate={{ rotate: [0, 10, -10, 0] }}
          transition={{ duration: 0.5, delay: 0.3 }}
          className="empty-state-icon text-error"
        >
          <AlertCircle size={28} />
        </motion.div>
        <h3 className="empty-state-title">Expo not found</h3>
        <Link to="/admin/expos" className="btn-ghost btn-sm mt-3 gap-1.5">
          <ArrowLeft size={14} /> Back to expos
        </Link>
      </motion.div>
    );
  }

  const sessions   = sessionsData?.sessions || [];
  const boothStats = stats?.booths          || {};

  return (
    <>
      <div className="flex flex-col gap-6">

        {/* ── Header ──────────────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="flex items-start justify-between gap-4 flex-wrap"
        >
          <div className="flex items-center gap-3">
            <Link to="/admin/expos" className="btn-ghost btn-sm gap-1.5">
              <ArrowLeft size={15} /> Expos
            </Link>
            <div>
              {expoLoading ? (
                <div className="skeleton h-7 w-64 rounded" />
              ) : (
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className="text-headline-md font-semibold text-on-surface flex items-center gap-2">
                    <Sparkles size={18} className="text-secondary" />
                    {expo?.title}
                  </h1>
                  <motion.span
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: 'spring', stiffness: 300 }}
                    className={cn('badge', STATUS_BADGE[expo?.status] || 'badge-neutral')}
                  >
                    {expo?.status}
                  </motion.span>
                  {expo?.isPublic === false && (
                    <span className="badge badge-neutral gap-1">
                      <Lock size={10} /> Private
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Action buttons */}
          {!expoLoading && expo && (
            <motion.div
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.1 }}
              className="flex items-center gap-2 flex-wrap"
            >
              <Link to={`/admin/expos/${id}/floor-plan`} className="btn-ghost btn-sm gap-1.5">
                <LayoutGrid size={14} /> Floor Plan
              </Link>
              <Link to={`/admin/expos/${id}/sessions`} className="btn-ghost btn-sm gap-1.5">
                <BookOpen size={14} /> Sessions
              </Link>
              <Link to={`/admin/expos/${id}/edit`} className="btn-ghost btn-sm gap-1.5">
                <Edit2 size={14} /> Edit
              </Link>

              {expo.status === 'draft' && (
                <motion.button
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.97 }}
                  onClick={() => setModal('publish')}
                  className="btn-secondary btn-sm gap-1.5"
                >
                  <Send size={14} /> Publish
                </motion.button>
              )}
              {['draft', 'published', 'ongoing'].includes(expo.status) && (
                <motion.button
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.97 }}
                  onClick={() => setModal('cancel')}
                  className="btn-ghost btn-sm gap-1.5 text-error hover:bg-error-container"
                >
                  <XCircle size={14} /> Cancel
                </motion.button>
              )}
              {expo.status !== 'ongoing' && (
                <motion.button
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.97 }}
                  onClick={() => setModal('delete')}
                  className="btn-ghost btn-sm gap-1.5 text-error hover:bg-error-container"
                >
                  <Trash2 size={14} /> Delete
                </motion.button>
              )}
            </motion.div>
          )}
        </motion.div>

        {/* ── Banner ───────────────────────────────────────────────── */}
        {!expoLoading && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="card"
          >
            <h2 className="text-headline-sm font-semibold text-on-surface mb-3 flex items-center gap-2">
              <Image size={16} className="text-secondary" />
              Banner Image
            </h2>
            <BannerUpload
              expoId={id}
              currentBanner={expo?.banner}
              onSuccess={() => invalidate()}
            />
          </motion.div>
        )}

        {/* ── Expo meta ────────────────────────────────────────────── */}
        {expoLoading ? (
          <div className="card flex flex-col gap-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="skeleton h-4 rounded" style={{ width: `${(i + 3) * 10}%` }} />
            ))}
          </div>
        ) : expo && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="card flex flex-col gap-4"
          >
            {expo.description && (
              <p className="text-body-sm text-on-surface-variant leading-relaxed">
                {expo.description}
              </p>
            )}

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div className="flex items-center gap-2 text-body-sm text-on-surface-variant">
                <CalendarDays size={15} className="text-secondary shrink-0" />
                <span>
                  {format(new Date(expo.startDate), 'MMM d')} —{' '}
                  {format(new Date(expo.endDate), 'MMM d, yyyy')}
                </span>
              </div>
              <div className="flex items-center gap-2 text-body-sm text-on-surface-variant">
                <MapPin size={15} className="text-secondary shrink-0" />
                <span className="truncate">
                  {expo.address?.venue
                    ? `${expo.address.venue}, ${expo.address.city}`
                    : `${expo.address?.city}, ${expo.address?.country}`}
                </span>
              </div>
              {expo.theme && (
                <div className="flex items-center gap-2 text-body-sm text-on-surface-variant">
                  <Globe size={15} className="text-secondary shrink-0" />
                  <span>{expo.theme}</span>
                </div>
              )}
              {expo.maxAttendees && (
                <div className="flex items-center gap-2 text-body-sm text-on-surface-variant">
                  <Users size={15} className="text-secondary shrink-0" />
                  <span>Max {expo.maxAttendees.toLocaleString()} attendees</span>
                </div>
              )}
            </div>

            {expo.tags?.length > 0 && (
              <div className="flex items-center gap-2 flex-wrap">
                <Tag size={13} className="text-on-surface-variant" />
                {expo.tags.map((tag) => (
                  <span key={tag} className="badge badge-neutral">{tag}</span>
                ))}
              </div>
            )}

            <div className="flex items-center justify-between border-t border-outline-variant pt-3">
              <p className="font-mono text-label-sm text-on-surface-variant">
                Created by{' '}
                <span className="text-on-surface font-medium">{expo.createdBy?.name}</span>
                {' · '}
                {format(new Date(expo.createdAt), 'MMM d, yyyy')}
              </p>
              <Link
                to={`/admin/analytics`}
                className="flex items-center gap-1 font-mono text-label-sm text-tertiary
                           hover:text-secondary transition-colors"
              >
                <BarChart3 size={12} /> Analytics
              </Link>
            </div>
          </motion.div>
        )}

        {/* ── Gallery ──────────────────────────────────────────────── */}
        {!expoLoading && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25 }}
            className="card"
          >
            <h2 className="text-headline-sm font-semibold text-on-surface mb-3 flex items-center gap-2">
              <Image size={16} className="text-secondary" />
              Gallery
            </h2>
            <GalleryManager
              expoId={id}
              images={expo?.gallery || []}
              onUpdate={() => invalidate()}
            />
          </motion.div>
        )}

        {/* ── Stats row ────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {statsLoading || expoLoading
            ? Array.from({ length: 4 }).map((_, i) => <StatSkeleton key={i} />)
            : [
                {
                  icon:   LayoutGrid,
                  iconBg: 'bg-primary-container',
                  iconFg: 'text-on-primary-container',
                  label:  'Total Booths',
                  value:  expo?.boothCount?.toLocaleString(),
                  sub:    `${boothStats.assigned ?? 0} assigned · ${boothStats.pending ?? 0} pending`,
                  to:     `/admin/expos/${id}/floor-plan`,
                },
                {
                  icon:   BookOpen,
                  iconBg: 'bg-secondary-container',
                  iconFg: 'text-on-secondary-container',
                  label:  'Sessions',
                  value:  expo?.sessionCount?.toLocaleString(),
                  sub:    `${stats?.sessions?.totalRegistrations ?? 0} registrations`,
                  to:     `/admin/expos/${id}/sessions`,
                },
                {
                  icon:   Building2,
                  iconBg: 'bg-tertiary-container',
                  iconFg: 'text-on-tertiary-container',
                  label:  'Exhibitors',
                  value:  boothStats.assigned?.toLocaleString(),
                  sub:    'Confirmed booths',
                  to:     `/admin/exhibitors`,
                },
                {
                  icon:   Users,
                  iconBg: 'bg-warning-container',
                  iconFg: 'text-on-warning-container',
                  label:  'Attendees',
                  value:  expo?.attendeeCount?.toLocaleString(),
                  sub:    expo?.maxAttendees
                    ? `${Math.round(((expo.attendeeCount || 0) / expo.maxAttendees) * 100)}% capacity`
                    : 'No limit set',
                },
              ].map((card) => <StatCard key={card.label} {...card} />)
          }
        </div>

        {/* ── Booth allocation bar ─────────────────────────────────── */}
        {!statsLoading && boothStats.total > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="card"
          >
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-headline-sm font-semibold text-on-surface">
                Booth Allocation
              </h2>
              <Link to={`/admin/expos/${id}/floor-plan`}
                className="font-mono text-label-sm text-tertiary hover:text-secondary transition-colors gap-1 flex items-center">
                View floor plan <ExternalLink size={11} />
              </Link>
            </div>

            <div className="flex h-3 w-full rounded-full overflow-hidden gap-0.5 mb-3">
              {[
                { key: 'assigned', color: 'bg-primary',   flex: boothStats.assigned  || 0 },
                { key: 'pending',  color: 'bg-warning',   flex: boothStats.pending   || 0 },
                { key: 'available',color: 'bg-surface-container-high', flex: boothStats.available || 0 },
              ].filter((s) => s.flex > 0).map((seg) => (
                <motion.div
                  key={seg.key}
                  initial={{ flex: 0 }}
                  animate={{ flex: seg.flex }}
                  transition={{ duration: 0.6, ease: [0.4, 0, 0.2, 1] }}
                  className={cn(seg.color, 'relative overflow-hidden')}
                >
                  <motion.div
                    className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent"
                    animate={{ x: ['-100%', '100%'] }}
                    transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }}
                  />
                </motion.div>
              ))}
            </div>

            <div className="flex items-center gap-5 flex-wrap">
              {[
                { dot: 'bg-primary',   label: 'Assigned', count: boothStats.assigned  ?? 0 },
                { dot: 'bg-warning',   label: 'Pending',  count: boothStats.pending   ?? 0 },
                { dot: 'bg-surface-container-high border border-outline-variant',
                                       label: 'Available',count: boothStats.available ?? 0 },
              ].map(({ dot, label, count }) => (
                <div key={label} className="flex items-center gap-1.5">
                  <span className={cn('h-2.5 w-2.5 rounded-full', dot)} />
                  <span className="font-mono text-label-md text-on-surface-variant">
                    {label}: <span className="font-semibold text-on-surface">{count}</span>
                  </span>
                </div>
              ))}

              {boothStats.totalRevenue > 0 && (
                <div className="ml-auto flex items-center gap-1.5 font-mono text-label-md text-secondary">
                  <CheckCircle2 size={13} />
                  ${(boothStats.totalRevenue / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} projected revenue
                </div>
              )}
            </div>
          </motion.div>
        )}

        {/* ── Sessions table ───────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35 }}
          className="flex flex-col gap-3"
        >
          <div className="flex items-center justify-between">
            <h2 className="text-headline-sm font-semibold text-on-surface">Sessions</h2>
            <Link to={`/admin/expos/${id}/sessions`} className="btn-ghost btn-sm gap-1.5">
              <BookOpen size={14} /> Manage Sessions
            </Link>
          </div>

          <div className="table-wrapper">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Title</th>
                  <th>Format</th>
                  <th>Date & Time</th>
                  <th>Location</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {sessionsLoading ? (
                  Array.from({ length: 3 }).map((_, i) => <SessionRowSkeleton key={i} />)
                ) : sessions.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-10 text-center">
                      <div className="empty-state py-4">
                        <motion.div
                          animate={{ y: [0, -5, 0] }}
                          transition={{ repeat: Infinity, duration: 3 }}
                          className="empty-state-icon mx-auto mb-2"
                        >
                          <BookOpen size={20} />
                        </motion.div>
                        <p className="empty-state-title text-body-sm">No sessions yet</p>
                        <Link to={`/admin/expos/${id}/sessions`}
                          className="btn-secondary btn-sm mt-3 gap-1 inline-flex">
                          <BookOpen size={13} /> Add Sessions
                        </Link>
                      </div>
                    </td>
                  </tr>
                ) : (
                  sessions.map((session, i) => (
                    <motion.tr
                      key={session._id}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.04 }}
                      className="border-b border-outline-variant hover:bg-surface-container-low
                                 transition-colors duration-150"
                    >
                      <td className="px-4 py-density-high">
                        <span className="text-body-sm font-medium text-on-surface line-clamp-1">
                          {session.title}
                        </span>
                      </td>
                      <td className="px-4 py-density-high">
                        <span className="badge badge-neutral capitalize">{session.format}</span>
                      </td>
                      <td className="px-4 py-density-high">
                        <span className="font-mono text-label-md text-on-surface-variant whitespace-nowrap">
                          {format(new Date(session.startTime), 'MMM d, HH:mm')}
                        </span>
                      </td>
                      <td className="px-4 py-density-high">
                        <span className="text-body-sm text-on-surface-variant">{session.location}</span>
                      </td>
                      <td className="px-4 py-density-high">
                        <span className={cn('badge', {
                          'badge-success': session.status === 'live',
                          'badge-info':    session.status === 'scheduled',
                          'badge-neutral': session.status === 'completed',
                          'badge-error':   session.status === 'cancelled',
                        })}>
                          {session.status}
                        </span>
                      </td>
                    </motion.tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {sessionsData?.pagination?.total > 5 && (
            <p className="font-mono text-label-sm text-on-surface-variant text-right">
              Showing 5 of {sessionsData.pagination.total} sessions.{' '}
              <Link to={`/admin/expos/${id}/sessions`} className="text-tertiary hover:text-secondary">
                View all →
              </Link>
            </p>
          )}
        </motion.div>

        {/* ── Floor plan config ────────────────────────────────────── */}
        {expo?.floorPlanConfig && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="card"
          >
            <h2 className="text-headline-sm font-semibold text-on-surface mb-4">
              Floor Plan Configuration
            </h2>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              {[
                { label: 'Rows',         value: expo.floorPlanConfig.rows       },
                { label: 'Columns',      value: expo.floorPlanConfig.cols       },
                { label: 'Booth Width',  value: `${expo.floorPlanConfig.boothWidth  ?? 3}m` },
                { label: 'Booth Height', value: `${expo.floorPlanConfig.boothHeight ?? 3}m` },
              ].map(({ label, value }) => (
                <div key={label} className="flex flex-col gap-0.5">
                  <span className="font-mono text-label-sm text-on-surface-variant">{label}</span>
                  <span className="font-mono text-headline-sm font-bold text-on-surface">{value}</span>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </div>

      {/* ── Modals ───────────────────────────────────────────────────── */}
      <AnimatePresence>
        {modal === 'publish' && (
          <ConfirmModal
            title="Publish expo?"
            body={`"${expo?.title}" will be publicly visible to exhibitors and attendees.`}
            icon={Send}
            iconBg="bg-secondary-container"
            iconFg="text-on-secondary-container"
            confirmLabel="Publish"
            confirmClass="btn-secondary"
            onConfirm={() => publishMutation.mutate()}
            onCancel={() => setModal(null)}
            isLoading={publishMutation.isPending}
          />
        )}
        {modal === 'cancel' && (
          <ConfirmModal
            title="Cancel expo?"
            body={`"${expo?.title}" will be cancelled. This cannot be undone.`}
            icon={XCircle}
            iconBg="bg-warning-container"
            iconFg="text-on-warning-container"
            confirmLabel="Cancel Expo"
            confirmClass="btn-danger"
            onConfirm={() => cancelMutation.mutate()}
            onCancel={() => setModal(null)}
            isLoading={cancelMutation.isPending}
          />
        )}
        {modal === 'delete' && (
          <ConfirmModal
            title="Delete expo?"
            body={`"${expo?.title}" and all associated booths and sessions will be permanently deleted.`}
            icon={Trash2}
            iconBg="bg-error-container"
            iconFg="text-on-error-container"
            confirmLabel="Delete Expo"
            confirmClass="btn-danger"
            onConfirm={() => deleteMutation.mutate()}
            onCancel={() => setModal(null)}
            isLoading={deleteMutation.isPending}
          />
        )}
      </AnimatePresence>
    </>
  );
}