import { useRef, useEffect, useState } from 'react';
import { motion, useInView, useMotionValue, useTransform, animate } from 'framer-motion';

/**
 * Animated number counter that counts up when scrolled into view.
 * 
 * @param {number} end - The final value to count to
 * @param {number} duration - Animation duration in seconds (default: 2)
 * @param {string} prefix - String to prepend (e.g., "$", "≈")
 * @param {string} suffix - String to append (e.g., "%", "+", "k")
 * @param {string} className - Additional CSS classes
 */
export default function AnimatedCounter({ 
  end = 0, 
  duration = 2, 
  prefix = '', 
  suffix = '', 
  className = '' 
}) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: '-50px' });
  const count = useMotionValue(0);
  const rounded = useTransform(count, latest => Math.round(latest));
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    if (inView && end > 0) {
      const controls = animate(count, end, { 
        duration, 
        ease: [0.25, 0.46, 0.45, 0.94] 
      });
      return controls.stop;
    }
  }, [inView, end, duration, count]);

  useEffect(() => {
    const unsubscribe = rounded.onChange(v => setDisplay(v));
    return unsubscribe;
  }, [rounded]);

  // Format large numbers with commas
  const formatted = display.toLocaleString();

  return (
    <motion.span
      ref={ref}
      className={className}
      initial={{ opacity: 0 }}
      animate={inView ? { opacity: 1 } : { opacity: 0 }}
      transition={{ duration: 0.3 }}
    >
      {prefix}{formatted}{suffix}
    </motion.span>
  );
}