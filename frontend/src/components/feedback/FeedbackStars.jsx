import { motion } from "framer-motion";
import { Star } from "lucide-react";
import { cn } from "@/utils/cn";

export default function FeedbackStars({
  rating = 0,
  maxRating = 5,
  size = "md",
  interactive = false,
  onChange = null,
  readonly = false,
  className = "",
}) {
  const sizeMap = {
    sm: "w-3 h-3",
    md: "w-5 h-5",
    lg: "w-7 h-7",
  };

  const iconSize = sizeMap[size] || sizeMap.md;

  const handleClick = (index) => {
    if (!interactive || readonly) return;
    const newRating = index + 1;
    onChange?.(newRating === rating ? 0 : newRating);
  };

  const handleHover = (index) => {
    if (!interactive || readonly) return;
    // Optional: hover effect
  };

  return (
    <div className={cn("flex items-center gap-0.5", className)}>
      {Array.from({ length: maxRating }).map((_, i) => {
        const isFilled = i < rating;
        return (
          <motion.button
            key={`star-${i}-${rating}`}
            type="button"
            whileHover={interactive && !readonly ? { scale: 1.15 } : {}}
            whileTap={interactive && !readonly ? { scale: 0.9 } : {}}
            onClick={() => handleClick(i)}
            onMouseEnter={() => handleHover(i)}
            className={cn(
              "rounded-sm p-0.5 transition-colors",
              interactive && !readonly && "cursor-pointer hover:bg-surface-container",
              !interactive && "cursor-default",
              readonly && "cursor-default"
            )}
            disabled={!interactive || readonly}
            aria-label={`Rate ${i + 1} stars out of ${maxRating}`}
          >
            <Star
              className={cn(
                iconSize,
                "transition-all duration-150",
                isFilled
                  ? "fill-warning text-warning"
                  : "fill-transparent text-outline-variant"
              )}
              strokeWidth={isFilled ? 2 : 1.5}
            />
          </motion.button>
        );
      })}
      {rating > 0 && (
        <span className="ml-1 font-mono text-label-sm text-on-surface-variant">
          {rating.toFixed(1)}
        </span>
      )}
    </div>
  );
}