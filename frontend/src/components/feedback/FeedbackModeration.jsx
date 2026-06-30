import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  Search,
} from "lucide-react";
import toast from "react-hot-toast";
import api from "@/utils/api";
import { cn } from "@/utils/cn";
import FeedbackCard from "./FeedbackCard";

export default function FeedbackModeration() {
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState("pending");
  const [searchTerm, setSearchTerm] = useState("");
  const [page, setPage] = useState(1);
  
  // ✅ Keep previous stats to prevent flickering to 0
  const previousStatsRef = useRef({ pending: 0, approved: 0, rejected: 0, total: 0 });

  // ── Fetch feedback ──────────────────────────────────────────────────────────
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["feedback", "moderation", { statusFilter, page }],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: String(page),
        limit: "20",
      });
      
      if (statusFilter === "pending") {
        const { data } = await api.get(`/feedback/admin/pending?${params}`);
        return data.data;
      } else if (statusFilter === "all") {
        const { data } = await api.get(`/feedback/admin/all?${params}`);
        return data.data;
      } else {
        const { data } = await api.get(`/feedback/admin/all?${params}&status=${statusFilter}`);
        return data.data;
      }
    },
    staleTime: 30 * 1000,
    // ✅ Keep previous data while loading new data
    placeholderData: (previousData) => previousData,
  });

  const feedback = data?.feedback || [];
  const pagination = data?.pagination || {};
  
  // ✅ Use previous stats if current data doesn't have stats yet
  const rawStats = data?.stats;
  if (rawStats) {
    previousStatsRef.current = rawStats;
  }
  const stats = rawStats || previousStatsRef.current;

  // ── Approve mutation ────────────────────────────────────────────────────────
  const approveMutation = useMutation({
    mutationFn: (id) => api.patch(`/feedback/${id}/approve`),
    onSuccess: () => {
      toast.success("Feedback approved!");
      queryClient.invalidateQueries({ queryKey: ["feedback", "moderation"] });
    },
    onError: (err) => {
      toast.error(err.response?.data?.message || "Failed to approve.");
    },
  });

  // ── Reject mutation ────────────────────────────────────────────────────────
  const rejectMutation = useMutation({
    mutationFn: ({ id, reason }) =>
      api.patch(`/feedback/${id}/reject`, { rejectionReason: reason }),
    onSuccess: () => {
      toast.success("Feedback rejected.");
      queryClient.invalidateQueries({ queryKey: ["feedback", "moderation"] });
    },
    onError: (err) => {
      toast.error(err.response?.data?.message || "Failed to reject.");
    },
  });

  // ── Delete mutation ────────────────────────────────────────────────────────
  const deleteMutation = useMutation({
    mutationFn: (id) => api.delete(`/feedback/${id}`),
    onSuccess: () => {
      toast.success("Feedback deleted.");
      queryClient.invalidateQueries({ queryKey: ["feedback", "moderation"] });
    },
    onError: (err) => {
      toast.error(err.response?.data?.message || "Failed to delete.");
    },
  });

  const handleApprove = (id) => {
    approveMutation.mutate(id);
  };

  const handleReject = (id) => {
    const reason = prompt("Please provide a reason for rejection (optional):");
    rejectMutation.mutate({ id, reason: reason || null });
  };

  const handleDelete = (id) => {
    if (confirm("Are you sure you want to delete this feedback?")) {
      deleteMutation.mutate(id);
    }
  };

  // ── Filter by search term ──────────────────────────────────────────────────
  const filteredFeedback = feedback.filter((item) => {
    if (!searchTerm) return true;
    const search = searchTerm.toLowerCase();
    const comment = item.comment?.toLowerCase() || "";
    const userName = item.userId?.name?.toLowerCase() || "";
    const sessionTitle = item.sessionId?.title?.toLowerCase() || "";
    return (
      comment.includes(search) ||
      userName.includes(search) ||
      sessionTitle.includes(search)
    );
  });

  // ── Stats summary ──────────────────────────────────────────────────────────
  const filterTabs = [
    { value: "pending", label: "Pending", count: stats.pending || 0 },
    { value: "approved", label: "Approved", count: stats.approved || 0 },
    { value: "rejected", label: "Rejected", count: stats.rejected || 0 },
    { value: "all", label: "All", count: stats.total || 0 },
  ];

  if (isError) {
    return (
      <div className="empty-state py-12">
        <AlertCircle size={24} className="text-error" />
        <h3 className="empty-state-title">Failed to load feedback</h3>
        <button onClick={() => refetch()} className="btn-ghost btn-sm mt-2 gap-1.5">
          <RefreshCw size={13} /> Retry
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h2 className="text-headline-sm font-semibold text-on-surface flex items-center gap-2">
          <AlertCircle size={18} className="text-secondary" />
          Feedback Moderation
        </h2>
        <button onClick={() => refetch()} className="btn-ghost btn-sm gap-1.5">
          <RefreshCw
            size={13}
            className="transition-transform hover:rotate-180 duration-500"
          />
          Refresh
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1 rounded-lg border border-outline-variant bg-surface-bright p-0.5">
          {filterTabs.map((tab) => (
            <button
              key={tab.value}
              onClick={() => {
                setStatusFilter(tab.value);
                setPage(1);
              }}
              className={cn(
                "rounded-md px-3 py-1.5 text-label-sm font-medium transition-all duration-200",
                statusFilter === tab.value
                  ? "bg-primary text-on-primary shadow-sm"
                  : "text-on-surface-variant hover:bg-surface-container hover:text-on-surface",
              )}
            >
              {tab.label}
              <span className="ml-1.5 font-mono text-label-sm opacity-60">
                ({tab.count})
              </span>
            </button>
          ))}
        </div>

        <div className="relative flex-1 min-w-[200px]">
          <Search
            size={14}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant"
          />
          <input
            type="search"
            placeholder="Search feedback..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="input pl-9 py-1.5 text-body-sm w-full"
          />
        </div>
      </div>

      {/* Feedback list */}
      {isLoading && !data ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="skeleton h-24 rounded-lg" />
          ))}
        </div>
      ) : filteredFeedback.length === 0 ? (
        <div className="empty-state py-12">
          <CheckCircle2 size={24} className="text-success" />
          <h3 className="empty-state-title">All caught up!</h3>
          <p className="empty-state-body">
            {statusFilter === "pending"
              ? "No pending feedback to moderate."
              : `No ${statusFilter} feedback found.`}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredFeedback.map((item) => (
            <FeedbackCard
              key={item._id}
              feedback={item}
              isModerator={true}
              onApprove={handleApprove}
              onReject={handleReject}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}

      {/* Pagination */}
      {pagination.totalPages > 1 && (
        <div className="flex items-center justify-between mt-2">
          <p className="font-mono text-label-sm text-on-surface-variant">
            Page {pagination.page} of {pagination.totalPages} ·{" "}
            {pagination.total} items
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="btn-ghost btn-sm disabled:opacity-40"
            >
              Previous
            </button>
            <button
              onClick={() =>
                setPage((p) => Math.min(pagination.totalPages, p + 1))
              }
              disabled={page >= pagination.totalPages}
              className="btn-ghost btn-sm disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}