import { expect, type Page } from '@playwright/test';
import { DEFAULT_GAME_CONFIG } from '../src/types/gameConfig';
import type { TestSetup, GameSnapshot } from '../src/game/testSupport';
import type { MatchRecord } from '../src/mocks/types';

export function quietConfig() {
  const config = structuredClone(DEFAULT_GAME_CONFIG);
  config.spawn.minDistance = 5000; // No valid scheduled spawn; rules still run.
  return config;
}
export async function isolate(page: Page, setup: Partial<TestSetup> = {}) {
  await page.addInitScript(({ setup }) => {
    // Clear once per test, preserving data during that test's reloads.
    if (!sessionStorage.getItem('e2e-isolated')) {
      localStorage.clear(); sessionStorage.setItem('e2e-isolated', 'yes');
      localStorage.setItem('naval_arena_player_id', 'e2e-player');
      localStorage.setItem('naval_arena_player_name', 'Test Captain');
      localStorage.setItem('msw_latency', '0');
    }
    window.__pirateSetup = setup;
  }, { setup: { seed: 42, ...setup } });
}
export async function start(page: Page, setup: Partial<TestSetup> = {}) {
  await isolate(page, setup);
  await page.goto('/arena');
  await expect(page.getByRole('button', { name: 'Pause game', exact: true })).toBeVisible();
  await expect.poll(() => page.evaluate(() => !!window.__pirateTest)).toBe(true);
  await page.locator('.arena-canvas').focus();
}
export async function state(page: Page): Promise<GameSnapshot> {
  return page.evaluate(() => window.__pirateTest!.read());
}
export async function advance(page: Page, milliseconds: number) {
  await page.evaluate(ms => window.__pirateTest!.advance(ms), milliseconds);
}
export async function hold(page: Page, keys: string[], milliseconds: number) {
  for (const key of keys) await page.keyboard.down(key);
  await advance(page, milliseconds);
  for (const key of keys) await page.keyboard.up(key);
}
export async function scenario(page: Page, value: string, latency = '0') {
  await page.evaluate(({ value, latency }) => {
    localStorage.setItem('msw_scenario', value); localStorage.setItem('msw_latency', latency);
  }, { value, latency });
}
export async function records(page: Page): Promise<MatchRecord[]> {
  return page.evaluate(() => JSON.parse(localStorage.getItem('msw_database') || '[]'));
}
export async function pending(page: Page): Promise<MatchRecord[]> {
  return page.evaluate(() => JSON.parse(localStorage.getItem('naval_arena_pending_sync') || '[]'));
}
export async function finish(page: Page) {
  await advance(page, 91000);
  await expect(page.getByRole('heading', { name: 'BATTLE COMPLETE' })).toBeVisible();
}
export async function mainMenu(page: Page) {
  await page.getByRole('button', { name: 'MAIN MENU', exact: true }).click();
}
