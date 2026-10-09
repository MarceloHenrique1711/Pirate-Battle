import { DEFAULT_GAME_CONFIG } from '../types/gameConfig';
import type { MatchRecord } from './types';
export const fixtures: MatchRecord[] = Array.from({ length: 12 }, (_, index) => ({
  id: `fixture-match-${index}`, playerId: `fixture-player-${index}`,
  playerName: ['Blackbeard', 'Captain Hook', 'Anne Bonny', 'Mary Read'][index % 4] + (index < 4 ? '' : ` ${index}`),
  date: new Date(Date.UTC(2026, 0, index + 1, 12)).toISOString(),
  score: 15 - index, duration: DEFAULT_GAME_CONFIG.gameSessionTime,
  endReason: 'time_up', config: structuredClone(DEFAULT_GAME_CONFIG),
}));
