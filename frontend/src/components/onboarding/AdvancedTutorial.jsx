import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  X, ChevronLeft, ChevronRight, 
  Check, SkipForward 
} from 'lucide-react';
import { cn } from '@/utils/cn';

const TUTORIAL_STEPS = {
  admin: [
    {
      title: '👋 Welcome to EventSphere Admin!',
      description: 'As an admin, you can manage expos, booths, sessions, exhibitors, and attendees. Let\'s take a quick tour!',
      target: null,
    },
    {
      title: '📋 Manage Expos',
      description: 'Create and manage expos here. You can set up the floor plan, add sessions, and manage registrations.',
      target: '.expos-tab',
    },
    {
      title: '📊 Floor Plan',
      description: 'Generate and manage the interactive floor plan. Approve booth reservations and assign booths.',
      target: '.floor-plan-tab',
    },
    {
      title: '📝 Sessions',
      description: 'Schedule sessions, add speakers, and manage capacity. Track attendee registrations.',
      target: '.sessions-tab',
    },
    {
      title: '👥 Exhibitors',
      description: 'Review exhibitor applications, verify documents, and manage booth assignments.',
      target: '.exhibitors-tab',
    },
    {
      title: '🎫 Attendees',
      description: 'View all registered attendees and manage their access.',
      target: '.attendees-tab',
    },
    // ❌ Removed feedback-tab since we don't have it in sidebar
    {
      title: '✅ You\'re All Set!',
      description: 'You\'re ready to manage your events. Explore the dashboard and create your first expo!',
      target: null,
    },
  ],
  exhibitor: [
    {
      title: '👋 Welcome to EventSphere Exhibitor!',
      description: 'You can showcase your company, reserve booths, and connect with attendees. Let\'s get started!',
      target: null,
    },
    {
      title: '🏢 Your Profile',
      description: 'Complete your company profile. Add your logo, description, and documents for verification.',
      target: '.profile-tab',
    },
    {
      title: '🔍 Browse Expos',
      description: 'Discover expos that match your industry. View details and available booths.',
      target: '.expos-tab',
    },
    {
      title: '📐 Reserve a Booth',
      description: 'Browse the interactive floor plan and reserve booth spaces. Complete payment to confirm.',
      target: '.floor-plan-tab',
    },
    {
      title: '📚 Sessions',
      description: 'Register for sessions relevant to your business. Network with attendees and speakers.',
      target: '.sessions-tab',
    },
    {
      title: '✅ You\'re Ready!',
      description: 'Start exploring expos and reserve your booth space today!',
      target: null,
    },
  ],
  attendee: [
    {
      title: '👋 Welcome to EventSphere Attendee!',
      description: 'Discover expos, register for sessions, and connect with exhibitors. Let\'s get started!',
      target: null,
    },
    {
      title: '🔍 Browse Expos',
      description: 'Find expos that interest you. View schedules, speakers, and exhibitors.',
      target: '.expos-tab',
    },
    {
      title: '📚 Register for Sessions',
      description: 'Browse sessions and register for the ones you want to attend. Track your schedule.',
      target: '.sessions-tab',
    },
    {
      title: '📅 Your Schedule',
      description: 'View all your registered sessions in one place. Never miss a session!',
      target: '.schedule-tab',
    },
    {
      title: '✅ You\'re All Set!',
      description: 'Start exploring expos and register for sessions today!',
      target: null,
    },
  ],
};

// ─── Target Highlighter Component ────────────────────────────────────────────
function TargetHighlighter({ target }) {
  const [targetRect, setTargetRect] = useState(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (!target) {
      setIsVisible(false);
      return;
    }

    const findElement = () => {
      const element = document.querySelector(target);
      if (element) {
        const rect = element.getBoundingClientRect();
        setTargetRect({
          top: rect.top,
          left: rect.left,
          width: rect.width,
          height: rect.height,
        });
        setIsVisible(true);
        return true;
      }
      return false;
    };

    // Try immediately
    if (!findElement()) {
      // If not found, try again after a short delay
      const timer = setTimeout(() => {
        findElement();
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [target]);

  if (!isVisible || !targetRect) {
    return null;
  }

  return (
    <div
      className="fixed pointer-events-none z-[199]"
      style={{
        top: targetRect.top - 6,
        left: targetRect.left - 6,
        width: targetRect.width + 12,
        height: targetRect.height + 12,
      }}
    >
      {/* Highlight border */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="w-full h-full rounded-lg border-2 border-secondary shadow-[0_0_0_4px_rgba(0,106,97,0.15)]"
      />
      
      {/* Pulsing ring */}
      <motion.div
        animate={{ scale: [1, 1.04, 1] }}
        transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
        className="absolute inset-0 rounded-lg border-2 border-secondary/20"
      />
    </div>
  );
}

export default function AdvancedTutorial({ 
  role, 
  isOpen, 
  onComplete, 
  onSkip 
}) {
  const [currentStep, setCurrentStep] = useState(0);
  const [isVisible, setIsVisible] = useState(isOpen);
  const steps = TUTORIAL_STEPS[role] || TUTORIAL_STEPS.attendee;

  useEffect(() => {
    setIsVisible(isOpen);
    setCurrentStep(0);
  }, [isOpen]);

  const handleNext = () => {
    if (currentStep === steps.length - 1) {
      handleComplete();
    } else {
      setCurrentStep(currentStep + 1);
    }
  };

  const handlePrevious = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleComplete = () => {
    setIsVisible(false);
    localStorage.setItem(`tutorial_${role}_completed`, 'true');
    onComplete?.();
  };

  const handleSkip = () => {
    setIsVisible(false);
    localStorage.setItem(`tutorial_${role}_skipped`, 'true');
    onSkip?.();
  };

  const current = steps[currentStep];
  const isFirst = currentStep === 0;
  const isLast = currentStep === steps.length - 1;

  if (!isVisible || !current) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[200] pointer-events-none">
        {/* Backdrop overlay - slightly dimmed so nav links are still visible */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 bg-black/40 pointer-events-auto"
          onClick={handleSkip}
        />

        {/* Target Highlighter - renders on top of backdrop */}
        {current.target && (
          <TargetHighlighter target={current.target} />
        )}

        {/* Tutorial card - CENTERED */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-md pointer-events-auto"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="mx-4 bg-surface-bright rounded-xl border border-outline-variant shadow-2xl overflow-hidden">
            {/* Progress bar */}
            <div className="h-1 w-full bg-surface-container">
              <motion.div
                className="h-full bg-secondary"
                initial={{ width: 0 }}
                animate={{ width: `${((currentStep + 1) / steps.length) * 100}%` }}
                transition={{ duration: 0.3 }}
              />
            </div>

            {/* Content */}
            <div className="p-6">
              <div className="mb-4">
                <h3 className="text-headline-sm font-semibold text-on-surface">
                  {current.title}
                </h3>
                <p className="mt-2 text-body-sm text-on-surface-variant leading-relaxed">
                  {current.description}
                </p>
              </div>

              {/* Step indicator */}
              <div className="flex items-center justify-between">
                <div className="flex gap-1">
                  {steps.map((_, i) => (
                    <div
                      key={i}
                      className={cn(
                        "h-1.5 w-6 rounded-full transition-all duration-300",
                        i === currentStep ? "bg-secondary" : "bg-surface-container-high"
                      )}
                    />
                  ))}
                </div>
                <span className="font-mono text-label-sm text-on-surface-variant">
                  {currentStep + 1} / {steps.length}
                </span>
              </div>

              {/* Actions */}
              <div className="mt-6 flex items-center justify-between gap-3">
                <button
                  onClick={handleSkip}
                  className="btn-ghost btn-sm gap-1 text-on-surface-variant"
                >
                  <SkipForward size={14} /> Skip
                </button>

                <div className="flex items-center gap-2">
                  {!isFirst && (
                    <button
                      onClick={handlePrevious}
                      className="btn-ghost btn-sm gap-1"
                    >
                      <ChevronLeft size={14} /> Back
                    </button>
                  )}

                  <button
                    onClick={handleNext}
                    className="btn-secondary btn-sm gap-1"
                  >
                    {isLast ? (
                      <>
                        <Check size={14} /> Done
                      </>
                    ) : (
                      <>
                        Next <ChevronRight size={14} />
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>

            {/* Close button - top right */}
            <button
              onClick={handleSkip}
              className="absolute top-3 right-3 rounded p-1 text-on-surface-variant hover:bg-surface-container transition-colors"
            >
              <X size={16} />
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}