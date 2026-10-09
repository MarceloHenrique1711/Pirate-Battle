import { describe, it, expect, beforeAll, beforeEach, afterEach, afterAll } from 'vitest';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { handlers } from '../../mocks/handlers';
import { GameApi, getPendingMatches } from '../gameApi';
import { DEFAULT_GAME_CONFIG } from '../../types/gameConfig';
import { getPlayerId } from '../../types/history';
import type { MatchRecord } from '../../mocks/types';
const server = setupServer(...handlers);
beforeAll(() => server.listen({ onUnhandledFrame: 'error' }));
afterAll(() => server.close());
afterEach(() => server.resetHandlers());
beforeEach(() => { localStorage.clear(); localStorage.setItem('msw_latency', '0'); });
function match(id: string, score = 2): MatchRecord {
  return { id, playerId: getPlayerId(), playerName: 'Test Captain',
    date: '2026-01-01T12:00:00.000Z', score, duration: 80, endReason: 'player_destroyed',
    config: structuredClone(DEFAULT_GAME_CONFIG) };
}
describe('Match API', () => {
  it.each([null, [], { items: [] }, { data: [] }])('rejects malformed history responses: %j', async (body) => {
    server.use(http.get('/api/history', () => HttpResponse.json(body)));
    await expect(GameApi.getHistory()).rejects.toThrow('Invalid paginated response');
  });
  it('rejects malformed ranking responses', async () => {
    server.use(http.get('/api/ranking', () => HttpResponse.json({ message: 'Unexpected response' })));
    await expect(GameApi.getRanking(1, 5, DEFAULT_GAME_CONFIG)).rejects.toThrow('Invalid paginated response');
  });
  it('stores one match for repeated submissions and returns the existing record', async () => {
    const record = match('one');
    await GameApi.saveMatch(record);
    const existing = await GameApi.saveMatch({ ...record, score: 99 });
    expect(existing.score).toBe(2);
    expect((await GameApi.getHistory()).totalItems).toBe(1);
    expect(getPendingMatches()).toHaveLength(0);
    const ranking = await GameApi.getRanking(1, 50, DEFAULT_GAME_CONFIG);
    expect(ranking.data.filter(row => row.id === 'one')).toHaveLength(1);
  });
  it('keeps failed submissions pending and recovers without losing another match', async () => {
    localStorage.setItem('msw_scenario', 'UNAVAILABLE_AT_FINISH');
    await expect(GameApi.saveMatch(match('first'))).rejects.toThrow();
    await expect(GameApi.saveMatch(match('second'))).rejects.toThrow();
    expect(getPendingMatches()).toHaveLength(2);
    localStorage.setItem('msw_scenario', 'SUCCESS');
    await GameApi.syncPendingMatches();
    expect(getPendingMatches()).toHaveLength(0);
    expect((await GameApi.getHistory()).totalItems).toBe(2);
  });
  it('filters history by player and ranking by complete configuration', async () => {
    await GameApi.saveMatch(match('mine'));
    await GameApi.saveMatch({ ...match('another'), playerId: 'different-player' });
    const alternate = { ...DEFAULT_GAME_CONFIG, gameSessionTime: 60 };
    await GameApi.saveMatch({ ...match('alternate'), config: alternate });
    expect((await GameApi.getHistory()).data.map(row => row.id)).not.toContain('another');
    const ranking = await GameApi.getRanking(1, 50, alternate);
    expect(ranking.data.map(row => row.id)).toEqual(['alternate']);
  });
  it('sorts before paginating and uses deterministic ID ties', async () => {
    await GameApi.saveMatch(match('z', 100));
    await GameApi.saveMatch(match('a', 100));
    const first = await GameApi.getRanking(1, 1, DEFAULT_GAME_CONFIG);
    const second = await GameApi.getRanking(2, 1, DEFAULT_GAME_CONFIG);
    expect(first.data[0].id).toBe('a');
    expect(second.data[0].id).toBe('z');
    expect(second.data[0].rank).toBe(2);
  });
});
