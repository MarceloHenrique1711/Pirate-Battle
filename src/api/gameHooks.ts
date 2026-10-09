import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { GameApi } from './gameApi';
import { getConfigKey, loadGameConfig } from '../types/gameConfig';
import { getPlayerId } from '../types/history';
export function useRankingQuery(page: number) {
  const config = loadGameConfig();
  return useQuery({
    queryKey: ['ranking', getConfigKey(config), getPlayerId(), page],
    queryFn: ({ signal }) => GameApi.getRanking(page, 5, config, signal),
    staleTime: 30_000, refetchOnMount: 'always', refetchOnWindowFocus: true, retry: 2,
  });
}
export function useMatchHistoryQuery(page: number) {
  return useQuery({
    queryKey: ['matchHistory', getPlayerId(), page],
    queryFn: ({ signal }) => GameApi.getHistory(page, 5, signal),
    staleTime: 30_000, refetchOnMount: 'always', refetchOnWindowFocus: true, retry: 2,
  });
}
export function useSaveMatchMutation() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: GameApi.saveMatch, retry: 2,
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ['ranking'] });
      void client.invalidateQueries({ queryKey: ['matchHistory'] });
    },
  });
}
export function useSyncMatchesMutation() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: GameApi.syncPendingMatches,
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ['ranking'] });
      void client.invalidateQueries({ queryKey: ['matchHistory'] });
    },
  });
}
