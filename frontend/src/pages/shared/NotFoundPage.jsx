import { useNavigate, useLocation } from 'react-router-dom';
import { motion }                   from 'framer-motion';
import { Home, ArrowLeft }          from 'lucide-react';
import { useAuth }                  from '@/context/AuthContext';
import { ROLE_HOME }                from '@/App';

export default function NotFoundPage() {
  const { isAuth, user } = useAuth();
  const navigate          = useNavigate();
  const location          = useLocation();

  const homeTarget = isAuth && user
    ? ROLE_HOME[user.role] || '/'
    : '/';

  return (
    <div className="flex min-h-[calc(100dvh-4rem)] flex-col items-center justify-center
                    px-4 py-20 text-center">
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0  }}
        transition={{ duration: 0.4, ease: [0.4, 0, 0.2, 1] }}
        className="flex flex-col items-center gap-6 max-w-md"
      >
        {/* Illustration */}
        <div className="relative">
          <div className="h-40 w-40 rounded-full bg-primary-container flex items-center justify-center">
            <span className="font-mono text-display-lg font-bold text-primary select-none">
              404
            </span>
          </div>
          {[
            { size: 'h-3 w-3', pos: '-top-2 right-6',    delay: 0    },
            { size: 'h-2 w-2', pos: 'top-4 -right-3',    delay: 0.15 },
            { size: 'h-2 w-2', pos: '-bottom-1 left-4',  delay: 0.3  },
            { size: 'h-3 w-3', pos: 'bottom-6 -left-4',  delay: 0.1  },
          ].map(({ size, pos, delay }, i) => (
            <motion.span
              key={i}
              className={`absolute ${size} ${pos} rounded-full bg-secondary/30`}
              animate={{ scale: [1, 1.3, 1], opacity: [0.5, 1, 0.5] }}
              transition={{ repeat: Infinity, duration: 2, delay, ease: 'easeInOut' }}
            />
          ))}
        </div>

        {/* Copy */}
        <div className="flex flex-col gap-2">
          <h1 className="text-headline-lg font-semibold text-on-surface">
            Page not found
          </h1>
          <p className="text-body-md text-on-surface-variant">
            The page you're looking for doesn't exist or has been moved.
          </p>
          {location.pathname !== '/' && (
            <p className="font-mono text-label-sm text-on-surface-variant/60 mt-1 break-all">
              {location.pathname}
            </p>
          )}
        </div>

        {/* Actions */}
        <div className="flex flex-col items-center gap-3 sm:flex-row">
          <button onClick={() => navigate(-1)} className="btn-ghost gap-2">
            <ArrowLeft size={15} /> Go back
          </button>
          <button
            onClick={() => navigate(homeTarget, { replace: true })}
            className="btn-secondary gap-2"
          >
            <Home size={15} />
            {isAuth ? 'Go to Dashboard' : 'Go to Home'}
          </button>
        </div>
      </motion.div>
    </div>
  );
}