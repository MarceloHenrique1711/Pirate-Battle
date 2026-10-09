import { getTestSetup } from '../game/testSupport';
import { isStressProfile } from '../game/performanceProfile';
export type EnemyType = 'chaser' | 'shooter';

export interface ShipConfig {
  hp: number;
  speed: number; // Pixels per active second.
  rotationSpeed: number; // Radians per active second.
  radius: number;
}
export interface GameConfig {
  gameSessionTime: number; // Seconds: 60–180.
  enemySpawnTime: number; // Seconds: 1–10.
  player: ShipConfig & {
    frontCooldown: number; sideCooldown: number; // Active milliseconds.
    frontDamage: number; sideDamage: number;
  };
  chaserEnemy: ShipConfig & { damage: number; scoreValue: number };
  shooterEnemy: ShipConfig & {
    attackRange: number; stopDistance: number; cooldown: number;
    scoreValue: number; projectileSpeed: number; projectileDamage: number;
  };
  projectiles: { speed: number; lifeTime: number; radius: number };
  spawn: { order: EnemyType[]; minDistance: number; margin: number; attempts: number };
}
export const DEFAULT_GAME_CONFIG: GameConfig = {
  gameSessionTime: 90, enemySpawnTime: 3,
  player: { hp: 100, speed: 330, rotationSpeed: 3, radius: 46,
    frontCooldown: 300, sideCooldown: 800, frontDamage: 15, sideDamage: 25 },
  chaserEnemy: { hp: 30, speed: 245, rotationSpeed: 3, radius: 44, damage: 25, scoreValue: 1 },
  shooterEnemy: { hp: 50, speed: 180, rotationSpeed: 2, radius: 44,
    attackRange: 550, stopDistance: 440, cooldown: 1500,
    scoreValue: 1, projectileSpeed: 720, projectileDamage: 10 },
  projectiles: { speed: 900, lifeTime: 1.5, radius: 8 },
  spawn: { order: ['chaser', 'shooter'], minDistance: 650, margin: 130, attempts: 40 },
};
const CONFIG_STORAGE_KEY = 'naval_arena_game_config';
function validOption(value: unknown, min: number, max: number, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max
    ? value : fallback;
}
export function loadGameConfig(): GameConfig {
  const testConfig = getTestSetup()?.config;
  if (testConfig) return structuredClone(testConfig);
  const config = structuredClone(DEFAULT_GAME_CONFIG);
  if (isStressProfile()) config.player.hp = 100000;
  try {
    const stored = JSON.parse(localStorage.getItem(CONFIG_STORAGE_KEY) || '{}');
    config.gameSessionTime = validOption(stored?.gameSessionTime, 60, 180, config.gameSessionTime);
    config.enemySpawnTime = validOption(stored?.enemySpawnTime, 1, 10, config.enemySpawnTime);
  } catch { /* Keep the fallback state. */ }
  return config;
}
export function saveGameConfig(options: Pick<GameConfig, 'gameSessionTime' | 'enemySpawnTime'>): void {
  if (!Number.isFinite(options.gameSessionTime) || options.gameSessionTime < 60 || options.gameSessionTime > 180
    || !Number.isFinite(options.enemySpawnTime) || options.enemySpawnTime < 1 || options.enemySpawnTime > 10) {
    throw new Error('Session time must be 60–180 seconds; spawn time must be 1–10 seconds.');
  }
  localStorage.setItem(CONFIG_STORAGE_KEY, JSON.stringify(options));
}

export function getConfigKey(config: GameConfig): string {
  return JSON.stringify(config);
}
