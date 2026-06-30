import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Send, AlertCircle, CheckCircle2, Loader2 } from "lucide-react";
import toast from "react-hot-toast";
import api from "@/utils/api";
import { cn } from "@/utils/cn";
import FeedbackStars from "./FeedbackStars";

export default function FeedbackForm({
  isOpen,
  onClose,
  sessionId,
  sessionTitle,
  existingFeedback = null,
  onSuccess = null,
}) {
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [status, setStatus] = useState(null);

  const isEditing = !!existingFeedback;

  // Load existing feedback data
  useEffect(() => {
    if (existingFeedback && isOpen) {
      setRating(existingFeedback.rating || 0);
      setComment(existingFeedback.comment || "");
      setIsAnonymous(existingFeedback.isAnonymous || false);
      setStatus(existingFeedback.status || null);

      // ✅ If feedback was rejected, clear the status so the form looks like a new submission
      if (existingFeedback.status === "rejected") {
        setStatus(null);
      }
    } else if (isOpen) {
      setRating(0);
      setComment("");
      setIsAnonymous(false);
      setStatus(null);
    }
  }, [existingFeedback, isOpen]);

  const handleSubmit = async () => {
    if (rating === 0) {
      setError("Please select a rating before submitting.");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      let response;

      // ✅ If existing feedback is rejected, create NEW feedback instead of editing
      if (isEditing && existingFeedback.status !== "rejected") {
        response = await api.put(`/feedback/${existingFeedback._id}`, {
          rating,
          comment: comment.trim() || null,
          isAnonymous,
        });
      } else {
        // Create new feedback (for rejected feedback or new submissions)
        response = await api.post(`/feedback/session/${sessionId}`, {
          rating,
          comment: comment.trim() || null,
          isAnonymous,
        });
      }

      toast.success(
        isEditing && existingFeedback.status !== "rejected"
          ? "Feedback updated! Awaiting re-approval."
          : "Feedback submitted! Awaiting admin approval.",
      );

      onSuccess?.(response.data.data);
      onClose();
    } catch (err) {
      const errorMessage =
        err.response?.data?.message ||
        "Failed to submit feedback. Please try again.";
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  const getStatusMessage = () => {
    if (!status) return null;
    switch (status) {
      case "pending":
        return {
          icon: AlertCircle,
          text: "This feedback is pending admin review.",
          className: "text-warning bg-warning-container/20",
        };
      case "approved":
        return {
          icon: CheckCircle2,
          text: "This feedback has been approved and is visible.",
          className: "text-success bg-success-container/20",
        };
      case "rejected":
        return {
          icon: X,
          text: "This feedback was rejected.",
          className: "text-error bg-error-container/20",
        };
      default:
        return null;
    }
  };

  const statusInfo = getStatusMessage();
  const StatusIcon = statusInfo?.icon;

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[100] bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      />

      <div className="fixed inset-0 z-[101] flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="w-full max-w-md rounded-xl border border-outline-variant bg-surface-bright shadow-xl overflow-hidden"
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-outline-variant p-4">
            <div>
              <h2 className="text-headline-sm font-semibold text-on-surface">
                {isEditing ? "Edit Feedback" : "Leave Feedback"}
              </h2>
              <p className="text-body-sm text-on-surface-variant">
                {sessionTitle}
              </p>
            </div>
            <button
              onClick={onClose}
              className="rounded p-1 text-on-surface-variant hover:bg-surface-container transition-colors"
            >
              <X size={18} />
            </button>
          </div>

          {/* Body */}
          <div className="p-4 space-y-4">
            {/* Status message */}
            {statusInfo && (
              <div
                className={cn(
                  "flex items-start gap-2 rounded-lg px-3 py-2",
                  statusInfo.className,
                )}
              >
                <StatusIcon size={16} className="shrink-0 mt-0.5" />
                <span className="text-body-sm">{statusInfo.text}</span>
              </div>
            )}

            {/* Rating */}
            <div className="space-y-1.5">
              <label className="text-body-sm font-medium text-on-surface">
                Rating <span className="text-error">*</span>
              </label>
              <div className="flex items-center gap-4">
                <FeedbackStars
                  rating={rating}
                  size="lg"
                  interactive={true}
                  onChange={setRating}
                />
                {rating > 0 && (
                  <span className="font-mono text-label-md text-secondary">
                    {rating}/5
                  </span>
                )}
              </div>
              {error && !rating && (
                <p className="text-label-sm text-error">{error}</p>
              )}
            </div>

            {/* Comment */}
            <div className="space-y-1.5">
              <label className="text-body-sm font-medium text-on-surface">
                Comment{" "}
                <span className="text-on-surface-variant">(optional)</span>
              </label>
              <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Share your experience with this session..."
                rows={4}
                maxLength={1000}
                className="input resize-none"
                disabled={status === "approved" && !isEditing}
              />
              <p className="text-label-sm text-on-surface-variant text-right">
                {comment.length}/1000
              </p>
            </div>

            {/* Anonymous */}
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="anonymous"
                checked={isAnonymous}
                onChange={(e) => setIsAnonymous(e.target.checked)}
                className="h-4 w-4 rounded border-outline-variant text-secondary focus:ring-secondary"
                disabled={status === "approved" && !isEditing}
              />
              <label
                htmlFor="anonymous"
                className="text-body-sm text-on-surface"
              >
                Post anonymously
              </label>
            </div>

            {/* Error */}
            {error && rating > 0 && (
              <div className="flex items-start gap-2 rounded-lg bg-error-container/20 px-3 py-2">
                <AlertCircle size={14} className="text-error shrink-0 mt-0.5" />
                <span className="text-body-sm text-on-error-container">
                  {error}
                </span>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex gap-2 border-t border-outline-variant p-4">
            <button
              onClick={onClose}
              disabled={isSubmitting}
              className="btn-ghost flex-1"
            >
              Cancel
            </button>

            <button
              onClick={handleSubmit}
              disabled={isSubmitting || rating === 0}
              className="btn-secondary flex-1 flex items-center justify-center gap-2"
            >
              {isSubmitting ? (
                <>
                  <Loader2 size={16} className="animate-spin-slow" />
                  {isEditing ? "Updating..." : "Submitting..."}
                </>
              ) : (
                <>
                  <Send size={16} />
                  {isEditing ? "Update Feedback" : "Submit Feedback"}
                </>
              )}
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
