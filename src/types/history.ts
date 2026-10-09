import type { MatchRecord } from '../mocks/types';
export type { EndReason, MatchRecord } from '../mocks/types';
const LAST_MATCH_KEY = 'naval_arena_last_match';
export function saveLastMatch(record: MatchRecord): void {
  if (record.endReason !== 'abandoned') localStorage.setItem(LAST_MATCH_KEY, JSON.stringify(record));
}
export function getLastMatch(): MatchRecord | null {
  try { return JSON.parse(localStorage.getItem(LAST_MATCH_KEY) || 'null'); }
  catch { return null; }
}
export function getPlayerId(): string {
  let id = localStorage.getItem('naval_arena_player_id');
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem('naval_arena_player_id', id);
  }
  return id;
}
