import { clsx as clsxBase } from 'clsx';
import { twMerge }          from 'tailwind-merge';

/**
 * cn — Conflict-safe Tailwind class merger
 *
 * Combines clsx (conditional classes) with tailwind-merge (deduplication).
 * Ensures later classes override earlier ones when there are Tailwind conflicts,
 * e.g. cn('px-4', 'px-6') → 'px-6'  (not 'px-4 px-6')
 *
 * Usage:
 *   cn('base-class', condition && 'conditional-class', 'override-class')
 */
export function cn(...inputs) {
  return twMerge(clsxBase(inputs));
}

// Named re-export for components that import { clsx } directly
export { cn as clsx };

export default cn;