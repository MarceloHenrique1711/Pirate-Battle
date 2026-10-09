import type { GameConfig } from '../types/gameConfig';

export interface EntitySample {
  time: number;
  enemies: number;
  projectiles: number;
  effects: number;
  total: number; // One player plus the dynamic entities; excludes terrain and HUD.
}

interface ProfileReport {
  config: GameConfig;
  seed: number;
  finished: boolean;
  frameIntervals: number[];
  samples: EntitySample[];
}

declare global {
  interface Window {
    __pirateProfile?: { read: () => ProfileReport };
  }
}

export const PROFILE_SEED = 20261009;
export const profilingEnabled = import.meta.env?.VITE_PROFILE === 'true';

// A separate, explicit stress scenario lets a full 180-second battle survive damage.
// It is excluded from normal builds and does not change movement, damage or collisions.
export function isStressProfile(): boolean {
  return profilingEnabled && new URLSearchParams(window.location.search).get('profile') === 'stress';
}

export class PerformanceProfile {
  private lastFrame = 0;
  private nextSample = 0;
  private report: ProfileReport;

  constructor(config: GameConfig) {
    this.report = { config: structuredClone(config), seed: PROFILE_SEED,
      finished: false, frameIntervals: [], samples: [] };
    // Expose copies of measurements only, without controls or references to Pixi objects.
    window.__pirateProfile = { read: () => structuredClone(this.report) };
  }

  record(time: number, enemies: number, projectiles: number, effects: number): void {
    const now = performance.now();
    if (this.lastFrame) this.report.frameIntervals.push(now - this.lastFrame);
    this.lastFrame = now;
    if (time >= this.nextSample) {
      this.report.samples.push({ time, enemies, projectiles, effects,
        total: 1 + enemies + projectiles + effects });
      this.nextSample = Math.floor(time) + 1;
    }
  }

  pause(): void {
    this.lastFrame = 0; // Paused wall time must not count as a slow combat frame.
  }

  finish(time: number, enemies: number, projectiles: number, effects: number): void {
    this.report.samples.push({ time, enemies, projectiles, effects,
      total: 1 + enemies + projectiles + effects });
    this.report.finished = true;
    const completed = structuredClone(this.report);
    window.__pirateProfile = { read: () => structuredClone(completed) };
  }
}
