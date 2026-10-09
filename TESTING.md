# Playwright E2E tests

## Run

```bash
npm ci
npx playwright install chromium
npm run test:e2e:types
npm run test:e2e
npm run test:e2e:report
```

Playwright builds the app with `--mode e2e`, serves that build, and executes each
scenario in Chromium desktop (1280×720) and emulated Pixel 5. It uses one worker to
avoid overloading the software GPU. No additional runtime dependencies are needed.
Each test gets a new browser context. Storage is cleared once at the beginning of
that test; reloads inside the test preserve the pending queue and completed data.
MSW still runs at the network boundary. The asset-failure test intercepts requests
at browser-context level because a Service Worker forwards the image requests.

## Reproducible gameplay

`src/game/testSupport.ts` defines a small typed test interface. It is enabled only
by `.env.e2e`; `npm run build` leaves it disabled. Tests provide a seed and an
initial scenario before the app starts. They can read value snapshots, query an
island footprint, and advance active simulation time. They cannot assign health,
score, cooldowns, projectile hits or completed results during the game.

The controlled clock stops the automatic ticker and advances the **same** engine
loop in 1/120-second increments. Rendering still uses PixiJS and real textures;
after advancement the real scene is rendered once. This avoids thousands of GPU
frames when testing a 90-second session. Keyboard tests send actual browser key
events. Touch tests use Chromium's native two-finger touch dispatch, which reaches
the normal pointer handlers. Combat never calls fire, damage or score methods.

There are 32 scenarios, executed in both projects (64 cases).
Initial enemies use the normal entity creation path. `quietConfig()` increases
the minimum spawn distance so no random spawn candidate is valid; scheduled-spawn
tests use the normal configuration instead. Fixtures and network latencies are
explicit. The timeout-after-commit case retains the actual Axios 5-second timeout,
then verifies a retry returns the committed record without duplication.

## Coverage

| Requirement | Tests |
| --- | --- |
| 1. Navigation, option validation/persistence | `gameplay.spec.ts`: keyboard navigation, minimum/maximum buttons, reload, invalid stored values. |
| 2. Asset loading, failures and retry | `gameplay.spec.ts`: visible progress, missing PNG, no match registration, successful retry and concurrent loading under controlled image latency. |
| 3. Movement, rotation, boundaries, islands | `gameplay.spec.ts`: browser keys, all four edges, shoreline hull/projectile collision. |
| 4. Weapons, damage, cooldown, score | `gameplay.spec.ts`: frontal single hit, three parallel broadsides, independent cooldowns, multiple hits on one victim score once. |
| 5. Enemies and spawn interval | `gameplay.spec.ts`: seeded scheduled spawn, both types, pursuit/rotation, impact, Shooter range/damage, island footprint, repeated seed. |
| 6. Time/death, shutdown and restart | `session.spec.ts`: both ending reasons, frozen final snapshot, reset entities/health/time/score. |
| 7. Pause/focus/resume | `session.spec.ts`: manual pause, blur, visibility event, explicit resume, cleared inputs and frozen cooldown. |
| 8. Result and refresh | `session.spec.ts`: `/result` restores the last completed match after refresh. |
| 9. Abandonment/navigation/touch | `session.spec.ts`: repeated canvas cleanup, no abandoned registration, reload, native simultaneous touches and release. |
| 10. Ranking/history pagination and states | `network.spec.ts`: actual MSW/Axios queries, multi-page fixtures, loading, empty, API errors and explicit retry. |
| 11. Registration and pending recovery | `network.spec.ts`: cache invalidation in both tabs, persistent queue, another game while pending, refresh and recovery. |
| 12. Idempotency and late responses | `network.spec.ts`: real after-commit timeout, automatic retry and repeated ID, slow page-one refresh versus fast page-two request. |

The late-response test accepts a completed or cancelled older request. TanStack
Query passes its AbortSignal to Axios: cancellation is part of the protection,
while page/config/player query keys prevent old page data replacing current data.
The hidden-tab test dispatches visibilitychange after setting document.hidden;
the blur test dispatches the browser blur event. They test application handling,
not operating-system window management. Mobile execution is browser emulation,
not certification on physical devices.

## Visual regression

`visual.spec.ts` checks menu, a stable arena at time zero, and the completed result.
Twelve desktop/mobile Linux and Windows baselines live in
`e2e/visual.spec.ts-snapshots`. Keep these
PNG files in Git with the tests. They are assertions, not runtime game assets.

```bash
# Deliberate visual change or first baseline on another OS:
npm run test:e2e:update
# Inspect generated images, then commit only intended changes:
git add e2e/visual.spec.ts-snapshots
# Normal verification; does not update baselines:
npm run test:e2e
```

Windows uses separate screenshot filenames, which are included. Both operating
systems use their existing baselines during normal runs; do not update snapshots
automatically to conceal a failure.

## Report and failures

The HTML report is generated in `playwright-report`. Run `npm run test:e2e:report`
to open it. On failures, `test-results` contains screenshots and `trace.zip` files:

```bash
npx playwright show-trace test-results/<failed-test>/trace.zip
```

Traces are retained on the first failure, not only on retries. Successful tests do
not create failure traces. Reports and traces are generated artifacts and are
ignored by Git; archive the report under tracked `reports/` for submission.
The curated delivery archives in `reports/` are an exception: they are tracked
snapshots required by the submission, not the constantly regenerated folders.
Every E2E case also uses `e2e/fixtures.ts` to fail on uncaught browser page errors.
Handled HTTP and asset-loading failures remain valid test scenarios.

`npm run verify:deploy -- https://YOUR-PUBLIC-URL` is a separate smoke check for
the normal production build. It checks direct entry/reload of all app routes,
asset loading, real timer progression, both mocked lists, disabled test/profile
interfaces and canvas teardown. Its local output is `deployment-results/`.
It cannot replace the full E2E suite or performance capture, and must actually be
run against the public URL before claiming deployment verification.

This coverage checks the listed flows. It is not exhaustive coverage of every
possible collision angle, browser, balance setting or physical mobile device.

## Latest archived run

The uploaded reports/playwright-report.zip was inspected: 64 tests passed, with
zero unexpected, flaky or skipped cases. It contains gameplay, network, session
and visual specs (32 cases per project). The owner ran this suite on Windows with
Node 24.11.1 and npm 11.7.0. No failure traces were produced by that successful
run. Its original Windows ZIP entry separator was normalized for portable
extraction; the HTML report content was not changed. See reports/manifest.json.

The later project archive also contained obsolete useGameStore.ts and
ranking.spec.ts files, which are absent from this successful report. Remove those
unused legacy files before the next clean-checkout check. The report is evidence
of the actual successful run, not proof that these obsolete copies compile.
