import { chromium } from '@playwright/test';
import { spawn, spawnSync } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import os from 'node:os';

// Run from the project root. All waits use real wall time; there is no E2E clock.
const output = process.env.PROFILE_OUTPUT || 'performance-results';
const memoryOnly = process.env.PROFILE_MEMORY_ONLY === 'true';
const url = 'http://127.0.0.1:5175';
await mkdir(output, { recursive: true });
const build = spawnSync(process.platform === 'win32' ? 'npm.cmd' : 'npm', ['run', 'build:profile'], {
  stdio: 'inherit', shell: process.platform === 'win32',
});
if (build.status !== 0) throw new Error('Profiling build failed.');
const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', 'preview', '--host', '127.0.0.1', '--port', '5175', '--strictPort'], { stdio: 'inherit' });
const delay = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));
let browser;
try {
  for (let attempt = 0; attempt < 100; attempt++) {
    try { if ((await fetch(url)).ok) break; } catch { /* Wait for preview. */ }
    await delay(100);
  }
  browser = await chromium.launch({
    headless: process.env.PROFILE_HEADED !== 'true',
    ...(process.env.PROFILE_BROWSER_PATH ? { executablePath: process.env.PROFILE_BROWSER_PATH } : {}),
    args: JSON.parse(process.env.PROFILE_BROWSER_ARGS || '[]'),
    env: { ...process.env },
  });
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 },
    deviceScaleFactor: 1, locale: 'en-US', timezoneId: 'UTC' });
  const page = await context.newPage();
  page.setDefaultTimeout(20000);
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  const cdp = await context.newCDPSession(page);
  await cdp.send('Performance.enable');
  await cdp.send('HeapProfiler.enable');
  const system = await browser.newBrowserCDPSession();
  const gpu = await system.send('SystemInfo.getInfo');
  const environment = { date: new Date().toISOString(), platform: os.platform(), release: os.release(),
    cpu: os.cpus()[0]?.model, logicalCpus: os.cpus().length, memoryBytes: os.totalmem(),
    browser: await browser.version(), viewport: { width: 1280, height: 720 }, dpr: 1,
    headless: process.env.PROFILE_HEADED !== 'true', gpu: gpu.gpu,
    launchArgs: JSON.parse(process.env.PROFILE_BROWSER_ARGS || '[]') };
  await page.goto(url);
  await page.getByRole('button', { name: 'PLAY', exact: true }).waitFor();
  await page.evaluate(() => {
    localStorage.setItem('naval_arena_game_config', JSON.stringify({ gameSessionTime: 180, enemySpawnTime: 1 }));
    localStorage.setItem('msw_latency', '0');
  });
  if (process.env.PROFILE_BYPASS_WORKER === 'true') {
    await cdp.send('Network.setBypassServiceWorker', { bypass: true });
  }
  if (!memoryOnly) {
    await page.goto(`${url}/arena?profile=stress`);
    await page.getByRole('button', { name: 'Pause game' }).waitFor();
    if (await page.evaluate(() => !!window.__pirateTest)) throw new Error('E2E clock must be absent.');
    for (const key of ['KeyW', 'KeyD', 'Space', 'KeyQ', 'KeyE']) await page.keyboard.down(key);
    console.log('Three-minute battle started (real clock, spawn every second, stress HP).');
    const combatStarted = Date.now();
    let tracing = false;
    let traceFinished;
    let arenaCaptured = false;
    while (true) {
      const report = await page.evaluate(() => window.__pirateProfile?.read());
      const activeTime = report?.samples.at(-1)?.time || 0;
      if (!arenaCaptured && activeTime >= 90) {
        await page.screenshot({ path: `${output}/combat-90s.png` });
        arenaCaptured = true;
      }
      if (!tracing && activeTime >= 165 && !report.finished) {
        tracing = true;
        traceFinished = new Promise(resolve => cdp.once('Tracing.tracingComplete', resolve));
        await cdp.send('Tracing.start', { categories: 'devtools.timeline,v8,disabled-by-default-v8.cpu_profiler', transferMode: 'ReturnAsStream' });
        await cdp.send('Profiler.enable');
        await cdp.send('Profiler.start');
      }
      if (report?.finished) {
        if (activeTime < 179.9) throw new Error(`Battle ended early at ${activeTime} seconds.`);
        await writeFile(`${output}/combat.json`, JSON.stringify({ environment, wallSeconds: (Date.now() - combatStarted) / 1000, ...report }, null, 2));
        break;
      }
      if (Date.now() - combatStarted > 300000) throw new Error('Battle did not finish within five wall-clock minutes.');
      await delay(1000);
    }
    if (tracing) {
      const cpu = await cdp.send('Profiler.stop');
      await writeFile(`${output}/combat-last-15s.cpuprofile`, JSON.stringify(cpu.profile));
      await cdp.send('Tracing.end');
      const { stream } = await traceFinished;
      let capture = '';
      while (true) {
        const chunk = await cdp.send('IO.read', { handle: stream });
        capture += chunk.base64Encoded ? Buffer.from(chunk.data, 'base64').toString() : chunk.data;
        if (chunk.eof) break;
      }
      await cdp.send('IO.close', { handle: stream });
      await writeFile(`${output}/combat-last-15s.trace.json`, capture);
    }
    for (const key of ['KeyW', 'KeyD', 'Space', 'KeyQ', 'KeyE']) await page.keyboard.up(key);
    await page.getByRole('button', { name: 'MAIN MENU', exact: true }).click();
  }

  // Warm normal combat assets before the memory baseline. No refresh between cycles.
  await page.evaluate(() => localStorage.setItem('naval_arena_game_config', JSON.stringify({ gameSessionTime: 180, enemySpawnTime: 3 })));
  async function startCycle() {
    await page.getByRole('button', { name: 'PLAY', exact: true }).click();
    await page.getByRole('button', { name: 'Pause game' }).waitFor();
    for (const key of ['KeyW', 'KeyD', 'Space', 'KeyQ', 'KeyE']) await page.keyboard.down(key);
  }
  async function exitCycle() {
    for (const key of ['KeyW', 'KeyD', 'Space', 'KeyQ', 'KeyE']) await page.keyboard.up(key);
    await page.getByRole('button', { name: 'Pause game' }).click();
    await page.getByRole('button', { name: 'MAIN MENU', exact: true }).click();
    await delay(2000);
    if (await page.locator('canvas').count()) throw new Error('Canvas remained after exit.');
  }
  async function memory(cycle) {
    await cdp.send('HeapProfiler.collectGarbage');
    const heap = await cdp.send('Runtime.getHeapUsage');
    const dom = await cdp.send('Memory.getDOMCounters');
    const { metrics } = await cdp.send('Performance.getMetrics');
    return { cycle, ...heap, ...dom, metrics, canvasCount: await page.locator('canvas').count() };
  }
  async function heapSnapshot(name) {
    const chunks = [];
    const receive = ({ chunk }) => chunks.push(chunk);
    cdp.on('HeapProfiler.addHeapSnapshotChunk', receive);
    await cdp.send('HeapProfiler.takeHeapSnapshot', { reportProgress: false });
    cdp.off('HeapProfiler.addHeapSnapshotChunk', receive);
    await writeFile(`${output}/${name}.heapsnapshot`, chunks.join(''));
  }
  await startCycle();
  await delay(10000);
  await exitCycle();
  const measurements = [await memory(0)];
  await heapSnapshot('memory-baseline');
  for (let cycle = 1; cycle <= 5; cycle++) {
    await startCycle();
    await delay(20000);
    await exitCycle();
    measurements.push(await memory(cycle));
    console.log(`Memory cycle ${cycle}/5: ${Math.round(measurements.at(-1).usedSize / 1048576 * 100) / 100} MiB JS heap after GC.`);
  }
  await heapSnapshot('memory-after-five-cycles');
  await writeFile(`${output}/memory.json`, JSON.stringify({ environment, warmupSeconds: 10,
    playSecondsPerCycle: 20, settleSeconds: 2, forcedGc: true,
    bypassServiceWorker: process.env.PROFILE_BYPASS_WORKER === 'true', memoryOnly,
    measurements, errors }, null, 2));
  await page.screenshot({ path: `${output}/menu-after-five-cycles.png` });
  console.log(`Profiling completed. Raw evidence: ${output}/`);
} finally {
  await browser?.close();
  server.kill();
}
