import { useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import api from '@/utils/api';

export function useBooth() {
  const queryClient = useQueryClient();

  const cancelBoothReservation = useMutation({
    mutationFn: async (boothId) => {
      const { data } = await api.delete(`/booths/${boothId}/cancel`);
      return data.data;
    },
    onSuccess: () => {
      toast.success('Booth reservation cancelled successfully.');
      // Invalidate relevant queries
      queryClient.invalidateQueries({ queryKey: ['exhibitor', 'profile', 'me'] });
      queryClient.invalidateQueries({ queryKey: ['floor-plan'] });
    },
    onError: (error) => {
      toast.error(error.response?.data?.message || 'Failed to cancel reservation.');
    },
  });

  return {
    cancelBoothReservation,
  };
}