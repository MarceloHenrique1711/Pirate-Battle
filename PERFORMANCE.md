# Combat performance

## Result

The measured reference environment did **not** reach the 60 FPS target. A real
180-second combat capture averaged **22.90 FPS**, with a **95th-percentile frame
interval of 82.50 ms**. The largest sampled dynamic entity count was **72**.
After five start/play/exit cycles, post-GC JavaScript heap rose from **7.93 to
8.82 MiB**. DOM resource counts stayed constant, but other retained objects grew.
This is a measured limitation, not a claim that the game is leak-free or reaches
60 FPS on other hardware.

## Reference environment

| Item | Recorded environment |
| --- | --- |
| Capture date | 2026-10-09 UTC |
| OS | Linux x86_64 virtual machine/container, KVM host |
| CPU | AMD EPYC 9V74 80-Core Processor; 9 exposed logical CPUs |
| Container CPU quota | Equivalent to 8 CPU cores; shared virtualized environment |
| Memory | 8 GiB container limit; OS-reported memory is included in raw JSON |
| Browser | Chromium 153.0.8010.0, headless |
| Graphics | ANGLE / Vulkan SwiftShader Device (Subzero), software renderer |
| Viewport / DPR | 1280 × 720 CSS pixels, device scale factor 1 |
| Logical arena | 1800 × 1000, fitted to the viewport without changing game coordinates |
| Build | Vite optimized, minified `--mode profile` build, served with preview |
| Build identity | `assets/index-rG3hK_NS.js`; SHA-256 in `capture-manifest.json` |
| Remote data | MSW enabled in the main capture; local gameplay does not depend on API calls |

There was no physical display or dedicated GPU available. This environment is a
reproducible software-rendering reference, not a measurement of a user's desktop
or mobile device. GPU process memory and total browser RSS were not measured.

## Combat protocol and measurements

The scenario uses seed **20261009**, duration **180 seconds**, spawn interval
**1 second**, alternating Chaser/Shooter enemies and **100000 player HP**. High
health prevents death from truncating the capture. Damage is still applied;
movement, rotation, collisions, weapons, cooldowns, enemy rules and rendering are
unchanged. This is an explicit stress configuration, not default gameplay balance.
The full configuration snapshot is stored in `combat.json` and `summary.json`.

Real keyboard events hold W, D, Space, Q and E simultaneously. The player attempts
forward movement, rotates and uses all three weapons. Collisions can block travel
and enemies can accumulate against islands. No entities are injected and no E2E
clock is used. Assets finish loading before combat timing starts.

PerformanceProfile records `performance.now()` intervals between active Pixi ticker
callbacks. This measures combat frame cadence, including the effect of previous
render work; it does not count physically presented display frames. The real Pixi
ticker and renderer remain running. Paused wall time is excluded. Entity counts
are sampled once per active second, plus the final state.

Average FPS = interval count / sum of intervals in seconds. P95 uses the nearest
rank in the sorted interval list: `ceil(count × 0.95) - 1`. The capture contains
**4137 intervals**, covering **180.65 seconds** of frame time. The game finished
at **180.00 active seconds**; the script observed completion after **181.48 wall
seconds**, including polling and result transition.

| Frame-time window | Average FPS | P95 interval |
| --- | ---: | ---: |
| Approximately 0–60 seconds | 24.25 | 78.90 ms |
| Approximately 60–120 seconds | 22.53 | 82.90 ms |
| Approximately 120–180 seconds | 21.93 | 86.00 ms |
| Entire combat | 22.90 | 82.50 ms |

The longest interval was **169.40 ms**; **3142 intervals** exceeded 33.33 ms.
The nominal 60 FPS interval budget is approximately 16.67 ms.

| Dynamic entities | Sample mean | Sample maximum | Final count |
| --- | ---: | ---: | ---: |
| Enemies | 25.88 | 48 | 46 |
| Projectiles | 8.13 | 17 | 16 |
| Effects | 2.31 | 14 | 3 |
| Total, including one player | 37.33 | 72 | 66 |

The total excludes terrain sprites, ship subparts, health indicators and React HUD
elements. Each category's maximum can occur at a different time; their maxima
must not be added to infer the maximum total. These are maxima of the 181 samples,
not guaranteed instantaneous peaks between samples.

## Five-cycle memory check

The main capture returns to the menu and switches to normal **100 HP**, **180-second
session configuration** and **3-second spawns**. A ten-second normal combat warms
assets before the baseline. Each of the five measured cycles starts a game, plays
with real inputs for twenty wall-clock seconds, pauses, exits through Main Menu,
waits two seconds and forces Chrome garbage collection. The same page/context is
kept throughout; no refresh is used to hide retained resources. Abandoned cycles
are not registered as matches.

| Completed cycles | JS heap after GC | DOM nodes | JS event listeners | Attached canvases |
| --- | ---: | ---: | ---: | ---: |
| Warmed baseline | 7.926 MiB | 75 | 184 | 0 |
| 1 | 8.155 MiB | 75 | 184 | 0 |
| 2 | 8.349 MiB | 75 | 184 | 0 |
| 3 | 8.574 MiB | 75 | 184 | 0 |
| 4 | 8.703 MiB | 75 | 184 | 0 |
| 5 | 8.822 MiB | 75 | 184 | 0 |

Documents stayed at **2**. Backing storage stayed near **1.435 MiB**. Heap increased
by **0.896 MiB**, approximately **11.3%** of the baseline. The declining increments
do not establish a plateau after only five cycles. Forced-GC values represent
retained JavaScript heap, not natural peak usage or total process/GPU memory.

### Investigation

Two heap snapshots were taken after exit: warmed baseline and cycle five. The
summary script searches object properties characteristic of GameEngine (`app`,
`enemies`, `projectiles`, `boundLoop`, `isDestroyed`); it found **zero matching engine
instances** in both snapshots. HTMLCanvasElement heap objects remained **2 → 2**,
while attached combat canvases were zero. Shared Pixi resources can intentionally
remain cached between games; their presence alone is not a leak.

Other object counts did grow:

| Snapshot category | Baseline | After five cycles |
| --- | ---: | ---: |
| Native MessagePort | 322 | 585 |
| Native MessageEvent | 227 | 410 |
| Native ReadableStream | 93 | 173 |
| Promise objects | 514 | 880 |

The self size of `system / InstructionStream` also grew by approximately **400 KiB**,
consistent with additional compiled browser code. That explains part of the
retention, but does not explain away the growing transport objects.

A second five-cycle capture requested `Network.setBypassServiceWorker` through
CDP. Heap still grew **7.41 → 8.46 MiB**, and transport counts still rose by similar
amounts. This was not a full `worker.stop()` experiment and did **not** isolate the
cause. The captures therefore do not justify attributing the growth exclusively
to MSW, audio, DevTools or gameplay. Longer captures and inspection of the growing
objects' retaining paths are still needed to distinguish bounded browser/network
retention from a persistent leak. The engine/DOM teardown checks passed; overall
memory stability has not been established.

## CPU and timeline evidence

Chrome CPU sampling and a DevTools timeline cover roughly the final fifteen
active seconds and include the result/unmount transition. The main-thread profile
contains substantial idle time, rendering/ticker callbacks, collision checks and
WebGL context teardown. It does not measure all software-renderer worker threads.
SwiftShader and virtualized scheduling are plausible contributors to frame delays;
this capture alone does not prove a single bottleneck.

Instrumentation adds timestamp writes, frame storage, one-second report reads,
two screenshots and final-window CPU/timeline recording. These costs are included
in the measurement. Only one three-minute workload capture was performed; this is
not a statistical hardware benchmark. Asset loading and initial decoding are
outside the FPS window. The large main bundle remains a loading concern, separate
from active-combat frame cadence.

## Evidence archive

`reports/performance-evidence.zip` contains the original profiling checkpoint report and:

- `combat.json`, `frames.csv`, `entities.csv` and `summary.json`: raw observations,
  complete config and computed metrics.
- `combat-last-15s.cpuprofile`: load using Chrome DevTools JavaScript Profiler.
- `combat-last-15s.trace.json`: load using Chrome DevTools Performance.
- `memory-baseline.heapsnapshot` and `memory-after-five-cycles.heapsnapshot`: load
  using Chrome DevTools Memory and compare retained objects.
- `memory.json`, `heap-investigation.json`, `engine-retention-check.json`: memory
  counters and heap investigation.
- `network-isolation/`: the inconclusive CDP bypass comparison captures.
- `combat-90s.png`, `menu-after-five-cycles.png`, `performance-overview.png`:
  visual evidence and measured charts.
- `capture-manifest.json` and `normal-production-smoke.json`: build/environment
  identity and verification that normal production exposes neither profiling nor
  E2E controls and keeps the normal health/config behavior.

No page runtime errors were observed in the measured runs.

## Reproduce and delivery status

```bash
npm ci
npx playwright install chromium
npm run profile
npm run profile:summary
```

This creates an optimized profile build, starts preview automatically and writes
captures to `performance-results/`. It takes roughly five minutes. Node scripts
use the existing Playwright dependency; no new package was added. For Windows,
use PowerShell `$env:PROFILE_HEADED = "true"` before `npm run profile` to measure
with a visible, foreground browser. Keep it focused; automatic pause remains active.
Document that machine's CPU, RAM, GPU, browser and display/viewport in a new result.
Linux results must not be presented as results from that machine.

Commit PERFORMANCE.md, README.md, ARCHITECTURE.md, the scripts and source changes.
The generated `performance-results/` directory is ignored; the curated evidence
archive is versioned in `reports/` for this delivery. Normal publication uses `npm run build`, which disables the
profiling observer and high-health scenario. No `docs` directory is required.

Step 9's measurements and evidence are delivered. **The 60 FPS target and overall
memory plateau remain unproven**. Repeat on a foreground browser with hardware GPU
acceleration, then investigate the growing transport objects and optimize the
confirmed bottleneck before claiming those goals are met.

The subsequent concurrent asset-loading fix was validated through E2E tests.
It was not reprofiled. The measurements above identify the older profile build;
they must not be relabeled as a new measurement of the current source.
