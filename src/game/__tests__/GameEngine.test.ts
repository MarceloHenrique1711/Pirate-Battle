import { describe, expect, it, vi } from 'vitest';
import type { Ticker } from 'pixi.js';
import { GameEngine } from '../GameEngine';
import { InputManager } from '../InputManager';
import { DEFAULT_GAME_CONFIG } from '../../types/gameConfig';

interface ClockTest {
  isRunning: boolean; timePlayed: number; timeLeft: number;
  loop: (ticker: Ticker) => void;
  handleInput: ReturnType<typeof vi.fn>; updateEnemies: ReturnType<typeof vi.fn>;
  updateProjectiles: ReturnType<typeof vi.fn>; updateEffects: ReturnType<typeof vi.fn>;
  updateDamageAppearance: ReturnType<typeof vi.fn>; drawHealthBar: ReturnType<typeof vi.fn>;
  player: { x: number; y: number };
}
function engineClock() {
  const finished = vi.fn();
  const engine = new GameEngine(DEFAULT_GAME_CONFIG, { onUIUpdate: vi.fn(), onGameOver: finished });
  engine.input = new InputManager();
  const clock = engine as unknown as ClockTest;
  clock.isRunning = true;
  clock.player = { x: 0, y: 0 };
  for (const key of ['handleInput', 'updateEnemies', 'updateProjectiles', 'updateEffects',
    'updateDamageAppearance', 'drawHealthBar'] as const) clock[key] = vi.fn();
  return { engine, clock, finished };
}
function frame(clock: ClockTest, milliseconds = 1000 / 60) {
  clock.loop({ deltaMS: milliseconds } as Ticker);
}
describe('Active clock', () => {
  it('freezes all updates while paused and clears held controls', () => {
    const { engine, clock } = engineClock();
    frame(clock);
    const before = clock.timePlayed;
    engine.input.setVirtualKey('KeyW', true);
    engine.togglePause();
    frame(clock, 200);
    expect(clock.timePlayed).toBe(before);
    expect(engine.input.keys).toEqual({});
    engine.togglePause();
    frame(clock);
    expect(clock.timePlayed).toBeCloseTo(before + 1 / 60);
    engine.destroy();
  });
  it('stops the frame immediately at time expiry and finishes once', () => {
    const { engine, clock, finished } = engineClock();
    clock.timePlayed = DEFAULT_GAME_CONFIG.gameSessionTime - 1 / 240;
    frame(clock);
    frame(clock);
    expect(finished).toHaveBeenCalledTimes(1);
    expect(clock.handleInput).not.toHaveBeenCalled();
    expect(clock.updateEnemies).not.toHaveBeenCalled();
    engine.destroy();
  });
  it('advances equally at 30 FPS and 120 FPS', () => {
    const first = engineClock(); const second = engineClock();
    for (let index = 0; index < 30; index++) frame(first.clock, 1000 / 30);
    for (let index = 0; index < 120; index++) frame(second.clock, 1000 / 120);
    expect(first.clock.timePlayed).toBeCloseTo(second.clock.timePlayed);
    first.engine.destroy(); second.engine.destroy();
  });
});
