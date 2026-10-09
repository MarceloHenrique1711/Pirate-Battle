# Architecture

## Ownership

React owns menus, options, HUD, result and pause dialogs. `GameEngine` owns the
continuous combat state: positions, health, projectiles, enemies, effects and
active match time. `InputManager` owns physical and virtual pressed keys.
TanStack Query owns ranking/history requests and registration mutations. Axios
performs HTTP calls; MSW handles them at the network boundary.

The existing engine class remains the coordinator. It also contains enemy rules
and drawing code. Input, configuration, HTTP and UI are separated, but complete
simulation/rendering separation is still a follow-up. A small renderer module
and pure collision helpers are suitable next steps; no entity framework is needed.

## Collision model and combat rules

ArenaMap builds a fixed tile grid and reads each land tile's alpha mask once.
A ship/projectile uses its configured circular collider; the map checks its center
and sixteen points around the circle against the coastline mask. This is an
approximation of the visible hull, not an oriented polygon. Ships can stop at an
island without finding a path around it; enemies do not use a pathfinding library.
Player positions are clamped by the configured radius and logical arena size.

Projectile updates advance velocity and lifetime in fixed time steps, then check
arena exit, expiry, island collision and the opposing team. A hit removes the
projectile before another target can take damage. Enemy removal destroys its ship
and health indicator and removes it from the active array/map. Chaser impact uses
that path without adding a point. Player weapon cooldowns are independent.

## Balance decisions

DEFAULT_GAME_CONFIG is the single typed balance source. Default duration is 90 s
and spawns are every 3 s, alternating both types at least 650 logical pixels from
the player. Player health is 100, forward speed 330 px/s and turn speed 3 rad/s.
Front attacks deal 15 damage with a 300 ms cooldown; each broadside projectile
deals 25 with an independent 800 ms cooldown per side. Chasers have 30 HP and cause
25 impact damage. Shooters have 50 HP, a 550 px attack range and 1500 ms cooldown;
their projectiles deal 10 damage. Player projectiles last up to 1.5 s at 900 px/s.
The player is faster than either enemy to allow escape. Destroyed enemies award
one point in the default config; there is no point for a Chaser's self-impact.
Difficulty tuning and the conservative circular collider need further review on
physical devices. The profiling-only high-health case is explicitly not gameplay
balance and its flag is disabled in the normal published build.

## Configuration

`loadGameConfig()` returns a new typed configuration snapshot. Options stores only
session and spawn times. Internal balancing lives in DEFAULT_GAME_CONFIG. The
engine clones the snapshot at construction, and a completed record stores it in
full. Changing Options affects subsequent games. Invalid stored options fall back
to defaults. The spawn order is configurable and alternates both enemy types by
default. Spawn candidates must clear islands and the configured player distance.

## Time and lifecycle

The Pixi ticker supplies elapsed milliseconds. A small accumulator divides them
into 1/120-second simulation steps. Movement is measured in pixels per second,
rotation in radians per second, projectile lifetime in seconds. Cooldowns and
spawns use elapsed active time rather than the computer's wall clock.

A single frame contributes at most 250 ms. This avoids a long catch-up loop after
a stall; it means very long main-thread stalls are not counted fully as active
simulation time. Browser blur and visibility loss pause gameplay. Pausing clears
input and the accumulator; focus alone does not resume the game. If asset loading
finishes while the document is hidden, the game starts paused.

The game checks the running flag after time expiry and after enemy updates.
Ending is guarded against repeated callbacks. Destroy removes input and resize
listeners, stops the ticker, releases scene objects and stops audio. Application
teardown waits for async Pixi initialization when necessary. React schedules the
initial engine creation with requestAnimationFrame and cancels it on cleanup;
this also supports the Strict Mode mount/unmount cycle.

## Rendering and responsiveness

The logical arena stays 1800×1000. Canvas resizing uses the smaller of the width and
height scale factors, with centered margins, preserving the full arena. Movement
bounds do not depend on viewport dimensions. HUD and controls overlay the arena and adapt to small screens. Device pixel ratio is capped at two.

Required gameplay PNGs load together through Pixi Assets, which reuses cached textures.
Passing the complete path array avoids adding every image's network/decode delay
sequentially. The returned promise gates world creation; its progress callback only
updates the loading indicator. A destroyed engine ignores progress and loaded results.
A missing required asset prevents combat and shows an error. Audio is optional.
The loader reports progress, and a separate ready callback starts the UI only
when the world has been built. Shots and impacts use brief sprite effects;
destruction cycles through three explosion sprites. Hull textures switch between intact, damaged and heavily damaged sprites as health
falls. ArenaMap assembles the supplied terrain tiles and caches their alpha masks
for coastline collisions. ShipHealthBar draws asset-based indicators independently
of ship rotation. Shared React UI components reuse the supplied panel, button and
HUD PNGs; local Fredoka fonts keep the interface consistent without font requests.
The desktop screens and active combat were inspected in Chromium.

The engine notifies React only when integer remaining time, health or score
changes. Semantic game values remain available without live announcements every
frame. Pause dialogs focus their first control and trap Tab using the currently
enabled controls. The result route focuses its first action and uses normal page
navigation. Menus expose visible keyboard focus.

## Matches, persistence and retries

There is one canonical MatchRecord contract. A completed match gets a stable UUID,
a persistent browser player ID, an ISO date, active duration, reason, score and
full config. The last completed result and outgoing queue are written before the
HTTP request. Registration goes through a TanStack Query mutation with retries.
A confirmed response removes only that match's ID from the current queue, avoiding
overwriting matches added while requests were in flight. A late UI callback is
ignored if it belongs to an earlier match.

MSW persists confirmed records locally and detects duplicate match IDs after any
request delay. Repeated submissions return the existing record. Ranking derives
one entry per confirmed match, filters by the complete config and sorts all
records before pagination. History filters by player ID. Both projections use
the same persisted database. Queries receive cancellation signals and keys
include page plus player/config identity. Registering or syncing invalidates both
query families; screens refetch on mount and focus.

Local storage is a demonstration persistence layer, not a secure server. Reset
restores fixture records but leaves pending outgoing matches intact. API errors
do not participate in or block combat. An abandoned match is never queued.

### HTTP contracts and cache

| Endpoint | Request | Response |
| --- | --- | --- |
| `GET /api/ranking` | `page`, `limit`, `configKey`, `playerId` | `PaginatedResponse<RankingRecord>` |
| `GET /api/history` | `page`, `limit`, `playerId` | `PaginatedResponse<MatchRecord>` |
| `POST /api/matches` | MatchRecord body; `X-Idempotency-Key` equals its ID | Stored MatchRecord, existing record for a repeated ID |

MatchRecord contains `id`, `playerId`, `playerName`, ISO `date`, `score`, active
`duration`, `endReason` and the full GameConfig `config`. RankingRecord adds `rank`
and `isUser`. Pagination contains `data`, `page`, `totalPages`, `totalItems`.
The Axios layer validates the pagination envelope at runtime, so a HTTP 200 with
missing list data becomes a handled query error. It does not validate every row.

Ranking keys contain configuration, player and page; history keys contain player
and page. Queries use 30 s stale time, two retries, always-refetch on mount and
refetch on window focus. Axios uses a 5000 ms timeout and query AbortSignals.
Registration uses mutations with two retries. Confirmed writes invalidate both
query families. The persistent pending queue can hold more than one match, is
written before POST and removes only the confirmed ID. Startup, online recovery
and explicit retry attempt the queue without blocking another battle.

## Validation limits

Unit/integration tests cover persisted options, invalid options, active clock,
pause input clearing, frame termination, frame-rate independence, MSW-backed
ranking, match idempotency, failed-send recovery, player/config filters and global
sorting before pagination. Clock tests stub rendering. Playwright browser tests ran against an optimized E2E build in desktop and mobile
Chromium. Visual baselines cover menu, a stable arena, and the result in both viewports.
The E2E suite additionally exercises real input, collisions, combat, seeded spawns,
ending/restart, registration recovery and late-response cancellation. TESTING.md
maps each challenge requirement to its tests. Result is a separate React route
that restores the persisted last completed record after refresh. This is a corrected working draft, not a claim
of complete challenge compliance.

## Performance measurements

The separate optimized profile build enables PerformanceProfile, a small observer
that records intervals between real active Pixi ticker callbacks and samples entity
counts once per active second. Its browser interface returns copied measurements;
it cannot move entities, apply damage or advance the clock. Pauses reset the previous
frame timestamp. On teardown only the most recent completed report remains, without
references to engine, canvas, audio or texture objects. Profiling and its explicit
high-health stress scenario are disabled in normal production builds.

The Node profiling script uses real keyboard events, Chrome CPU/timeline captures,
heap snapshots and DOM/resource counters. It warms assets before the memory baseline,
then repeats five normal combat cycles without reloading the page. Pixi's shared
texture cache is intentionally retained; application tickers, scene objects and input
listeners are destroyed on exit. PERFORMANCE.md documents the actual measurements
and their limits, including software rendering and post-GC JavaScript heap scope.
