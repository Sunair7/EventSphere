import { useState } from "react";
import { motion } from "framer-motion";
import { User, Clock, Flag, Trash2, Edit, Check, X } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { cn } from "@/utils/cn";
import FeedbackStars from "./FeedbackStars";

export default function FeedbackCard({
  feedback,
  showActions = false,
  onEdit = null,
  onDelete = null,
  onFlag = null,
  isModerator = false,
  onApprove = null,
  onReject = null,
  compact = false,
}) {
  const [isExpanded, setIsExpanded] = useState(false);

  const { 
    rating, 
    comment, 
    isAnonymous, 
    userId, 
    createdAt, 
    status,
    isEdited,
    editedAt,
  } = feedback;

  const displayName = isAnonymous ? "Anonymous" : userId?.name || "Unknown User";
  const userAvatar = isAnonymous ? null : userId?.avatar;

  const getStatusBadge = () => {
    switch (status) {
      case "pending":
        return (
          <span className="badge badge-warning text-label-sm">
            Pending Review
          </span>
        );
      case "rejected":
        return (
          <span className="badge badge-error text-label-sm">
            Rejected
          </span>
        );
      default:
        return null;
    }
  };

  const StatusBadge = getStatusBadge();

  if (compact) {
    return (
      <div className="flex items-start gap-3 rounded-lg border border-outline-variant bg-surface-bright px-3 py-2">
        <FeedbackStars rating={rating} size="sm" readonly />
        <p className="text-body-sm text-on-surface line-clamp-1 flex-1">
          {comment || "No comment provided."}
        </p>
        {StatusBadge}
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        "rounded-lg border border-outline-variant bg-surface-bright p-4 transition-all",
        status === "pending" && "border-warning/30 bg-warning-container/5",
        status === "rejected" && "border-error/30 bg-error-container/5 opacity-60"
      )}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          {/* Avatar */}
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary-container font-mono text-label-sm font-semibold text-on-primary-container">
            {userAvatar ? (
              <img
                src={userAvatar}
                alt={displayName}
                className="h-full w-full rounded-full object-cover"
              />
            ) : (
              displayName.charAt(0).toUpperCase()
            )}
          </div>

          <div className="min-w-0">
            <p className="text-body-sm font-medium text-on-surface truncate">
              {displayName}
            </p>
            <div className="flex items-center gap-2">
              <FeedbackStars rating={rating} size="sm" readonly />
              <span className="font-mono text-label-sm text-secondary">
                {rating}/5
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {StatusBadge}
          {isEdited && (
            <span className="font-mono text-label-sm text-on-surface-variant">
              (edited)
            </span>
          )}
        </div>
      </div>

      {/* Comment */}
      {comment && (
        <p
          className={cn(
            "mt-2 text-body-sm text-on-surface leading-relaxed",
            !isExpanded && "line-clamp-2"
          )}
        >
          {comment}
        </p>
      )}

      {comment && comment.length > 120 && (
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="mt-1 font-mono text-label-sm text-tertiary hover:text-secondary transition-colors"
        >
          {isExpanded ? "Show less" : "Show more"}
        </button>
      )}

      {/* Footer */}
      <div className="mt-3 flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-3">
          <span className="font-mono text-label-sm text-on-surface-variant flex items-center gap-1">
            <Clock size={12} />
            {formatDistanceToNow(new Date(createdAt), { addSuffix: true })}
          </span>
          {isEdited && editedAt && (
            <span className="font-mono text-label-sm text-on-surface-variant">
              Edited {formatDistanceToNow(new Date(editedAt), { addSuffix: true })}
            </span>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1">
          {showActions && onEdit && status !== "rejected" && (
            <button
              onClick={() => onEdit(feedback)}
              className="rounded p-1 text-on-surface-variant hover:bg-surface-container hover:text-secondary transition-colors"
              title="Edit feedback"
            >
              <Edit size={14} />
            </button>
          )}

          {showActions && onDelete && (
            <button
              onClick={() => onDelete(feedback._id)}
              className="rounded p-1 text-on-surface-variant hover:bg-error-container/50 hover:text-error transition-colors"
              title="Delete feedback"
            >
              <Trash2 size={14} />
            </button>
          )}

          {isModerator && (
            <>
              {status === "pending" && onApprove && onReject && (
                <div className="flex items-center gap-1 ml-2">
                  <button
                    onClick={() => onApprove(feedback._id)}
                    className="rounded p-1 text-success hover:bg-success-container/30 transition-colors"
                    title="Approve feedback"
                  >
                    <Check size={14} />
                  </button>
                  <button
                    onClick={() => onReject(feedback._id)}
                    className="rounded p-1 text-error hover:bg-error-container/30 transition-colors"
                    title="Reject feedback"
                  >
                    <X size={14} />
                  </button>
                </div>
              )}

              {onFlag && (
                <button
                  onClick={() => onFlag(feedback._id)}
                  className="rounded p-1 text-on-surface-variant hover:bg-warning-container/30 hover:text-warning transition-colors"
                  title="Flag feedback"
                >
                  <Flag size={14} />
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </motion.div>
  );
}