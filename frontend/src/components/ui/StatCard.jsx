import { motion } from 'framer-motion';
import AnimatedCounter from './AnimatedCounter';
import { cn } from '@/utils/cn';

/**
 * Dashboard statistic card with animated counter and icon.
 */
export default function StatCard({ 
  icon: Icon, 
  label, 
  value, 
  prefix = '', 
  suffix = '', 
  trend, 
  trendUp = true,
  color = 'bg-secondary-container text-on-secondary-container',
  className = ''
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      whileHover={{ y: -2, transition: { duration: 0.15 } }}
      className={cn(
        'card flex flex-col gap-3 transition-shadow duration-200 hover:shadow-level-2',
        className
      )}
    >
      {/* Icon + Trend */}
      <div className="flex items-start justify-between">
        <div className={cn(
          'flex h-10 w-10 items-center justify-center rounded-lg',
          color
        )}>
          <Icon size={18} />
        </div>
        
        {trend !== undefined && (
          <span className={cn(
            'badge font-mono text-label-sm',
            trendUp ? 'badge-success' : 'badge-error'
          )}>
            {trendUp ? '↑' : '↓'} {Math.abs(trend)}%
          </span>
        )}
      </div>

      {/* Value */}
      <div>
        <AnimatedCounter
          end={value}
          prefix={prefix}
          suffix={suffix}
          className="font-mono text-headline-md font-bold text-on-surface"
        />
        <p className="mt-0.5 text-body-sm text-on-surface-variant">
          {label}
        </p>
      </div>
    </motion.div>
  );
}