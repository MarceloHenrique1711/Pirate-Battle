import { beforeEach, describe, expect, it } from 'vitest';
import { DEFAULT_GAME_CONFIG, loadGameConfig, saveGameConfig } from '../gameConfig';
beforeEach(() => localStorage.clear());
describe('Options', () => {
  it('persists the two values that the engine reads', () => {
    saveGameConfig({ gameSessionTime: 180, enemySpawnTime: 10 });
    expect(loadGameConfig().gameSessionTime).toBe(180);
    expect(loadGameConfig().enemySpawnTime).toBe(10);
  });
  it('rejects out of range values', () => {
    expect(() => saveGameConfig({ gameSessionTime: 30, enemySpawnTime: 3 })).toThrow();
    expect(() => saveGameConfig({ gameSessionTime: 60, enemySpawnTime: 0 })).toThrow();
  });
  it('recovers invalid storage and returns independent config snapshots', () => {
    localStorage.setItem('naval_arena_game_config', '{broken');
    const first = loadGameConfig();
    first.player.hp = 1;
    expect(loadGameConfig().player.hp).toBe(DEFAULT_GAME_CONFIG.player.hp);
  });
});
