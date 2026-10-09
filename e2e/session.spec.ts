import { test, expect } from './fixtures';
import { advance, finish, hold, mainMenu, pending, quietConfig, records, start, state } from './helpers';

test('time expiry stops all systems, persists result on refresh and restarts cleanly', async ({ page }) => {
  await start(page, { config: quietConfig(), player: { x: 1100, y: 500, rotation: 0 } });
  await hold(page, ['w', 'Space'], 200);
  await finish(page);
  const ended = await state(page);
  expect(ended.running).toBe(false); expect(ended.timeLeft).toBe(0);
  await page.evaluate(() => (document.activeElement as HTMLElement)?.blur());
  await hold(page, ['w', 'Space'], 5000); expect(await state(page)).toEqual(ended);
  await expect(page.getByText('Match registered.', { exact: true })).toBeVisible();
  const before = await page.evaluate(() => localStorage.getItem('naval_arena_last_match'));
  await page.reload();
  await expect(page.getByRole('heading', { name: 'BATTLE COMPLETE' })).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem('naval_arena_last_match'))).toBe(before);
  await page.getByRole('button', { name: 'PLAY AGAIN' }).click();
  await expect(page.getByRole('button', { name: 'Pause game' })).toBeVisible();
  const fresh = await state(page);
  expect(fresh.hp).toBe(100); expect(fresh.score).toBe(0); expect(fresh.timePlayed).toBe(0);
  expect(fresh.projectiles).toHaveLength(0); expect(fresh.enemies).toHaveLength(0);
  expect(fresh.player).toEqual({ x: 1100, y: 500, rotation: 0 });
  await expect(page.locator('canvas')).toHaveCount(1);
});

test('death ends immediately, freezes damage and records the actual reason', async ({ page }) => {
  const config = quietConfig(); config.chaserEnemy.damage = 100;
  await start(page, { config, player: { x: 1100, y: 500, rotation: 0 }, enemies: [{ type: 'chaser', x: 1100, y: 300, rotation: Math.PI }] });
  await advance(page, 1000);
  await expect(page.getByRole('heading', { name: 'SHIP DESTROYED' })).toBeVisible();
  const ended = await state(page); expect(ended.hp).toBe(0); expect(ended.score).toBe(0);
  await advance(page, 5000); expect(await state(page)).toEqual(ended);
  const record = await page.evaluate(() => JSON.parse(localStorage.getItem('naval_arena_last_match')!));
  expect(record.endReason).toBe('player_destroyed'); expect(record.duration).toBeLessThan(1);
});

test('manual pause, blur and hidden tab freeze time and clear held controls', async ({ page }) => {
  await start(page, { config: quietConfig(), player: { x: 1100, y: 500, rotation: 0 } });
  await hold(page, ['w', 'Space'], 200);
  await page.getByRole('button', { name: 'Pause game' }).click();
  const paused = await state(page); await advance(page, 5000);
  expect(await state(page)).toEqual(paused);
  await page.getByRole('button', { name: 'RESUME' }).click();
  await page.keyboard.down('w'); await page.keyboard.down('Space');
  await page.evaluate(() => window.dispatchEvent(new Event('blur')));
  await expect(page.getByRole('heading', { name: 'PAUSED' })).toBeVisible();
  const blurred = await state(page);
  await advance(page, 5000); expect(await state(page)).toEqual(blurred);
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await expect(page.getByRole('heading', { name: 'PAUSED' })).toBeVisible();
  await page.getByRole('button', { name: 'RESUME' }).click();
  await advance(page, 100);
  let data = await state(page);
  expect(data.player).toEqual(blurred.player); expect(data.shotCount).toBe(blurred.shotCount);
  await page.keyboard.up('w'); await page.keyboard.up('Space');
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, value: true });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await expect(page.getByRole('heading', { name: 'PAUSED' })).toBeVisible();
  data = await state(page); await advance(page, 1000); expect(await state(page)).toEqual(data);
  await page.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, value: false }); });
});

test('pause also preserves cooldown and the current configuration snapshot', async ({ page }) => {
  await start(page, { player: { x: 1100, y: 500, rotation: 0 } });
  await hold(page, ['Space'], 10);
  await page.getByRole('button', { name: 'Pause game' }).click();
  await page.getByRole('button', { name: 'OPTIONS', exact: true }).click();
  await page.getByRole('button', { name: 'Increase session time' }).click();
  await page.getByRole('button', { name: 'BACK' }).click();
  await advance(page, 5000);
  await page.getByRole('button', { name: 'RESUME' }).click();
  await hold(page, ['Space'], 100);
  expect((await state(page)).shotCount).toBe(1);
  expect((await state(page)).config.gameSessionTime).toBe(90);
  await page.getByRole('button', { name: 'Pause game' }).click(); await mainMenu(page);
  await page.getByRole('button', { name: 'PLAY', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Pause game' })).toBeVisible();
  expect((await state(page)).config.gameSessionTime).toBe(105);
});

test('abandonment and repeated navigation release canvases and never register a match', async ({ page }) => {
  await start(page, { config: quietConfig() });
  for (let index = 0; index < 3; index++) {
    await hold(page, ['w', 'Space'], 100);
    await page.getByRole('button', { name: 'Pause game' }).click(); await mainMenu(page);
    await expect(page.locator('canvas')).toHaveCount(0);
    await page.getByRole('button', { name: 'OPTIONS', exact: true }).click(); await mainMenu(page);
    await page.getByRole('button', { name: 'PLAY', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Pause game' })).toBeVisible();
    await expect(page.locator('canvas')).toHaveCount(1);
    expect((await state(page)).shotCount).toBe(0);
  }
  await page.reload(); await expect(page.getByRole('button', { name: 'Pause game' })).toBeVisible();
  expect((await state(page)).timePlayed).toBe(0);
  expect((await records(page)).filter(row => row.playerId === 'e2e-player')).toHaveLength(0);
  expect(await pending(page)).toHaveLength(0);
});

test('simultaneous native touch moves and fires, releasing touches clears input', async ({ page }) => {
  await start(page, { config: quietConfig(), player: { x: 1100, y: 500, rotation: 0 } });
  const forward = await page.getByRole('button', { name: 'Forward (W)', exact: true }).boundingBox();
  const fire = await page.getByRole('button', { name: 'Front shot (Space)', exact: true }).boundingBox();
  const session = await page.context().newCDPSession(page);
  await session.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 2 });
  await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [
    { x: forward!.x + forward!.width / 2, y: forward!.y + forward!.height / 2, id: 1 },
    { x: fire!.x + fire!.width / 2, y: fire!.y + fire!.height / 2, id: 2 },
  ] });
  await advance(page, 200); const moved = await state(page);
  expect(moved.player.y).toBeLessThan(500); expect(moved.shotCount).toBe(1);
  await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await advance(page, 200); const released = await state(page);
  expect(released.player).toEqual(moved.player); expect(released.shotCount).toBe(moved.shotCount);
  await session.detach();
});
