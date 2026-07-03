import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import api from "@/utils/api";

const unwrapPaymentResponse = (response) => ({
  ...response.data.data,
  message: response.data.message,
});

export function usePayment() {
  const [transaction, setTransaction] = useState(null);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const queryClient = useQueryClient();

  // Create payment for booth
  const createBoothPayment = useMutation({
    mutationFn: async ({ boothId, paymentMethod = "mock" }) => {
      const response = await api.post("/payments/booth", {
        boothId,
        paymentMethod,
      });
      return unwrapPaymentResponse(response);
    },
    onSuccess: (data) => {
      if (data.alreadyAssigned) {
        toast.success(data.message || "You already have this booth.");
        queryClient.invalidateQueries({ queryKey: ["floor-plan"] });
        queryClient.invalidateQueries({
          queryKey: ["exhibitor", "profile", "me"],
        });
        return;
      }

      setTransaction(data.transaction);

      if (!data.requiresPayment) {
        toast.success(data.message || "Booth reserved successfully!");
        setShowPaymentModal(false);
        queryClient.invalidateQueries({ queryKey: ["floor-plan"] });
        queryClient.invalidateQueries({
          queryKey: ["exhibitor", "profile", "me"],
        });
        queryClient.invalidateQueries({ queryKey: ["transactions"] });
        return;
      }

      setShowPaymentModal(true);
    },
    onError: (error) => {
      toast.error(error.response?.data?.message || "Failed to create payment.");
    },
  });

  // Create payment for session
  const createSessionPayment = useMutation({
    mutationFn: async ({ sessionId, paymentMethod = "mock" }) => {
      const response = await api.post("/payments/session", {
        sessionId,
        paymentMethod,
      });
      return unwrapPaymentResponse(response);
    },
    onSuccess: (data) => {
      setTransaction(data.transaction);

      if (!data.requiresPayment) {
        toast.success(data.message || "Registered successfully!");
        setShowPaymentModal(false);
        queryClient.invalidateQueries({ queryKey: ["sessions"] });
        queryClient.invalidateQueries({ queryKey: ["transactions"] });
        return;
      }

      setShowPaymentModal(true);
    },
    onError: (error) => {
      toast.error(error.response?.data?.message || "Failed to create payment.");
    },
  });

  // Confirm payment
  const confirmPayment = useMutation({
    mutationFn: async ({ transactionId, paymentId }) => {
      const { data } = await api.post("/payments/confirm", {
        transactionId,
        paymentId,
      });
      return data.data;
    },


    onSuccess: () => {
      toast.success("Payment confirmed!");
      setShowPaymentModal(false);
      setTransaction(null);

      // Global refreshes
      queryClient.invalidateQueries({ queryKey: ["me", "payments", "pending"] });
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      queryClient.invalidateQueries({ queryKey: ["floor-plan"] });
      queryClient.invalidateQueries({
        queryKey: ["exhibitor", "profile", "me"],
      });
      queryClient.invalidateQueries({ queryKey: ["sessions"] });

      // ✅ Immediate refresh for AttendeeSessions registration/bookmark UI
      queryClient.invalidateQueries({
        queryKey: ["sessions", "me", "registrations"],
      });
      queryClient.invalidateQueries({
        queryKey: ["sessions", "me", "bookmarks"],
      });
    },
    onError: (error) => {
      toast.error(
        error.response?.data?.message || "Failed to confirm payment.",
      );
    },
  });

  // usePayment.js — cancelTransaction mutation
  const payLaterTransaction = useMutation({
    mutationFn: async (transactionId) => {
      const { data } = await api.post(`/payments/${transactionId}/pay-later`);
      return data;
    },

    onSuccess: () => {
      toast.success("You can complete payment later within the time window.");
      setShowPaymentModal(false);
      setTransaction(null);
      queryClient.invalidateQueries({ queryKey: ["me", "payments", "pending"] });
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      queryClient.invalidateQueries({ queryKey: ["floor-plan"] });
      queryClient.invalidateQueries({ queryKey: ["sessions"] });
    },
    onError: (error) => {
      toast.error(
        error.response?.data?.message || "Failed to set payment to pending later.",
      );
    },
  });

  // Get user's pending transactions (for pay-later confirm/selection)
  const useMyPendingTransactions = (options = {}) => {
    const { type } = options;

    return useQuery({
      queryKey: ['me', 'payments', 'pending', { type }],
      queryFn: async () => {
        const params = new URLSearchParams();
        if (type) params.set('type', type);
        const qs = params.toString();
        const endpoint = qs ? `/payments/me/pending?${qs}` : `/payments/me/pending`;
        const { data } = await api.get(endpoint);
        return data.data.transactions;
      },
      staleTime: 10 * 1000,
    });
  };

  const cancelTransaction = useMutation({
    mutationFn: async (transactionId) => {
      await api.delete(`/payments/${transactionId}`, {
        data: { reason: "User cancelled" },
      });
    },
    onSuccess: () => {
      toast.success("Reservation cancelled.");
      setShowPaymentModal(false);
      setTransaction(null);
      queryClient.invalidateQueries({ queryKey: ["me", "payments", "pending"] });
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      queryClient.invalidateQueries({ queryKey: ["floor-plan"] }); // ← was missing
      queryClient.invalidateQueries({
        queryKey: ["exhibitor", "profile", "me"],
      }); // ← add this too
      queryClient.invalidateQueries({ queryKey: ["sessions"] });
    },
    onError: (error) => {
      toast.error(error.response?.data?.message || "Failed to cancel.");
      // Still refresh the floor plan so UI is consistent
      queryClient.invalidateQueries({ queryKey: ["floor-plan"] });
    },
  });

  // Get transaction history
  const useTransactionHistory = (options = {}) => {
    const { page = 1, limit = 20, status, isAdmin = false } = options;

    return useQuery({
      queryKey: [
        "transactions",
        isAdmin ? "admin" : "history",
        { page, limit, status },
      ],
      queryFn: async () => {
        const params = new URLSearchParams({
          page: String(page),
          limit: String(limit),
        });
        if (status) params.set("status", status);

        const endpoint = isAdmin
          ? `/payments/admin/all?${params}`
          : `/payments/history?${params}`;
        const { data } = await api.get(endpoint);
        return data.data;
      },
      staleTime: 30 * 1000,
    });
  };

  return {
    transaction,
    showPaymentModal,
    setShowPaymentModal,
    setTransaction,
    createBoothPayment,
    createSessionPayment,
    confirmPayment,
    cancelTransaction,
    useTransactionHistory,
    payLaterTransaction,
    useMyPendingTransactions,
  };
}
