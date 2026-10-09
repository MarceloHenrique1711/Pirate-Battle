# Delivery evidence

These curated files belong in Git. Generated playwright-report/, test-results/,
performance-results/ and deployment-results/ remain ignored.

- playwright-report.zip: owner-run Windows HTML report, inspected with 64 passed,
  zero unexpected/flaky/skipped tests, 32 per Chromium desktop/mobile project.
  The report includes the concurrent asset loading regression. It has no failure
  traces. ZIP path separators were normalized for portable extraction without
  modifying the report HTML. Extract and open playwright-report/index.html or
  run npx playwright show-report playwright-report in the extraction directory.
- performance-evidence.zip: unchanged step 9 checkpoint, including frame/entity
  samples, heap snapshots, CPU profile, trace and screenshots. Its reference
  averaged 22.9 FPS with P95 82.5 ms. 60 FPS and a memory plateau remain unproven.
  The later asset-loading fix was not reprofiled.
- local-production-verification.json and local-production-arena.png: earlier
  normal-build checks at a LOCAL preview URL. These are historical local evidence,
  not verification of the final public deployment.
- manifest.json: archive hashes and explicit provenance of each check. The
  Playwright result is current; earlier Linux check fields retain their scope.

Twelve visual baselines (Linux/Windows, desktop/mobile, menu/arena/result) remain
in e2e/visual.spec.ts-snapshots/. These images belong in Git with the tests.

The successful owner run used Node 24.11.1 and npm 11.7.0 on Windows. The earlier
Linux environment used a local software-rendered Chromium 153 override. The
deliverable uses standard Playwright installation. No private backend is needed.

After publication, run npm run verify:deploy -- https://YOUR-PUBLIC-URL and copy
the generated JSON here as public-deployment-verification.json. Fill SUBMISSION.md
with the repository URL, public URL and verified runtime source commit.

The cleaned review checkout passed npm run check (lint, types, 18 unit/integration
tests and normal production build) on Linux using existing installed dependencies.
No new clean install or full E2E run was claimed during this documentation review.
