import type { GameConfig } from '../types/gameConfig';
export type GameConfigSnapshot = GameConfig;
export type EndReason = 'time_up' | 'player_destroyed' | 'abandoned';
export interface MatchRecord {
  id: string;
  playerId: string;
  playerName: string;
  date: string; // ISO 8601, never a display-formatted date.
  score: number;
  duration: number; // Active seconds, excluding pauses.
  endReason: EndReason;
  config: GameConfigSnapshot;
}
export interface RankingRecord extends MatchRecord { rank: number; isUser: boolean }
export interface PaginatedResponse<T> { data: T[]; page: number; totalPages: number; totalItems: number }
export const NETWORK_SCENARIOS = [
  'SUCCESS', 'EMPTY', 'SLOW', 'VARIABLE_LATENCY', 'OUT_OF_ORDER', 'TIMEOUT',
  'SERVER_ERROR', 'CLIENT_ERROR', 'NETWORK_ERROR', 'RANKING_ERROR', 'HISTORY_ERROR',
  'TIMEOUT_AFTER_COMMIT', 'UNAVAILABLE_AT_FINISH',
] as const;
export type NetworkScenario = typeof NETWORK_SCENARIOS[number];
