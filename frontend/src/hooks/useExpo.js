import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import api   from '@/utils/api';

// ─── Query Keys ───────────────────────────────────────────────────────────────
export const expoKeys = {
  all:      ['expos'],
  lists:    ()              => [...expoKeys.all, 'list'],
  list:     (params)        => [...expoKeys.lists(), params],
  detail:   (id)            => [...expoKeys.all, 'detail', id],
  slug:     (slug)          => [...expoKeys.all, 'slug', slug],
  stats:    (id)            => [...expoKeys.all, 'stats', id],
  upcoming: ()              => [...expoKeys.all, 'upcoming'],
};

// ─── useExpos (paginated list) ────────────────────────────────────────────────
export function useExpos(params = {}) {
  return useQuery({
    queryKey: expoKeys.list(params),
    queryFn:  async () => {
      const searchParams = new URLSearchParams();
      Object.entries(params).forEach(([k, v]) => {
        if (v !== undefined && v !== null && v !== '') searchParams.set(k, String(v));
      });
      const { data } = await api.get(`/expos?${searchParams}`);
      return data.data;
    },
    keepPreviousData: true,
    staleTime:        60 * 1000,
  });
}

// ─── useUpcomingExpos ─────────────────────────────────────────────────────────
export function useUpcomingExpos(limit = 6) {
  return useQuery({
    queryKey: expoKeys.upcoming(),
    queryFn:  async () => {
      const { data } = await api.get(`/expos/upcoming?limit=${limit}`);
      return data.data.expos;
    },
    staleTime: 5 * 60 * 1000,
  });
}

// ─── useExpo (single by ID) ───────────────────────────────────────────────────
export function useExpo(id, options = {}) {
  return useQuery({
    queryKey: expoKeys.detail(id),
    queryFn:  async () => {
      const { data } = await api.get(`/expos/${id}`);
      return data.data.expo;
    },
    enabled:   !!id,
    staleTime: 60 * 1000,
    ...options,
  });
}

// ─── useExpoBySlug ────────────────────────────────────────────────────────────
export function useExpoBySlug(slug, options = {}) {
  return useQuery({
    queryKey: expoKeys.slug(slug),
    queryFn:  async () => {
      const { data } = await api.get(`/expos/slug/${slug}`);
      return data.data.expo;
    },
    enabled:   !!slug,
    staleTime: 60 * 1000,
    ...options,
  });
}

// ─── useExpoStats ─────────────────────────────────────────────────────────────
export function useExpoStats(id, options = {}) {
  return useQuery({
    queryKey: expoKeys.stats(id),
    queryFn:  async () => {
      const { data } = await api.get(`/analytics/expo/${id}`);
      return data.data;
    },
    enabled:   !!id,
    staleTime: 2 * 60 * 1000,
    ...options,
  });
}

// ─── useCreateExpo ────────────────────────────────────────────────────────────
export function useCreateExpo(options = {}) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload) => {
      const { data } = await api.post('/expos', payload);
      return data.data.expo;
    },
    onSuccess: (expo) => {
      toast.success(`"${expo.title}" created successfully.`);
      queryClient.invalidateQueries({ queryKey: expoKeys.all });
      options.onSuccess?.(expo);
    },
    onError: (err) => {
      toast.error(err.message || 'Failed to create expo.');
      options.onError?.(err);
    },
  });
}

// ─── useUpdateExpo ────────────────────────────────────────────────────────────
export function useUpdateExpo(id, options = {}) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload) => {
      const { data } = await api.put(`/expos/${id}`, payload);
      return data.data.expo;
    },
    onSuccess: (expo) => {
      toast.success('Expo updated successfully.');
      queryClient.invalidateQueries({ queryKey: expoKeys.detail(id) });
      queryClient.invalidateQueries({ queryKey: expoKeys.lists() });
      options.onSuccess?.(expo);
    },
    onError: (err) => {
      toast.error(err.message || 'Failed to update expo.');
      options.onError?.(err);
    },
  });
}

// ─── useUpdateExpoStatus ──────────────────────────────────────────────────────
export function useUpdateExpoStatus(id, options = {}) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (status) => {
      const { data } = await api.patch(`/expos/${id}/status`, { status });
      return data.data.expo;
    },
    onSuccess: (expo) => {
      toast.success(`Expo ${expo.status}.`);
      queryClient.invalidateQueries({ queryKey: expoKeys.detail(id) });
      queryClient.invalidateQueries({ queryKey: expoKeys.lists() });
      options.onSuccess?.(expo);
    },
    onError: (err) => {
      toast.error(err.message || 'Failed to update expo status.');
      options.onError?.(err);
    },
  });
}

// ─── useDeleteExpo ────────────────────────────────────────────────────────────
export function useDeleteExpo(options = {}) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id) => {
      await api.delete(`/expos/${id}`);
      return id;
    },
    onSuccess: (id) => {
      toast.success('Expo deleted successfully.');
      queryClient.invalidateQueries({ queryKey: expoKeys.all });
      options.onSuccess?.(id);
    },
    onError: (err) => {
      toast.error(err.message || 'Failed to delete expo.');
      options.onError?.(err);
    },
  });
}