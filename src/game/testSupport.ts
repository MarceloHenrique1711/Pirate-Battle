import type { GameConfig, EnemyType } from '../types/gameConfig';

// Available only in a build made with --mode e2e.
export interface TestSetup {
  seed: number;
  config?: GameConfig;
  player?: { x: number; y: number; rotation: number };
  enemies?: { type: EnemyType; x: number; y: number; rotation?: number }[];
}
export interface GameSnapshot {
  running: boolean; paused: boolean; timePlayed: number; timeLeft: number;
  hp: number; score: number; spawnCount: number; shotCount: number;
  player: { x: number; y: number; rotation: number };
  enemies: { type: EnemyType; x: number; y: number; rotation: number; hp: number }[];
  projectiles: { x: number; y: number; vx: number; vy: number; enemy: boolean }[];
  config: GameConfig;
}
export interface TestController {
  read: () => GameSnapshot;
  advance: (milliseconds: number) => void;
  islandAt: (x: number, y: number, radius: number) => boolean;
}
declare global {
  interface Window {
    __pirateSetup?: TestSetup;
    __pirateTest?: TestController;
  }
}
export function getTestSetup(): TestSetup | undefined {
  return import.meta.env.VITE_E2E === 'true' ? window.__pirateSetup : undefined;
}
export function seededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(1664525, state) + 1013904223) >>> 0;
    return state / 4294967296;
  };
}
