import { chromium } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';

const address = process.argv[2];
if (!address) throw new Error('Usage: npm run verify:deploy -- https://your-game.vercel.app');
const origin = new URL(address).origin;
const output = 'deployment-results';
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true,
  ...(process.env.BROWSER_EXECUTABLE_PATH ? { executablePath: process.env.BROWSER_EXECUTABLE_PATH } : {}),
  args: JSON.parse(process.env.BROWSER_ARGS || '[]'),
});
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  const visited = [];
  for (const [path, role, name] of [['/', 'button', 'PLAY'], ['/options', 'heading', 'OPTIONS'],
    ['/result', 'heading', 'NO COMPLETED BATTLE']]) {
    await page.goto(origin + path);
    await page.getByRole(role, { name, exact: true }).waitFor();
    await page.reload();
    await page.getByRole(role, { name, exact: true }).waitFor();
    visited.push(path);
  }
  await page.goto(origin + '/ranking');
  await page.getByText('Blackbeard', { exact: true }).waitFor();
  await page.reload();
  await page.getByText('Blackbeard', { exact: true }).waitFor();
  visited.push('/ranking');
  await page.goto(origin + '/history');
  await page.getByText('No match history found. Play a game first!', { exact: true }).waitFor();
  await page.reload();
  await page.getByText('No match history found. Play a game first!', { exact: true }).waitFor();
  visited.push('/history');
  await page.goto(origin + '/arena');
  await page.getByRole('button', { name: 'Pause game' }).waitFor();
  await page.getByLabel('Health: 100 of 100', { exact: true }).waitFor();
  await page.getByLabel('Time remaining: 01:29', { exact: true }).waitFor();
  const flags = await page.evaluate(() => ({ e2e: !!window.__pirateTest, profile: !!window.__pirateProfile }));
  if (flags.e2e || flags.profile) throw new Error('The published build exposes non-production controls.');
  await page.reload();
  await page.getByRole('button', { name: 'Pause game' }).waitFor();
  visited.push('/arena');
  await page.screenshot({ path: `${output}/published-arena.png` });
  await page.getByRole('button', { name: 'Pause game' }).click();
  await page.getByRole('button', { name: 'MAIN MENU', exact: true }).click();
  if (await page.locator('canvas').count()) throw new Error('Combat canvas remained after leaving.');
  if (errors.length) throw new Error(`Uncaught browser errors: ${errors.join('; ')}`);
  await writeFile(`${output}/verification.json`, JSON.stringify({ url: origin,
    verifiedAt: new Date().toISOString(), visited, rankingAndHistoryMocks: true,
    productionControls: flags, errors, status: 'passed' }, null, 2));
  console.log(`Published-game checks passed: ${origin}. Evidence: ${output}/`);
} finally {
  await browser.close();
}
