# Submission record

## Mandatory links

| Item | Status |
| --- | --- |
| Source repository URL | TODO: create/push the owner's repository and fill its public evaluator-accessible URL. |
| Public game URL | TODO: publish the normal build on Vercel and fill its production URL. |
| Verified runtime source commit | TODO: record the Git SHA shown in the successful deployment. |
| Public verification | Not performed yet; no public URL was provided or created in this preparation. |

Do not submit the table with TODO values. This package prepares the delivery; it
does not certify that all challenge requirements or deployment checks are complete.

## What belongs in Git

- `src/`, `public/` (including assets, font license and mockServiceWorker.js),
  `e2e/` (including twelve Linux/Windows visual baselines), and `scripts/`.
- `package.json`, `package-lock.json`, TypeScript/Vite/ESLint/Playwright configs,
  `vercel.json`, `.vercelignore`, `.gitignore` and `.nvmrc`.
- `.env.example`, `.env.production`, `.env.e2e`, `.env.profile`: these contain
  documented boolean flags, not secrets. Keep private local overrides out of Git.
- `README.md`, `ARCHITECTURE.md`, `TESTING.md`, `PERFORMANCE.md`,
  `ASSET_SOURCES.md`, this file and `reports/` with its curated archives/manifest.

Do not commit node_modules, dist, generated test-results/playwright-report,
performance-results, deployment-results, local hosting metadata or duplicate
downloaded project ZIPs. `.gitignore` handles those paths. `reports/` is deliberately
tracked. No `docs` directory is needed.

## Create a repository from a local project

Create an empty repository in the owner's GitHub account first. From the project
directory containing package.json, use these commands only if it is not already
a Git repository:

```bash
git init -b main
git add .
git status
git commit -m "Deliver Pirate Battle challenge implementation and evidence"
git remote add origin https://github.com/YOUR-ACCOUNT/YOUR-REPOSITORY.git
git push -u origin main
```

Replace the remote placeholder with the real repository URL. If the project is
already a repository, keep its existing history/remote and commit the changed
files normally. Review git status before committing; do not force-push or replace
existing work. Clone the published repository into a new directory and run:

```bash
npm ci
npm run check
npx playwright install chromium
npm run test:e2e
```

Linux and Windows baselines are included. On an additional OS, generate that OS's baselines once
with `npm run test:e2e:update`, inspect them and commit the intentional images.
Normal test runs should not regenerate snapshots automatically.

## Publish and verify

Import the repository at https://vercel.com/new. Select Vite, the directory that
contains package.json, Node.js 24.x, install `npm ci`, build `npm run build`, output
`dist`. The checked-in vercel.json supplies build settings and SPA routing. Avoid
true test/profile flags in hosting environment variables.

After publication, verify the production URL from a signed-out/fresh session and
run `npm run verify:deploy -- https://YOUR-PUBLIC-URL`. Keep the resulting verification
JSON with the reports and record the verified runtime commit. Check that menu,
options, battle, result and both list routes also work after refresh. Ranking and
history must return mocked JSON and update through the real UI. An evaluator must
be able to access the URL without a private login. Keep the deployment available
throughout evaluation; if runtime code changes, redeploy and verify it again.

## Known limitations to disclose

- Rules and rendering still share parts of GameEngine. Input, config, HTTP, map
  and health indicators are separated, but pure simulation/render separation is
  incomplete. This does not require an entity framework to improve.
- Ship collisions use circular proxies and sampled coastlines, not polygon hulls.
  Enemies can stop at islands rather than navigating around them.
- Desktop/mobile Chromium E2E is browser-based; physical mobile usability and
  assistive-technology testing remain pending.
- The software-rendered performance reference averaged 22.9 FPS, with P95 82.5 ms.
  The high-health three-minute workload is a stress scenario. The 60 FPS target
  and overall memory plateau are not established; see PERFORMANCE.md.
- Original challenge asset provenance is recorded, but its authoritative license
  text was not available. The Fredoka font license is included. Do not invent a
  license or claim that this open issue was verified.
- No estimate communicated before the original start is available in this record.
  Report an actual prior estimate only if it exists; do not invent a retrospective one.

## Suggested delivery message

Replace the placeholders and send only after completing the mandatory publication:

> Pirate Battle source: [REPOSITORY URL]
>
> Public game: [PRODUCTION URL]
>
> Verified runtime commit: [GIT SHA]
>
> Setup and reproduction commands are in README.md. Architecture and limitations
> are in ARCHITECTURE.md. The repository includes assets, fixtures, mocks, tests,
> visual baselines and curated reports under reports/. Profiling measurements and
> their reference environment are documented in PERFORMANCE.md.

The implementation must be runnable after a clean checkout using public npm
dependencies and browser mocks; no private backend or hosted API is part of it.
