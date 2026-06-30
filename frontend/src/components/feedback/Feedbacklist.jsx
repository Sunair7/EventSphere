import { useState } from "react";
import { motion } from "framer-motion";
import { MessageSquare, Star, AlertCircle } from "lucide-react";
import { cn } from "@/utils/cn";
import FeedbackCard from "./FeedbackCard";
import FeedbackStars from "./FeedbackStars";

export default function FeedbackList({
  feedback = [],
  stats = null,
  showActions = false,
  onEdit = null,
  onDelete = null,
  onApprove = null,
  onReject = null,
  isModerator = false,
  loading = false,
  emptyMessage = "No feedback yet.",
  className = "",
}) {
  const [sortBy, setSortBy] = useState("recent");

  const sortedFeedback = [...feedback].sort((a, b) => {
    if (sortBy === "recent") {
      return new Date(b.createdAt) - new Date(a.createdAt);
    }
    if (sortBy === "highest") {
      return b.rating - a.rating;
    }
    if (sortBy === "lowest") {
      return a.rating - b.rating;
    }
    return 0;
  });

  if (loading) {
    return (
      <div className={cn("space-y-3", className)}>
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="skeleton h-24 rounded-lg" />
        ))}
      </div>
    );
  }

  if (feedback.length === 0) {
    return (
      <div className="empty-state py-8">
        <MessageSquare size={24} className="text-on-surface-variant/40" />
        <p className="text-body-sm text-on-surface-variant mt-2">
          {emptyMessage}
        </p>
      </div>
    );
  }

  return (
    <div className={cn("space-y-4", className)}>
      {/* Stats */}
      {stats && (
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Star size={16} className="text-warning fill-warning" />
              <span className="font-mono text-headline-sm font-bold text-on-surface">
                {stats.average || 0}
              </span>
              <span className="text-body-sm text-on-surface-variant">
                ({stats.total || 0} reviews)
              </span>
            </div>
            <div className="flex items-center gap-1">
              {Array.from({ length: 5 }).map((_, i) => {
                const starCount = stats.distribution?.[i + 1] || 0;
                const percentage = stats.total > 0 ? (starCount / stats.total) * 100 : 0;
                return (
                  <div key={i} className="flex items-center gap-1">
                    <span className="font-mono text-label-sm text-on-surface-variant">
                      {i + 1}★
                    </span>
                    <div className="w-20 h-1.5 rounded-full bg-surface-container-high overflow-hidden">
                      <div
                        className="h-full rounded-full bg-warning"
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-label-sm text-on-surface-variant">Sort:</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="input py-1 px-2 text-label-sm w-auto"
            >
              <option value="recent">Most Recent</option>
              <option value="highest">Highest Rated</option>
              <option value="lowest">Lowest Rated</option>
            </select>
          </div>
        </div>
      )}

      {/* Feedback list */}
      <div className="space-y-3">
        {sortedFeedback.map((item, index) => (
          <FeedbackCard
            key={item._id || index}
            feedback={item}
            showActions={showActions}
            onEdit={onEdit}
            onDelete={onDelete}
            onApprove={onApprove}
            onReject={onReject}
            isModerator={isModerator}
          />
        ))}
      </div>
    </div>
  );
}