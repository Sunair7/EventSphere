import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import api   from '@/utils/api';

// ─── Query Keys ───────────────────────────────────────────────────────────────
export const messageKeys = {
  all:          ['messages'],
  inbox:        ()         => [...messageKeys.all, 'inbox'],
  unreadCount:  ()         => [...messageKeys.all, 'unread-count'],
  conversation: (userId)   => [...messageKeys.all, 'conversation', userId],
};

// ─── useInbox ─────────────────────────────────────────────────────────────────
export function useInbox() {
  return useQuery({
    queryKey: messageKeys.inbox(),
    queryFn:  async () => {
      const { data } = await api.get('/messages/inbox');
      return data;
    },
    staleTime: 30 * 1000,
    refetchInterval: 60 * 1000,   // Refresh inbox every 60s as a background poll
  });
}

// ─── useUnreadCount ───────────────────────────────────────────────────────────
export function useUnreadCount() {
  return useQuery({
    queryKey: messageKeys.unreadCount(),
    queryFn:  async () => {
      const { data } = await api.get('/messages/unread-count');
      return data;
    },
    staleTime:       15 * 1000,
    refetchInterval: 30 * 1000,   // Poll every 30s for badge accuracy
  });
}

// ─── useConversation ──────────────────────────────────────────────────────────
export function useConversation(userId, options = {}) {
  return useQuery({
    queryKey: messageKeys.conversation(userId),
    queryFn:  async () => {
      const { data } = await api.get(`/messages/conversation/${userId}`);
      return data;
    },
    enabled:   !!userId,
    staleTime: 10 * 1000,
    ...options,
  });
}

// ─── useSendMessage ───────────────────────────────────────────────────────────
export function useSendMessage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload) => {
      const { data } = await api.post('/messages', payload);
      return data;
    },
    onSuccess: (_data, variables) => {
      // Invalidate the conversation and inbox cache
      queryClient.invalidateQueries({
        queryKey: messageKeys.conversation(variables.receiverId),
      });
      queryClient.invalidateQueries({ queryKey: messageKeys.inbox() });
      queryClient.invalidateQueries({ queryKey: messageKeys.unreadCount() });
    },
    onError: (err) => {
      toast.error(err.message || 'Failed to send message. Please try again.');
    },
  });
}

// ─── useMarkConversationRead ──────────────────────────────────────────────────
export function useMarkConversationRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (userId) => {
      const { data } = await api.patch(`/messages/conversation/${userId}/read`);
      return data;
    },
    onSuccess: (_data, userId) => {
      queryClient.invalidateQueries({ queryKey: messageKeys.unreadCount() });
      queryClient.invalidateQueries({ queryKey: messageKeys.inbox() });
      queryClient.invalidateQueries({ queryKey: messageKeys.conversation(userId) });
    },
  });
}

// ─── useDeleteMessage ─────────────────────────────────────────────────────────
export function useDeleteMessage(conversationUserId) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (messageId) => {
      const { data } = await api.delete(`/messages/${messageId}`);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: messageKeys.conversation(conversationUserId),
      });
      queryClient.invalidateQueries({ queryKey: messageKeys.inbox() });
      toast.success('Message deleted.');
    },
    onError: (err) => {
      toast.error(err.message || 'Failed to delete message.');
    },
  });
}