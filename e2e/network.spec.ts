import { test, expect } from './fixtures';
import { finish, isolate, mainMenu, pending, quietConfig, records, scenario, start } from './helpers';
import { DEFAULT_GAME_CONFIG } from '../src/types/gameConfig';
import type { MatchRecord } from '../src/mocks/types';

function historyFixtures(): MatchRecord[] {
  return Array.from({ length: 7 }, (_, index) => ({
    id: `history-${index}`, playerId: 'e2e-player', playerName: 'Test Captain',
    date: new Date(Date.UTC(2026, 0, index + 1, 12)).toISOString(), score: index,
    duration: 90, endReason: 'time_up', config: structuredClone(DEFAULT_GAME_CONFIG),
  }));
}

test('ranking and history load through MSW and paginate', async ({ page }) => {
  await isolate(page); await page.goto('/'); await scenario(page, 'SUCCESS', '500');
  await page.getByRole('button', { name: 'RANKING', exact: true }).click();
  await expect(page.getByText('Loading rankings...', { exact: true })).toBeVisible();
  await expect(page.getByText('Blackbeard', { exact: true })).toBeVisible();
  await expect(page.getByText('PAGE 1 OF 3')).toBeVisible();
  await page.getByRole('button', { name: 'Next page' }).click();
  await expect(page.getByText('Captain Hook 5', { exact: true })).toBeVisible();
  await expect(page.getByText('Blackbeard', { exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Previous page' }).click();
  await expect(page.getByText('Blackbeard', { exact: true })).toBeVisible();
  await page.evaluate(items => localStorage.setItem('msw_database', JSON.stringify(items)), historyFixtures());
  await page.getByRole('button', { name: 'MATCH HISTORY', exact: true }).click();
  await expect(page.getByText('Loading match history...', { exact: true })).toBeVisible();
  await expect(page.getByText('PAGE 1 OF 2')).toBeVisible();
  await expect(page.locator('.history-table tbody tr')).toHaveCount(5);
  await page.getByRole('button', { name: 'Next page' }).click();
  await expect(page.locator('.history-table tbody tr')).toHaveCount(2);
  await expect(page.getByText('PAGE 2 OF 2')).toBeVisible();
});

for (const resource of ['ranking', 'history'] as const) {
  test(`${resource} handles empty, error and explicit recovery`, async ({ page }) => {
    await isolate(page); await page.goto('/'); await scenario(page, 'EMPTY');
    await page.goto(`/${resource}`);
    await expect(page.getByText(resource === 'ranking' ? 'No rankings found. Play a game first!' : 'No match history found. Play a game first!')).toBeVisible();
    await scenario(page, resource === 'ranking' ? 'RANKING_ERROR' : 'HISTORY_ERROR');
    await page.reload();
    await expect(page.getByRole('alert')).toContainText('Failed to load');
    await scenario(page, 'SUCCESS');
    await page.getByRole('button', { name: 'Try again' }).click();
    await expect(page.getByRole('alert')).toHaveCount(0);
    if (resource === 'ranking') await expect(page.getByText('Blackbeard', { exact: true })).toBeVisible();
    else await expect(page.getByText('No match history found. Play a game first!')).toBeVisible();
  });
}

test('completed registration updates cached history and ranking', async ({ page }) => {
  await isolate(page, { config: quietConfig() }); await page.goto('/');
  await page.getByRole('button', { name: 'RANKING', exact: true }).click();
  await expect(page.getByText('No rankings found. Play a game first!')).toBeVisible();
  await page.getByRole('button', { name: 'MATCH HISTORY', exact: true }).click();
  await expect(page.getByText('No match history found. Play a game first!')).toBeVisible();
  await mainMenu(page); await page.getByRole('button', { name: 'PLAY', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Pause game' })).toBeVisible();
  await finish(page); await expect(page.getByText('Match registered.', { exact: true })).toBeVisible();
  expect((await records(page)).filter(row => row.playerId === 'e2e-player')).toHaveLength(1);
  await mainMenu(page); await page.getByRole('button', { name: 'RANKING', exact: true }).click();
  await expect(page.getByText('Test Captain', { exact: false }).first()).toBeVisible();
  await expect(page.locator('.ranking-table tbody tr')).toHaveCount(1);
  await page.getByRole('button', { name: 'MATCH HISTORY', exact: true }).click();
  await expect(page.locator('.result-time-up')).toHaveCount(1);
});

test('pending submission survives refresh, allows another game and recovers', async ({ page }) => {
  await start(page, { config: quietConfig() }); await scenario(page, 'UNAVAILABLE_AT_FINISH');
  await finish(page); await expect(page.getByText('Match pending. Saved locally.')).toBeVisible();
  expect(await pending(page)).toHaveLength(1);
  await page.reload(); await expect(page.getByRole('heading', { name: 'BATTLE COMPLETE' })).toBeVisible();
  expect(await pending(page)).toHaveLength(1);
  await page.getByRole('button', { name: 'PLAY AGAIN' }).click();
  await expect(page.getByRole('button', { name: 'Pause game' })).toBeVisible();
  await page.getByRole('button', { name: 'Pause game' }).click(); await mainMenu(page);
  await page.goto('/result'); await scenario(page, 'SUCCESS');
  await page.getByRole('button', { name: 'Retry registration' }).click();
  await expect.poll(() => pending(page)).toHaveLength(0);
  expect((await records(page)).filter(row => row.playerId === 'e2e-player')).toHaveLength(1);
  await mainMenu(page); await page.getByRole('button', { name: 'MATCH HISTORY', exact: true }).click();
  await expect(page.locator('.result-time-up')).toHaveCount(1);
});

test('timeout after commit really times out; retry and repeated requests never duplicate', async ({ page }) => {
  const posts: number[] = [];
  page.on('request', request => { if (request.method() === 'POST' && request.url().includes('/api/matches')) posts.push(Date.now()); });
  await start(page, { config: quietConfig() }); await scenario(page, 'TIMEOUT_AFTER_COMMIT');
  await finish(page);
  await expect.poll(() => records(page).then(rows => rows.filter(row => row.playerId === 'e2e-player').length)).toBe(1);
  expect(await pending(page)).toHaveLength(1);
  await expect.poll(() => posts.length, { timeout: 15000 }).toBeGreaterThan(1);
  expect(posts[1] - posts[0]).toBeGreaterThanOrEqual(4900);
  await expect.poll(() => pending(page)).toHaveLength(0);
  await page.reload(); await expect(page.getByText('Match registered.', { exact: true })).toBeVisible();
  // Resend the same confirmed ID through Axios + TanStack's public retry workflow.
  const confirmed = (await records(page)).find(row => row.playerId === 'e2e-player')!;
  await page.evaluate(record => localStorage.setItem('naval_arena_pending_sync', JSON.stringify([record])), confirmed);
  await page.reload();
  await expect.poll(() => pending(page)).toHaveLength(0);
  expect((await records(page)).filter(row => row.id === confirmed.id)).toHaveLength(1);
  await mainMenu(page); await page.getByRole('button', { name: 'RANKING', exact: true }).click();
  await expect(page.locator('.ranking-table tbody tr')).toHaveCount(1);
  await page.getByRole('button', { name: 'MATCH HISTORY', exact: true }).click();
  await expect(page.locator('.result-time-up')).toHaveCount(1);
});

test('late page-one response cannot replace newer page-two data', async ({ page }) => {
  await isolate(page); await page.goto('/ranking');
  await expect(page.getByText('Blackbeard', { exact: true })).toBeVisible();
  await mainMenu(page); await scenario(page, 'OUT_OF_ORDER', '1200');
  const isOldPage = (url: string) => new URL(url).pathname === '/api/ranking' && new URL(url).searchParams.get('page') === '1';
  const oldRequestSettled = Promise.race([
    page.waitForResponse(response => isOldPage(response.url())),
    page.waitForEvent('requestfailed', request => isOldPage(request.url())),
  ]);
  await page.getByRole('button', { name: 'RANKING', exact: true }).click();
  await expect(page.getByText('Updating...', { exact: true })).toBeVisible();
  await scenario(page, 'OUT_OF_ORDER', '50');
  await page.getByRole('button', { name: 'Next page' }).click();
  await expect(page.getByText('Captain Hook 5', { exact: true })).toBeVisible();
  await oldRequestSettled;
  await expect(page.getByText('PAGE 2 OF 3')).toBeVisible();
  await expect(page.getByText('Blackbeard', { exact: true })).toHaveCount(0);
  await expect(page.getByText('Captain Hook 5', { exact: true })).toBeVisible();
});
