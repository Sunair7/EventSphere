import { useRef }                   from 'react';
import { Link }                     from 'react-router-dom';
import { useQuery }                 from '@tanstack/react-query';
import { motion, useInView }        from 'framer-motion';
import {
  CalendarDays, LayoutGrid, Users, MessageSquare,
  BarChart3, ShieldCheck, ArrowRight, Building2,
  Ticket, MapPin, BookOpen, Zap, Globe,
  CheckCircle2,
} from 'lucide-react';
import { format }                   from 'date-fns';
import api                          from '@/utils/api';
import { cn }                       from '@/utils/cn';

// ─── Animation helpers ────────────────────────────────────────────────────────
const fadeUp = {
  hidden:  { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.45, ease: [0.4, 0, 0.2, 1] } },
};

const stagger = (delayChildren = 0.1) => ({
  hidden:  {},
  visible: { transition: { staggerChildren: delayChildren } },
});

function AnimatedSection({ children, className, delay = 0 }) {
  const ref     = useRef(null);
  const inView  = useInView(ref, { once: true, margin: '-80px' });

  return (
    <motion.div
      ref={ref}
      initial="hidden"
      animate={inView ? 'visible' : 'hidden'}
      variants={stagger(0.08)}
      className={className}
      style={{ transitionDelay: `${delay}ms` }}
    >
      {children}
    </motion.div>
  );
}

// ─── Feature card ─────────────────────────────────────────────────────────────
function FeatureCard({ icon: Icon, title, description, color }) {
  return (
    <motion.div
      variants={fadeUp}
      className="card flex flex-col gap-3 hover:shadow-level-2 transition-shadow duration-200"
    >
      <div className={cn(
        'flex h-10 w-10 items-center justify-center rounded',
        color
      )}>
        <Icon size={19} />
      </div>
      <h3 className="text-headline-sm font-semibold text-on-surface">{title}</h3>
      <p className="text-body-sm text-on-surface-variant leading-relaxed">{description}</p>
    </motion.div>
  );
}

// ─── Expo preview card ────────────────────────────────────────────────────────
function ExpoPreviewCard({ expo, index }) {
  return (
    <motion.div
      variants={fadeUp}
      transition={{ delay: index * 0.07 }}
      className="card flex flex-col gap-3 hover:shadow-level-2 transition-shadow duration-200 group"
    >
      <div className="flex items-start justify-between gap-2">
        <span className={cn(
          'badge',
          expo.status === 'ongoing' ? 'badge-success' : 'badge-info'
        )}>
          {expo.status === 'ongoing' ? '🔴 Live Now' : format(new Date(expo.startDate), 'MMM d, yyyy')}
        </span>
        {expo.theme && (
          <span className="font-mono text-label-sm text-on-surface-variant line-clamp-1">
            {expo.theme}
          </span>
        )}
      </div>

      <h3 className="text-body-md font-semibold text-on-surface group-hover:text-secondary
                     transition-colors line-clamp-2 leading-snug">
        {expo.title}
      </h3>

      <div className="flex items-center gap-1.5 text-body-sm text-on-surface-variant">
        <MapPin size={13} className="shrink-0" />
        <span className="line-clamp-1">{expo.address?.city}, {expo.address?.country}</span>
      </div>

      <div className="flex items-center gap-4 mt-auto pt-1">
        <div className="flex items-center gap-1 font-mono text-label-sm text-on-surface-variant">
          <Building2 size={12} />
          <span>{expo.boothCount ?? 0} booths</span>
        </div>
        <div className="flex items-center gap-1 font-mono text-label-sm text-on-surface-variant">
          <BookOpen size={12} />
          <span>{expo.sessionCount ?? 0} sessions</span>
        </div>
      </div>

      <Link
        to="/register"
        className="btn-ghost btn-sm gap-1 mt-1 self-start group-hover:text-secondary
                   group-hover:border-secondary transition-colors"
      >
        Register to attend <ArrowRight size={13} />
      </Link>
    </motion.div>
  );
}

// ─── Role path card ───────────────────────────────────────────────────────────
function RoleCard({ icon: Icon, role, title, description, features, cta, to, accent }) {
  return (
    <motion.div
      variants={fadeUp}
      className={cn(
        'card flex flex-col gap-4 border-2 hover:shadow-level-2 transition-all duration-200',
        accent
      )}
    >
      <div className="flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-md bg-primary text-on-primary">
          <Icon size={20} />
        </div>
        <div>
          <p className="font-mono text-label-sm uppercase tracking-wider text-on-surface-variant">
            {role}
          </p>
          <h3 className="text-headline-sm font-semibold text-on-surface">{title}</h3>
        </div>
      </div>

      <p className="text-body-sm text-on-surface-variant">{description}</p>

      <ul className="flex flex-col gap-1.5">
        {features.map((f) => (
          <li key={f} className="flex items-start gap-2 text-body-sm text-on-surface">
            <CheckCircle2 size={14} className="mt-0.5 shrink-0 text-secondary" />
            {f}
          </li>
        ))}
      </ul>

      <Link to={to} className="btn-secondary gap-2 mt-auto">
        {cta} <ArrowRight size={15} />
      </Link>
    </motion.div>
  );
}

// ─── Stats bar ────────────────────────────────────────────────────────────────
const STATS = [
  { value: '10,000+', label: 'Attendees managed'  },
  { value: '500+',    label: 'Expos hosted'        },
  { value: '98%',     label: 'Uptime SLA'          },
  { value: '< 1s',    label: 'Real-time sync'      },
];

// ─── Features config ──────────────────────────────────────────────────────────
const FEATURES = [
  {
    icon:  LayoutGrid,
    title: 'Interactive Floor Plans',
    description: 'Drag-and-drop booth management with live availability updates. Exhibitors browse and reserve spaces in real time.',
    color: 'bg-secondary-container text-on-secondary-container',
  },
  {
    icon:  Zap,
    title: 'Real-Time Synchronisation',
    description: 'Socket.io powered live updates across all connected clients. Booth state changes propagate instantly to every viewer.',
    color: 'bg-tertiary-container text-on-tertiary-container',
  },
  {
    icon:  CalendarDays,
    title: 'Schedule Engine',
    description: 'Build complex multi-room event schedules with conflict detection, attendee registration, and live session status.',
    color: 'bg-primary-container text-on-primary-container',
  },
  {
    icon:  MessageSquare,
    title: 'Integrated Messaging',
    description: 'Direct messaging between organisers, exhibitors, and attendees with typing indicators and read receipts.',
    color: 'bg-success-container text-on-success-container',
  },
  {
    icon:  ShieldCheck,
    title: 'Application Workflow',
    description: 'Multi-stage exhibitor verification with document review, approval pipeline, and automated status notifications.',
    color: 'bg-warning-container text-on-warning-container',
  },
  {
    icon:  BarChart3,
    title: 'Analytics Dashboard',
    description: 'Comprehensive reporting on booth utilisation, session engagement, and attendee growth — exportable on demand.',
    color: 'bg-error-container text-on-error-container',
  },
];

const ROLES = [
  {
    icon:  ShieldCheck,
    role:  'Organiser',
    title: 'Command & Control',
    description: 'The complete operational overview for event administrators.',
    features: [
      'Create and publish expo events',
      'Manage the interactive floor plan',
      'Review and approve exhibitor applications',
      'Monitor real-time analytics',
      'Moderate messaging and content',
    ],
    cta:    'Access Admin Portal',
    to:     '/login',
    accent: 'border-primary/20',
  },
  {
    icon:  Building2,
    role:  'Exhibitor',
    title: 'Showcase Your Brand',
    description: 'Everything you need to present at world-class events.',
    features: [
      'Build a rich company profile',
      'Browse and reserve booth spaces',
      'Register for keynotes and workshops',
      'Message organisers directly',
      'Track application status in real time',
    ],
    cta:    'Register as Exhibitor',
    to:     '/register',
    accent: 'border-secondary/30',
  },
  {
    icon:  Ticket,
    role:  'Attendee',
    title: 'Discover & Engage',
    description: 'The complete attendee experience for event discovery.',
    features: [
      'Browse upcoming expos worldwide',
      'Register for sessions and keynotes',
      'Explore the interactive floor plan',
      'Bookmark sessions for your schedule',
      'Connect with exhibiting companies',
    ],
    cta:    'Register as Attendee',
    to:     '/register',
    accent: 'border-tertiary/30',
  },
];

// ─── Main component ───────────────────────────────────────────────────────────
export default function LandingPage() {
  const { data: expos = [], isLoading: expoLoading } = useQuery({
    queryKey: ['expos', 'upcoming', 'landing'],
    queryFn:  async () => {
      const { data } = await api.get('/expos/upcoming?limit=3');
      return data.data.expos;
    },
    staleTime: 10 * 60 * 1000,
  });

  return (
    <div className="flex flex-col">

      {/* ── Hero ──────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden bg-primary py-24 lg:py-32">
        {/* Background grid pattern */}
        <div
          className="pointer-events-none absolute inset-0 opacity-5"
          style={{
            backgroundImage: 'linear-gradient(#ffffff 1px, transparent 1px), linear-gradient(90deg, #ffffff 1px, transparent 1px)',
            backgroundSize: '48px 48px',
          }}
          aria-hidden="true"
        />

        <div className="relative mx-auto max-w-container px-container-pad">
          <motion.div
            initial="hidden"
            animate="visible"
            variants={stagger(0.1)}
            className="mx-auto max-w-3xl text-center"
          >
            {/* Badge */}
            <motion.div variants={fadeUp} className="mb-6 flex justify-center">
              <span className="inline-flex items-center gap-2 rounded-full border border-white/20
                               bg-white/10 px-4 py-1.5 font-mono text-label-md text-inverse-on-surface">
                <Globe size={13} />
                Enterprise Event Logistics Platform
              </span>
            </motion.div>

            {/* Headline */}
            <motion.h1
              variants={fadeUp}
              className="font-sans text-display-lg font-bold leading-tight
                         text-inverse-on-surface"
            >
              Manage Events at{' '}
              <span className="text-secondary">Enterprise Scale</span>
            </motion.h1>

            {/* Sub */}
            <motion.p
              variants={fadeUp}
              className="mt-6 text-body-lg text-inverse-on-surface/70 leading-relaxed"
            >
              EventSphere gives organisers, exhibitors, and attendees a unified command centre —
              real-time floor plans, smart scheduling, integrated chat, and live analytics.
            </motion.p>

            {/* CTAs */}
            <motion.div
              variants={fadeUp}
              className="mt-10 flex flex-col items-center gap-3 sm:flex-row sm:justify-center"
            >
              <Link to="/register" className="btn-secondary btn-lg gap-2 min-w-[180px]">
                Get Started Free <ArrowRight size={17} />
              </Link>
              <Link
                to="/login"
                className="btn-lg gap-2 rounded border border-white/20 bg-white/10
                           text-inverse-on-surface hover:bg-white/20 transition-colors min-w-[180px]
                           inline-flex items-center justify-center font-medium"
              >
                Sign In
              </Link>
            </motion.div>

            {/* Trust line */}
            <motion.p
              variants={fadeUp}
              className="mt-6 font-mono text-label-sm text-inverse-on-surface/40"
            >
              No credit card required · GDPR compliant · 99% uptime SLA
            </motion.p>
          </motion.div>
        </div>
      </section>

      {/* ── Stats bar ─────────────────────────────────────────────── */}
      <section className="border-b border-outline-variant bg-surface-container-low py-8">
        <div className="mx-auto max-w-container px-container-pad">
          <div className="grid grid-cols-2 gap-6 sm:grid-cols-4">
            {STATS.map((stat, i) => (
              <motion.div
                key={stat.label}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 + i * 0.08, duration: 0.3 }}
                className="flex flex-col items-center gap-1 text-center"
              >
                <span className="font-mono text-headline-md font-bold text-secondary">
                  {stat.value}
                </span>
                <span className="font-mono text-label-sm text-on-surface-variant">
                  {stat.label}
                </span>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Features grid ─────────────────────────────────────────── */}
      <section className="py-20">
        <div className="mx-auto max-w-container px-container-pad">
          <AnimatedSection className="mb-12 text-center">
            <motion.p variants={fadeUp} className="font-mono text-label-md uppercase tracking-widest text-secondary mb-2">
              Platform Features
            </motion.p>
            <motion.h2 variants={fadeUp} className="text-headline-lg font-semibold text-on-surface">
              Everything you need to run a world-class event
            </motion.h2>
            <motion.p variants={fadeUp} className="mt-4 text-body-lg text-on-surface-variant mx-auto max-w-2xl">
              From booth allocation to post-event analytics, EventSphere handles every
              operational layer of modern expo management.
            </motion.p>
          </AnimatedSection>

          <AnimatedSection className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((feature) => (
              <FeatureCard key={feature.title} {...feature} />
            ))}
          </AnimatedSection>
        </div>
      </section>

      {/* ── Upcoming expos ────────────────────────────────────────── */}
      {(expos.length > 0 || expoLoading) && (
        <section className="bg-surface-container-low py-20">
          <div className="mx-auto max-w-container px-container-pad">
            <AnimatedSection className="mb-10">
              <motion.div variants={fadeUp} className="flex items-end justify-between gap-4 flex-wrap">
                <div>
                  <p className="font-mono text-label-md uppercase tracking-widest text-secondary mb-1">
                    Live & Upcoming
                  </p>
                  <h2 className="text-headline-lg font-semibold text-on-surface">
                    Discover upcoming expos
                  </h2>
                </div>
                <Link to="/register" className="btn-ghost gap-1.5 shrink-0">
                  View all events <ArrowRight size={14} />
                </Link>
              </motion.div>
            </AnimatedSection>

            {expoLoading ? (
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="card flex flex-col gap-3">
                    <div className="skeleton h-4 w-20 rounded-sm" />
                    <div className="skeleton h-5 w-3/4 rounded" />
                    <div className="skeleton h-4 w-1/2 rounded" />
                    <div className="skeleton h-4 w-2/3 rounded" />
                    <div className="skeleton h-8 w-32 rounded mt-2" />
                  </div>
                ))}
              </div>
            ) : (
              <AnimatedSection className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
                {expos.map((expo, i) => (
                  <ExpoPreviewCard key={expo._id} expo={expo} index={i} />
                ))}
              </AnimatedSection>
            )}
          </div>
        </section>
      )}

      {/* ── Role paths ────────────────────────────────────────────── */}
      <section className="py-20">
        <div className="mx-auto max-w-container px-container-pad">
          <AnimatedSection className="mb-12 text-center">
            <motion.p variants={fadeUp} className="font-mono text-label-md uppercase tracking-widest text-secondary mb-2">
              Built for Every Stakeholder
            </motion.p>
            <motion.h2 variants={fadeUp} className="text-headline-lg font-semibold text-on-surface">
              One platform, three powerful portals
            </motion.h2>
          </AnimatedSection>

          <AnimatedSection className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            {ROLES.map((role) => (
              <RoleCard key={role.role} {...role} />
            ))}
          </AnimatedSection>
        </div>
      </section>

      {/* ── Final CTA ─────────────────────────────────────────────── */}
      <section className="bg-primary py-20">
        <div className="mx-auto max-w-container px-container-pad text-center">
          <AnimatedSection>
            <motion.h2
              variants={fadeUp}
              className="text-headline-lg font-semibold text-inverse-on-surface"
            >
              Ready to run your next event?
            </motion.h2>
            <motion.p
              variants={fadeUp}
              className="mt-4 text-body-lg text-inverse-on-surface/70 mx-auto max-w-xl"
            >
              Join thousands of organisers, exhibitors, and attendees on the
              EventSphere platform today.
            </motion.p>
            <motion.div
              variants={fadeUp}
              className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center"
            >
              <Link to="/register" className="btn-secondary btn-lg gap-2 min-w-[180px]">
                Create Free Account <ArrowRight size={17} />
              </Link>
              <Link
                to="/login"
                className="btn-lg rounded border border-white/20 bg-transparent
                           text-inverse-on-surface hover:bg-white/10 transition-colors
                           min-w-[160px] inline-flex items-center justify-center font-medium"
              >
                Sign In
              </Link>
            </motion.div>
          </AnimatedSection>
        </div>
      </section>
    </div>
  );
}