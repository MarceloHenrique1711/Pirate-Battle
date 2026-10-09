import { http, HttpResponse, delay } from 'msw';
import type { MatchRecord, NetworkScenario, PaginatedResponse, RankingRecord } from './types';
import { fixtures } from './fixtures';
import { getConfigKey } from '../types/gameConfig';
const DB_KEY = 'msw_database';
let requestCount = 0;
function getDb(): MatchRecord[] {
  try {
    const value = localStorage.getItem(DB_KEY);
    if (value) return JSON.parse(value);
  } catch { /* Keep the fallback state. */ }
  const data = structuredClone(fixtures);
  localStorage.setItem(DB_KEY, JSON.stringify(data));
  return data;
}
export function resetMockState(): void {
  localStorage.setItem(DB_KEY, JSON.stringify(fixtures));
  localStorage.setItem('msw_scenario', 'SUCCESS');
  requestCount = 0;
}
function scenario(): NetworkScenario {
  return (localStorage.getItem('msw_scenario') as NetworkScenario) || 'SUCCESS';
}
async function networkFailure(resource: 'ranking' | 'history' | 'matches') {
  const selected = scenario();
  const index = requestCount++;

  const override = localStorage.getItem('msw_latency');
  let milliseconds = 150;
  if (selected === 'SLOW') milliseconds = 3000;
  if (selected === 'VARIABLE_LATENCY') milliseconds = [100, 900, 300][index % 3];
  if (selected === 'OUT_OF_ORDER') milliseconds = index % 2 === 0 ? 1200 : 100;
  if (selected === 'TIMEOUT') milliseconds = 6000;
  if (override !== null) milliseconds = Number(override);
  await delay(Math.max(0, milliseconds));
  if (selected === 'NETWORK_ERROR') return HttpResponse.error();
  if (selected === 'CLIENT_ERROR') return HttpResponse.json({ message: 'Simulated bad request' }, { status: 400 });
  if (selected === 'SERVER_ERROR'
    || (selected === 'RANKING_ERROR' && resource === 'ranking')
    || (selected === 'HISTORY_ERROR' && resource === 'history')
    || (selected === 'UNAVAILABLE_AT_FINISH' && resource === 'matches')) {
    return HttpResponse.json({ message: 'Simulated service failure' }, { status: 503 });
  }
  return null;
}
function paginate<T>(data: T[], request: Request): PaginatedResponse<T> {
  const params = new URL(request.url).searchParams;
  const page = Math.max(1, Math.floor(Number(params.get('page')) || 1));
  const limit = Math.max(1, Math.min(50, Math.floor(Number(params.get('limit')) || 5)));
  return { data: data.slice((page - 1) * limit, page * limit), page,
    totalPages: Math.max(1, Math.ceil(data.length / limit)), totalItems: data.length };
}
export function compareMatches(a: MatchRecord, b: MatchRecord): number {
  return b.score - a.score || a.duration - b.duration || a.date.localeCompare(b.date) || a.id.localeCompare(b.id);
}
export const handlers = [
  http.get('/api/history', async ({ request }) => {
    const failure = await networkFailure('history');
    if (failure) return failure;
    const playerId = new URL(request.url).searchParams.get('playerId');
    const records = scenario() === 'EMPTY' ? [] : getDb().filter(item => item.playerId === playerId);
    records.sort((a, b) => b.date.localeCompare(a.date) || a.id.localeCompare(b.id));
    return HttpResponse.json(paginate(records, request));
  }),
  http.get('/api/ranking', async ({ request }) => {
    const failure = await networkFailure('ranking');
    if (failure) return failure;
    const params = new URL(request.url).searchParams;
    const records = scenario() === 'EMPTY' ? [] : getDb().filter(item => getConfigKey(item.config) === params.get('configKey'));

    const ranking: RankingRecord[] = records.sort(compareMatches).map((item, index) => ({
      ...item, rank: index + 1, isUser: item.playerId === params.get('playerId'),
    }));
    return HttpResponse.json(paginate(ranking, request));
  }),
  http.post('/api/matches', async ({ request }) => {
    const record = await request.json() as MatchRecord;
    if (!record || typeof record.id !== 'string' || typeof record.playerId !== 'string'
      || !record.playerName?.trim() || !Number.isFinite(record.score) || record.score < 0
      || !Number.isFinite(record.duration) || record.duration < 0
      || !['time_up', 'player_destroyed'].includes(record.endReason)
      || !record.config || record.config.gameSessionTime < 60 || record.config.gameSessionTime > 180
      || record.config.enemySpawnTime < 1 || record.config.enemySpawnTime > 10
      || !Number.isFinite(Date.parse(record.date)) || request.headers.get('X-Idempotency-Key') !== record.id) {
      return HttpResponse.json({ message: 'Invalid match record' }, { status: 400 });
    }
    const failure = await networkFailure('matches');
    if (failure) return failure;

    const db = getDb();
    const existing = db.find(item => item.id === record.id);
    if (existing) return HttpResponse.json(existing);
    db.push(record);
    localStorage.setItem(DB_KEY, JSON.stringify(db));
    if (scenario() === 'TIMEOUT_AFTER_COMMIT') await delay(6000);
    return HttpResponse.json(record, { status: 201 });
  }),
];
