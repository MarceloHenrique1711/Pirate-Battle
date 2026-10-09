import { test, expect } from './fixtures';
import { advance, hold, isolate, mainMenu, quietConfig, records, start, state } from './helpers';

test('options validate boundaries, persist and navigate using keyboard', async ({ page }) => {
  await isolate(page); await page.goto('/');
  await page.getByRole('button', { name: 'OPTIONS', exact: true }).focus();
  await page.keyboard.press('Enter');
  for (let i = 0; i < 6; i++) await page.getByRole('button', { name: 'Increase session time' }).click({ force: true });
  await expect(page.getByRole('button', { name: 'Increase session time' })).toBeDisabled();
  await expect(page.getByText('180 s', { exact: true })).toBeVisible();
  for (let i = 0; i < 8; i++) await page.getByRole('button', { name: 'Decrease session time' }).click();
  await expect(page.getByRole('button', { name: 'Decrease session time' })).toBeDisabled();
  for (let i = 0; i < 2; i++) await page.getByRole('button', { name: 'Decrease spawn interval' }).click();
  await expect(page.getByRole('button', { name: 'Decrease spawn interval' })).toBeDisabled();
  for (let i = 0; i < 9; i++) await page.getByRole('button', { name: 'Increase spawn interval' }).click();
  await expect(page.getByRole('button', { name: 'Increase spawn interval' })).toBeDisabled();
  await mainMenu(page); await page.reload();
  await page.getByRole('button', { name: 'OPTIONS', exact: true }).click();
  await expect(page.getByText('60 s', { exact: true })).toBeVisible();
  await expect(page.getByText('10 s', { exact: true })).toBeVisible();
  await page.evaluate(() => localStorage.setItem('naval_arena_game_config', '{"gameSessionTime":-1,"enemySpawnTime":0}'));
  await page.reload();
  await expect(page.getByText('90 s', { exact: true })).toBeVisible();
  await expect(page.getByText('3 s', { exact: true })).toBeVisible();
});

test('asset loading reports progress, fails safely and retries', async ({ page }) => {
  await isolate(page);
  let fail = true;
  await page.context().route('**/ships/ship_2.png', async route => {
    await new Promise(resolve => setTimeout(resolve, 300));
    if (fail) await route.fulfill({ status: 404, body: 'Missing asset' });
    else await route.continue();
  });
  await page.goto('/arena');
  await expect(page.getByRole('progressbar', { name: 'Loading assets' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'LOADING ERROR' })).toBeVisible();
  expect((await records(page)).filter(row => row.playerId === 'e2e-player')).toHaveLength(0);
  fail = false;
  await page.getByRole('button', { name: 'PLAY AGAIN' }).click();
  await expect(page.getByRole('button', { name: 'Pause game' })).toBeVisible();
  await expect(page.locator('canvas')).toHaveCount(1);
});

test('independent ship assets load concurrently before combat starts', async ({ page }) => {
  let active = 0;
  let peak = 0;
  await page.context().route('**/ships/ship_*.png', async route => {
    active++;
    peak = Math.max(peak, active);
    try {
      await new Promise(resolve => setTimeout(resolve, 250));
      await route.continue();
    } finally {
      active--;
    }
  });
  await start(page, { config: quietConfig() });
  expect(peak).toBeGreaterThan(1);
  expect((await state(page)).timePlayed).toBe(0);
});

test('movement, rotation, arena boundary and island collisions use real input', async ({ page }) => {
  await start(page, { config: quietConfig(), player: { x: 1000, y: 400, rotation: 0 } });
  await hold(page, ['w'], 1000);
  expect((await state(page)).player.y).toBeCloseTo(70, 0);
  await hold(page, ['w'], 1000);
  expect((await state(page)).player.y).toBe(46);
  await hold(page, ['d'], 200);
  expect((await state(page)).player.rotation).toBeCloseTo(.6, 2);
  await hold(page, ['a'], 200);
  expect((await state(page)).player.rotation).toBeCloseTo(0, 2);

});

test('islands block ships and projectiles', async ({ page }) => {
  await start(page, { config: quietConfig(), player: { x: 500, y: 620, rotation: 0 } });
  await hold(page, ['w'], 1000);
  const blocked = await state(page);
  expect(blocked.player.y).toBeGreaterThan(495);
  expect(blocked.player.y).toBeLessThan(620);
  expect(await page.evaluate(p => window.__pirateTest!.islandAt(p.x, p.y, 46), blocked.player)).toBe(false);
  await hold(page, ['w'], 1000);
  expect((await state(page)).player).toEqual(blocked.player);
  await hold(page, ['Space'], 500);
  expect((await state(page)).projectiles).toHaveLength(0);
});

test('front shot applies damage once, respects cooldown and awards one point', async ({ page }) => {
  const config = quietConfig(); config.chaserEnemy.speed = 0;
  await start(page, { config, player: { x: 1100, y: 550, rotation: 0 }, enemies: [{ type: 'chaser', x: 1100, y: 350 }] });
  await hold(page, ['Space'], 160);
  let data = await state(page);
  expect(data.shotCount).toBe(1); expect(data.enemies[0].hp).toBe(15); expect(data.projectiles).toHaveLength(0);
  await hold(page, ['Space'], 100);
  expect((await state(page)).shotCount).toBe(1);
  await hold(page, ['Space'], 200);
  data = await state(page);
  expect(data.score).toBe(1); expect(data.enemies).toHaveLength(0);
  await advance(page, 1000); expect((await state(page)).score).toBe(1);
});

test('left and right broadsides fire three parallel shots with separate cooldowns', async ({ page }) => {
  await start(page, { config: quietConfig(), player: { x: 1100, y: 500, rotation: 0 } });
  await hold(page, ['q'], 10);
  let data = await state(page);
  expect(data.projectiles).toHaveLength(3);
  expect(data.projectiles.every(p => p.vx === -900 && Math.abs(p.vy) < .001)).toBe(true);
  expect(new Set(data.projectiles.map(p => Math.round(p.y))).size).toBe(3);
  await hold(page, ['q'], 100); expect((await state(page)).shotCount).toBe(3);
  await hold(page, ['e'], 10); data = await state(page);
  expect(data.shotCount).toBe(6); expect(data.projectiles.filter(p => p.vx > 0)).toHaveLength(3);
  await hold(page, ['q'], 800); expect((await state(page)).shotCount).toBe(9);
});

test('broadside projectiles cannot award duplicate points for the same enemy', async ({ page }) => {
  const config = quietConfig(); config.chaserEnemy.speed = 0;
  await start(page, { config, player: { x: 1100, y: 500, rotation: 0 }, enemies: [{ type: 'chaser', x: 1250, y: 500 }] });
  await hold(page, ['e'], 200);
  expect((await state(page)).score).toBe(1);
  expect((await state(page)).enemies).toHaveLength(0);
  await advance(page, 2000); expect((await state(page)).score).toBe(1);
  expect((await state(page)).projectiles).toHaveLength(0);
});

test('seeded spawns respect interval, distance and islands and include both types', async ({ page }) => {
  await start(page);
  await advance(page, 2990); expect((await state(page)).enemies).toHaveLength(0);
  await advance(page, 20); let data = await state(page);
  expect(data.spawnCount).toBe(1); expect(data.enemies[0].type).toBe('chaser');
  expect(Math.hypot(data.enemies[0].x - data.player.x, data.enemies[0].y - data.player.y)).toBeGreaterThan(640);
  expect(await page.evaluate(p => window.__pirateTest!.islandAt(p.x, p.y, 44), data.enemies[0])).toBe(false);
  await advance(page, 3020); data = await state(page);
  expect(data.spawnCount).toBe(2); expect(data.enemies.some(e => e.type === 'shooter')).toBe(true);
});

test('Chaser pursues, rotates, damages on impact and self-destructs without scoring', async ({ page }) => {
  await start(page, { config: quietConfig(), player: { x: 1100, y: 500, rotation: 0 }, enemies: [{ type: 'chaser', x: 1100, y: 300, rotation: Math.PI - .4 }] });
  await advance(page, 200); let data = await state(page);
  expect(data.enemies[0].y).toBeGreaterThan(300);
  expect(data.enemies[0].rotation).toBeGreaterThan(Math.PI - .4);
  await advance(page, 600); data = await state(page);
  expect(data.hp).toBe(75); expect(data.enemies).toHaveLength(0); expect(data.score).toBe(0);
});

test('Shooter approaches and fires within range; its projectile damages once', async ({ page }) => {
  const config = quietConfig(); config.shooterEnemy.cooldown = 300;
  await start(page, { config, player: { x: 1100, y: 550, rotation: 0 }, enemies: [{ type: 'shooter', x: 1100, y: 100, rotation: Math.PI - .4 }] });
  await advance(page, 200); expect((await state(page)).enemies[0].y).toBeGreaterThan(100);
  await advance(page, 700);
  const data = await state(page); expect(data.hp).toBe(90); expect(data.shotCount).toBeGreaterThan(0);
  expect(data.score).toBe(0);
});

test('enemy hulls also stop at islands', async ({ page }) => {
  await start(page, { config: quietConfig(), player: { x: 1000, y: 400, rotation: 0 }, enemies: [{ type: 'chaser', x: 500, y: 620, rotation: 0 }] });
  await advance(page, 1000);
  for (const enemy of (await state(page)).enemies) {
    expect(await page.evaluate(p => window.__pirateTest!.islandAt(p.x, p.y, 44), enemy)).toBe(false);
  }
});

for (const edge of [
  { name: 'left', x: 90, y: 550, rotation: -Math.PI / 2, axis: 'x', expected: 46 },
  { name: 'right', x: 1700, y: 400, rotation: Math.PI / 2, axis: 'x', expected: 1754 },
  { name: 'bottom', x: 130, y: 850, rotation: Math.PI, axis: 'y', expected: 954 },
] as const) {
  test(`movement stops at the ${edge.name} arena edge`, async ({ page }) => {
    await start(page, { config: quietConfig(), player: { x: edge.x, y: edge.y, rotation: edge.rotation } });
    await hold(page, ['w'], 1000);
    expect((await state(page)).player[edge.axis]).toBeCloseTo(edge.expected, 4);
  });
}

test('the same seed repeats scheduled spawn positions after restart', async ({ page }) => {
  await start(page); await advance(page, 3010);
  const first = (await state(page)).enemies;
  await page.getByRole('button', { name: 'Pause game' }).click(); await mainMenu(page);
  await page.getByRole('button', { name: 'PLAY', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Pause game' })).toBeVisible();
  await advance(page, 3010); expect((await state(page)).enemies).toEqual(first);
});

test('Shooter stays silent outside attack range and fires after approaching', async ({ page }) => {
  const config = quietConfig(); config.shooterEnemy.cooldown = 100;
  await start(page, { config, player: { x: 1100, y: 650, rotation: 0 },
    enemies: [{ type: 'shooter', x: 1100, y: 50, rotation: Math.PI }] });
  await advance(page, 250); expect((await state(page)).shotCount).toBe(0);
  await advance(page, 100); const data = await state(page);
  expect(data.shotCount).toBe(1);
  expect(data.projectiles[0].enemy).toBe(true);
  expect(data.enemies[0].y).toBeGreaterThan(50);
});
