import axios from 'axios';
import type { MatchRecord, RankingRecord, PaginatedResponse } from '../mocks/types';
import { getConfigKey, type GameConfig } from '../types/gameConfig';
import { getPlayerId } from '../types/history';
export const api = axios.create({ baseURL: '/api', timeout: 5000 });
const PENDING_QUEUE_KEY = 'naval_arena_pending_sync';
// TypeScript types do not validate the JSON returned by the server.
function validatePagination<T>(response: PaginatedResponse<T>): PaginatedResponse<T> {
  if (!response || !Array.isArray(response.data)
    || !Number.isInteger(response.page) || response.page < 1
    || !Number.isInteger(response.totalPages) || response.totalPages < 1
    || !Number.isInteger(response.totalItems) || response.totalItems < 0) {
    throw new Error('Invalid paginated response from the server.');
  }
  return response;
}
export function getPendingMatches(): MatchRecord[] {
  try { return JSON.parse(localStorage.getItem(PENDING_QUEUE_KEY) || '[]'); }
  catch { return []; }
}
export function queueMatch(record: MatchRecord): void {
  if (record.endReason === 'abandoned') return;
  const queue = getPendingMatches();
  if (!queue.some(item => item.id === record.id)) {
    localStorage.setItem(PENDING_QUEUE_KEY, JSON.stringify([...queue, record]));
  }
}
function removePending(id: string): void {

  localStorage.setItem(PENDING_QUEUE_KEY, JSON.stringify(getPendingMatches().filter(item => item.id !== id)));
}
export const GameApi = {
  async getHistory(page = 1, limit = 5, signal?: AbortSignal): Promise<PaginatedResponse<MatchRecord>> {
    const response = await api.get<PaginatedResponse<MatchRecord>>('/history', {
      params: { page, limit, playerId: getPlayerId() }, signal,
    });
    return validatePagination(response.data);
  },
  async getRanking(page: number, limit: number, config: GameConfig, signal?: AbortSignal): Promise<PaginatedResponse<RankingRecord>> {
    const response = await api.get<PaginatedResponse<RankingRecord>>('/ranking', {
      params: { page, limit, configKey: getConfigKey(config), playerId: getPlayerId() }, signal,
    });
    return validatePagination(response.data);
  },
  async saveMatch(record: MatchRecord): Promise<MatchRecord> {
    if (record.endReason === 'abandoned') throw new Error('Abandoned matches cannot be registered.');
    queueMatch(record); // Persist BEFORE sending, including refresh while a request is in flight.
    const response = await api.post<MatchRecord>('/matches', record, {
      headers: { 'X-Idempotency-Key': record.id },
    });
    removePending(record.id);
    return response.data;
  },
  async syncPendingMatches(): Promise<void> {
    for (const record of getPendingMatches()) {
      try { await GameApi.saveMatch(record); }
      catch { /* Keep the fallback state. */ }
    }
  },
};
