# Pirate Battle

- Play: https://pirate-battle-beige.vercel.app/
- Source: https://github.com/MarceloHenrique1711/Pirate-Battle

A single-player naval shooter built with React, strict TypeScript and PixiJS.
Ranking and match history use Axios, TanStack Query and browser MSW mocks.

## Run locally

Use Node.js 24.x (reference runtime: 24.19.0) and npm 11.x. The package supports
Node >=22.12 and npm >=10, but that combination has not been measured here.
The public npm lockfile is included. No backend account, API key or private service
is needed to run this project after installation.

```bash
npm ci
npm run dev
```

## Commands and environment

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start the development server. |
| `npm run build` | Type-check and produce the normal optimized `dist` build. |
| `npm run preview` | Serve the existing build locally; it does not rebuild it. |
| `npm run lint` | Run ESLint on TypeScript code. |
| `npm run typecheck` | Check app, build configuration and E2E TypeScript. |
| `npm test` | Run Vitest unit/integration tests. |
| `npm run check` | Run lint, types, unit tests and normal build. |
| `npm run test:e2e` | Build in E2E mode and run desktop/mobile Chromium tests. |
| `npm run test:e2e:update` | Deliberately regenerate screenshots, then inspect them. |
| `npm run test:e2e:report` | Open the latest generated HTML report. |
| `npm run profile` / `npm run profile:summary` | Capture and summarize optimized-build profiling. |
| `npm run verify:deploy -- https://pirate-battle-beige.vercel.app` | Check the normal published build, mocks and route refreshes. |

No `.env` file is required for normal development. `.env.example` documents the
non-secret flags; do not copy true test/profile values into hosting settings.

| Variable | Default / purpose |
| --- | --- |
| `VITE_E2E` | False/unset in normal builds; true only in `.env.e2e` enables controlled test setup/clock. |
| `VITE_PROFILE` | False/unset in normal builds; true only in `.env.profile` enables measurements. |
| `PROFILE_HEADED` | Node profiling script only; `true` uses a visible, focused browser. |

`.env.production` explicitly sets both browser flags to false. MSW remains enabled
in every mode, including normal production. Gameplay options are local storage,
not environment variables. Local `.env.*.local` overrides are ignored by Git.

Options persist locally. Session time is 60–180 seconds and enemy spawn time is
1–10 seconds. Ship speeds are pixels per active second; rotation is radians per
active second; cooldowns are active milliseconds; projectile lifetime is seconds.
The default session is 90 seconds. The default enemy cycle alternates Chaser and
Shooter. The first enemy appears after the configured spawn interval.

## Controls

- Forward: W or Arrow Up.
- Rotate: A/D or Arrow Left/Right.
- Front shot: Space or J.
- Left broadside: Q or U.
- Right broadside: E or O.
- Pause: the HUD pause button. Resume explicitly using the pause dialog.
- Touch: hold movement and attack buttons simultaneously.

Portrait and landscape layouts are supported by fitting the complete 1800×1000
world into the available canvas area. HUD and touch controls adapt to the viewport. Landscape is recommended for combat.
Mobile usability still needs hands-on device testing before delivery.

The settings icon in the main menu opens captain name and control instructions. A persistent player ID identifies
this browser's player even if the display name changes. Completed matches are
queued and registered automatically. Abandoned matches are not registered.
Pending matches do not prevent another game. Use Retry registration on the result
screen, or Retry pending matches in Network demo on the menu.

## Validation

```bash
npm run lint
npm run typecheck
npm test
npm run build
npx playwright install chromium
npm run test:e2e
```

Twelve versioned Linux and Windows baselines for menu, stable arena and result
are included for desktop and mobile. Normal validation compares them without
updating them. Use `npm run test:e2e:update` only for an intentional visual change
or the first inspected baseline on another operating system.
See TESTING.md for isolation, seed, controlled simulation time, coverage, reports
and traces. The normal production build disables the E2E control interface.

Completed matches navigate to `/result`. Refreshing that page restores the last
completed score, duration, ending reason and pending registration state. Refreshing
an active combat still abandons that combat and starts a fresh session.

## Combat performance

See PERFORMANCE.md for the measured reference environment, three-minute combat,
five start/play/exit memory cycles, profiling evidence and limitations.

```bash
npx playwright install chromium
npm run profile
npm run profile:summary
```

The profiling command builds an optimized, minified profile build and uses the
real Pixi ticker. It takes roughly five minutes. The explicit stress scenario uses
180 seconds, one-second spawns and 100000 player HP so damage cannot end the capture
early. Other rules remain active. The five memory cycles use normal 100 HP and
three-second spawns. Measurements are read-only; no E2E time control is enabled.
Normal `npm run build` excludes profiling and the stress override.
Generated evidence is written to `performance-results/`, which is ignored by Git.
Keep PERFORMANCE.md, profiling scripts and the curated archive in `reports/` in
the commit. Do not commit each regenerated raw capture. To repeat with a visible browser, use `PROFILE_HEADED=true`
(PowerShell: `$env:PROFILE_HEADED = "true"` before running the command).

## Network scenarios

Open Network scenarios from the captain/controls dialog, press F8, or append
`?network` to the URL. It is available in development and production.
Select SUCCESS, EMPTY, SLOW, VARIABLE_LATENCY, OUT_OF_ORDER, TIMEOUT, SERVER_ERROR,
CLIENT_ERROR, NETWORK_ERROR, RANKING_ERROR, HISTORY_ERROR, TIMEOUT_AFTER_COMMIT or
UNAVAILABLE_AT_FINISH. Reset demo restores confirmed fixture data and the SUCCESS
scenario, but preserves pending matches. Fixtures provide multiple ranking pages.

Variable latency repeats 100/900/300 ms. Out-of-order latency alternates 1200/100
ms. Both patterns restart on reset; no random latency is used. Axios times out at
5000 ms; TIMEOUT waits 6000 ms. TIMEOUT_AFTER_COMMIT writes the record, then waits
6000 ms before its first response; a retry with the same ID retrieves the record.
UNAVAILABLE_AT_FINISH rejects match submissions while reads still work. Choose
SUCCESS and retry pending matches to recover. Tests set `msw_latency` to `0` for
normal request latency. This override does not shorten the after-commit timeout.

MSW starts before React in every build. Its worker must be served from the app's
origin. Publish the `dist` directory over HTTPS (or localhost) with SPA fallback
for routes and with `mockServiceWorker.js` accessible. This app assumes deployment
at the origin root; subpath deployment needs explicit asset/API/worker base paths.

Ranking compares the full game configuration. Fixtures use the default config;
changing Options can therefore show an empty ranking until a matching game exists.
Each confirmed match has one ranking row. Ties use score, active duration, ISO date,
and match ID. History contains only the current player's matches.

### Reproduce failure and recovery

1. Open `/?network`, choose `HISTORY_ERROR`, then open Match History. Wait for the
   query retries and the error with Try again. Choose SUCCESS and retry.
2. Choose `EMPTY`, then open either list to inspect the empty state. Choose SLOW
   to observe loading; VARIABLE_LATENCY and OUT_OF_ORDER use the documented patterns.
3. Choose `UNAVAILABLE_AT_FINISH`, play until time/death, and inspect the pending
   result. Refresh `/result`: the pending queue survives. Choose SUCCESS from
   Network demo and use Retry pending matches. Both list queries are invalidated.
4. Choose `TIMEOUT_AFTER_COMMIT` and complete a match. The first response exceeds
   Axios's five-second timeout; retries use the same ID and recover one record.
5. CLIENT_ERROR, SERVER_ERROR, NETWORK_ERROR and TIMEOUT exercise HTTP 400, HTTP
   503, connection failure and a six-second response delay respectively.
6. Reset demo restores fixture matches, SUCCESS and request-order counters after
   confirmation/reload. It intentionally preserves pending submissions. If you
   manually set the test-only `msw_latency` storage override, remove it separately
   to restore the default 150 ms latency. Options and captain identity are kept.

Automated equivalents are mapped in TESTING.md. The timeout-after-commit delay
is not shortened by `msw_latency`. Browser DevTools may log expected HTTP/network
failures in these scenarios; the UI handles them. Uncaught `pageerror` events fail
the E2E suite, including flows that intentionally simulate failures.

## Deployment and submission

The selected provider is Vercel. `vercel.json` uses `npm ci`, `npm run build` and
`dist`, with an SPA rewrite for route reloads. The MSW worker and `/assets` are
real static files in that output. `.vercelignore` excludes report archives from
deployment uploads; they remain part of the Git repository.

1. Create an empty GitHub repository and push the project root (the directory
   containing package.json, not node_modules or a project-source ZIP).
2. Import that repository at https://vercel.com/new, choose Vite and the correct
   Root Directory. Use Node.js 24.x, install `npm ci`, build `npm run build`, output
   `dist`. Do not publish with `build:e2e` or `build:profile`.
3. Deploy the intended Git commit. Open the resulting production URL in a fresh
   browser session; the evaluator must not need a private account or access gate.
4. Install Chromium and run `npm run verify:deploy -- https://pirate-battle-beige.vercel.app/`.
   Copy the resulting verification JSON into `reports/public-deployment-verification.json`
   and record the deployed runtime source commit.
5. Fill the repository URL, game URL and verified source commit in SUBMISSION.md.
   Send those URLs and the reports to the evaluator. Keep the deployment accessible
   during evaluation and redeploy if runtime code changes after verification.

Official SPA routing guidance: https://vercel.com/docs/frameworks/frontend/vite

SUBMISSION.md tracks the remaining mandatory actions.
Curated HTML/traces and profiling archives live in `reports/`; see its README for
checkpoint dates, commands and the distinction between successful runs and older
diagnostic failures. `docs/` is not used.

## Remaining delivery work

- Test simultaneous touch actions and keyboard focus on actual devices.
- Separate the remaining enemy rules from Pixi rendering if strict architectural
  separation is expected; GameEngine currently coordinates both.
- Confirm and include asset licenses before distribution. See ASSET_SOURCES.md.
- Review gameplay balance and simultaneous touch controls on physical devices.
- Repeat profiling with hardware GPU acceleration and investigate the retained
  transport objects reported in PERFORMANCE.md before claiming 60 FPS or memory stability.

See ARCHITECTURE.md for the implementation decisions and tradeoffs.
