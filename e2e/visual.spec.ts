import { test, expect } from './fixtures';
import { finish, isolate, quietConfig, start } from './helpers';

test('versioned menu baseline', async ({ page }) => {
  await isolate(page); await page.goto('/');
  await expect(page.getByRole('button', { name: 'PLAY', exact: true })).toBeVisible();
  await expect(page).toHaveScreenshot('menu.png', { maxDiffPixelRatio: .01 });
});
test('versioned stable arena and result baselines', async ({ page }) => {
  await start(page, { config: quietConfig(), player: { x: 1100, y: 500, rotation: .3 } });
  await expect(page).toHaveScreenshot('arena.png', { maxDiffPixelRatio: .01 });
  await finish(page);
  await expect(page.getByText('Match registered.', { exact: true })).toBeVisible();
  await expect(page).toHaveScreenshot('result.png', { maxDiffPixelRatio: .01 });
});
