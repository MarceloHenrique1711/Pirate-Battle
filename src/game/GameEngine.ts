import * as PIXI from 'pixi.js';
import type { GameConfig, EnemyType } from '../types/gameConfig';
import type { EndReason } from '../types/history';
import { ArenaMap, ARENA_WIDTH, ARENA_HEIGHT, TERRAIN_ASSETS } from './ArenaMap';
import { createShipHealthBar, updateShipHealthBar, type ShipHealthBar } from './ShipHealthBar';
import { InputManager } from './InputManager';
import { getTestSetup, seededRandom, type GameSnapshot } from './testSupport';
import { PerformanceProfile, profilingEnabled, PROFILE_SEED } from './performanceProfile';

export interface GameCallbacks {
  onUIUpdate: (hp: number, score: number, timeLeft: number) => void;
  onGameOver: (score: number, timePlayed: number, reason: EndReason) => void;
  onReady?: () => void;
  onLoadProgress?: (progress: number) => void;
  onError?: (errorMessage: string) => void;
}

interface Projectile {
  sprite: PIXI.Sprite; trail: PIXI.Graphics; x: number; y: number; vx: number; vy: number;
  life: number; maxLife: number; radius: number; isEnemy: boolean; damage: number;
}
interface Enemy {
  type: EnemyType; sprite: PIXI.Container; hpBar: ShipHealthBar;
  x: number; y: number; hp: number; radius: number; scoreValue: number; lastShot: number;
}
interface Effect { sprite: PIXI.Sprite; age: number; duration: number; explosion: boolean }
export class GameEngine {
  private app!: PIXI.Application;
  private testSetup = getTestSetup();
  private random = this.testSetup ? seededRandom(this.testSetup.seed)
    : profilingEnabled ? seededRandom(PROFILE_SEED) : Math.random;
  private profile?: PerformanceProfile;
  private shotCount = 0;
  public input!: InputManager;
  private config: GameConfig;
  private callbacks: GameCallbacks;

  private isRunning = false;
  private isPaused = false;
  private isDestroyed = false;


  private pixiInitialized = false;
  private pixiDestroyed = false;
  private timePlayed = 0;
  private timeLeft: number;
  private score = 0;
  private playerHp: number;
  private lastSpawnTime = 0;

  private player!: PIXI.Container;
  private playerHpBar!: ShipHealthBar;
  private projectiles: Projectile[] = [];
  private enemies: Enemy[] = [];
  private effects: Effect[] = [];
  private spawnIndex = 0;
  private accumulator = 0;
  private readonly fixedStep = 1 / 120;
  private map = new ArenaMap();
  private shipTypes = new Map<PIXI.Container, string>();

  private textures: Record<string, PIXI.Texture> = {};
  private sounds: Record<string, HTMLAudioElement> = {};

  private world!: PIXI.Container;
  private waterBackground!: PIXI.TilingSprite;

  private readonly ARENA_WIDTH = ARENA_WIDTH;
  private readonly ARENA_HEIGHT = ARENA_HEIGHT;
  private cameraScale = 1;

  private lastFrontShot = -Infinity;
  private lastLeftShot = -Infinity;
  private lastRightShot = -Infinity;
  private lastUI = { hp: -1, score: -1, timeLeft: -1 };

  private boundLoop: (ticker: PIXI.Ticker) => void;

  constructor(config: GameConfig, callbacks: GameCallbacks) {
    this.config = structuredClone(config);
    this.callbacks = callbacks;
    this.playerHp = config.player.hp;
    this.timeLeft = config.gameSessionTime;

    this.boundLoop = this.loop.bind(this);
  }

  public async init(container: HTMLDivElement): Promise<void> {
    try {
      this.app = new PIXI.Application();
      await this.app.init({
        width: this.ARENA_WIDTH, height: this.ARENA_HEIGHT,
        backgroundColor: 0x0ea5e9,
        resolution: Math.min(window.devicePixelRatio || 1, 2), autoDensity: true,
      });

      this.pixiInitialized = true;


      if (this.isDestroyed) {
        this.destroyPixiApp();
        return;
      }

      container.appendChild(this.app.canvas);
      this.input = new InputManager();

      this.waterBackground = new PIXI.TilingSprite({ texture: PIXI.Texture.EMPTY, width: this.ARENA_WIDTH, height: this.ARENA_HEIGHT });
      this.app.stage.addChild(this.waterBackground);
      this.world = new PIXI.Container();
      this.app.stage.addChild(this.world);

      await this.loadAssets();
      
      if (this.isDestroyed) {
        this.destroyPixiApp();
        return;
      }

      this.buildWorld();

      this.handleResize = this.handleResize.bind(this);
      window.addEventListener('resize', this.handleResize);
      this.handleResize();

      this.app.ticker.add(this.boundLoop);
      this.isRunning = true;
      if (profilingEnabled) this.profile = new PerformanceProfile(this.config);
      if (this.testSetup) {
        this.app.ticker.stop();
        window.__pirateTest = {
          read: () => this.snapshot(),
          advance: milliseconds => {
            if (!Number.isFinite(milliseconds) || milliseconds < 0 || milliseconds > 180000) {
              throw new Error('Advance must be between 0 and 180000 milliseconds.');
            }
            // The same loop, input, collisions and rules as the normal Pixi ticker.
            const steps = Math.ceil(milliseconds / (1000 / 120));
            for (let index = 0; index < steps; index++) {
              this.loop({ deltaMS: milliseconds / steps } as PIXI.Ticker);
            }
            if (!this.isDestroyed) this.app.renderer.render(this.app.stage);
          },
          islandAt: (x, y, radius) => this.checkIslandCollision(x, y, radius),
        };
        this.app.renderer.render(this.app.stage);
      }
      this.notifyUI();
      this.callbacks.onReady?.();

      if (this.sounds.bgm) {
        this.sounds.bgm.play().catch(() => {});
      }
    } catch (error) {


      if (this.isDestroyed) {
        this.destroyPixiApp();
        return;
      }
      console.error('Game initialization failed:', error);
      this.destroy();
      if (this.callbacks.onError) {
        this.callbacks.onError(error instanceof Error ? error.message : 'Failed to initialize the game.');
      }
    }
  }

  private async loadAssets() {
    const assets: string[][] = [
      ['player0', '/assets/png/retina/ships/ship_2.png'],
      ['player1', '/assets/png/retina/ships/ship_8.png'],
      ['player2', '/assets/png/retina/ships/ship_14.png'],
      ['chaser0', '/assets/png/retina/ships/ship_3.png'],
      ['chaser1', '/assets/png/retina/ships/ship_9.png'],
      ['chaser2', '/assets/png/retina/ships/ship_15.png'],
      ['shooter0', '/assets/png/retina/ships/ship_5.png'],
      ['shooter1', '/assets/png/retina/ships/ship_11.png'],
      ['shooter2', '/assets/png/retina/ships/ship_17.png'],
      ['cannon', '/assets/png/retina/ship_parts/cannon.png'],
      ['dinghy', '/assets/png/retina/ships/dinghy_small_1.png'],
      ['looseCannon', '/assets/png/retina/ship_parts/cannon_loose.png'],
      ['projectile', '/assets/png/retina/ship_parts/cannon_ball.png'],
      ['explosion0', '/assets/png/retina/effects/explosion_1.png'],
      ['explosion1', '/assets/png/retina/effects/explosion_2.png'],
      ['explosion2', '/assets/png/retina/effects/explosion_3.png'],
      ['flash', '/assets/png/retina/effects/fire_1.png'],
      ['healthFrame', '/assets/png/retina/ui/hud/enemy_health_frame.png'],
      ['healthGreen', '/assets/png/retina/ui/hud/enemy_health_fill_green.png'],
      ['healthRed', '/assets/png/retina/ui/hud/enemy_health_fill_red.png'],
      ...TERRAIN_ASSETS.map(tile => [`tile${tile}`, `/assets/png/retina/tiles/tile_${tile}.png`]),
    ];
    const paths = assets.map(([, path]) => path);
    const loadedTextures = await PIXI.Assets.load<PIXI.Texture>(paths, (progress) => {
      if (!this.isDestroyed) {
        this.callbacks.onLoadProgress?.(Math.round(progress * 100));
      }
    });
    if (this.isDestroyed) return;
    for (const [key, path] of assets) {
      this.textures[key] = loadedTextures[path];
    }
    this.loadAudio('bgm', '/assets/sounds/ocean_ambience_loop.wav', true, 0.25);
    this.loadAudio('shoot', '/assets/sounds/cannon_fire_1.wav', false, 0.4);
    this.loadAudio('explosion', '/assets/sounds/ship_explosion_1.wav', false, 0.5);
    this.loadAudio('gameOver', '/assets/sounds/game_over.wav', false, 0.6);
  }
  private loadAudio(key: string, path: string, loop = false, volume = 0.5) {
    try {
      const audio = new Audio(path);
      audio.loop = loop;
      audio.volume = volume;
      this.sounds[key] = audio;
    } catch (e) {
      console.warn(`Audio ${path} could not be loaded.`, e);
    }
  }

  private createShip(type: string): PIXI.Container {
    const ship = new PIXI.Container();
    const hull = new PIXI.Sprite(this.textures[`${type}0`]);
    hull.anchor.set(0.5);
    hull.width = 108; hull.height = 184;
    const cannon = new PIXI.Sprite(this.textures.cannon);
    cannon.anchor.set(0.5); cannon.position.set(0, -62);
    cannon.width = 25; cannon.height = 48;
    ship.addChild(hull, cannon);
    this.shipTypes.set(ship, type);
    return ship;
  }
  private buildWorld() {
    if (this.isDestroyed) return;
    this.waterBackground.texture = this.textures.tile73;
    this.waterBackground.tileScale.set(3);
    this.map.build(this.world, this.textures);
    this.player = this.createShip('player');
    const start = this.testSetup?.player || { x: 820, y: 400, rotation: 0.3 };
    this.player.position.set(start.x, start.y);
    this.player.rotation = start.rotation;
    this.world.addChild(this.player);
    this.playerHpBar = createShipHealthBar(this.textures, true);
    this.world.addChild(this.playerHpBar.container);
    this.drawHealthBar(this.playerHpBar, this.player.x, this.player.y, this.playerHp, this.config.player.hp);
    for (const enemy of this.testSetup?.enemies || []) {
      this.createEnemy(enemy.type, enemy.x, enemy.y, enemy.rotation || 0);
    }
  }

  private handleResize() {
    if (this.isDestroyed || !this.app || !this.world) return;
    const canvas = this.app.canvas;
    const parent = canvas?.parentElement;
    if (!parent) return;

    const width = Math.max(1, parent.clientWidth);
    const height = Math.max(1, parent.clientHeight);
    this.cameraScale = Math.min(width / this.ARENA_WIDTH, height / this.ARENA_HEIGHT);
    this.app.renderer.resize(width, height);
    this.waterBackground.width = width;
    this.waterBackground.height = height;
    this.waterBackground.tileScale.set(3 * this.cameraScale);
    canvas.style.display = 'block';
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    this.world.scale.set(this.cameraScale);
    this.world.position.set((width - this.ARENA_WIDTH * this.cameraScale) / 2,
      (height - this.ARENA_HEIGHT * this.cameraScale) / 2);
  }

  public togglePause(): boolean {
    if (!this.isRunning || this.isDestroyed) return this.isPaused;
    this.isPaused = !this.isPaused;
    this.profile?.pause();
    this.input?.clearAllKeys();
    this.accumulator = 0;
    if (this.input) this.input.isEnabled = !this.isPaused;

    if (this.sounds.bgm) {
      if (this.isPaused) this.sounds.bgm.pause();
      else this.sounds.bgm.play().catch(() => {});
    }

    return this.isPaused;
  }

  private playSound(key: string) {
    if (this.isDestroyed) return;
    const audio = this.sounds[key];
    if (audio) {
      audio.currentTime = 0;
      audio.play().catch(() => {});
    }
  }

  private loop(ticker: PIXI.Ticker) {
    if (!this.isRunning || this.isPaused || this.isDestroyed) return;
    this.profile?.record(this.timePlayed, this.enemies.length, this.projectiles.length, this.effects.length);
    // Split elapsed time into small steps to keep movement and collisions stable.
    this.accumulator += Math.min(ticker.deltaMS / 1000, 0.25);
    while (this.accumulator >= this.fixedStep && this.isRunning) {
      this.accumulator -= this.fixedStep;
      this.updateTime(this.fixedStep * 1000);
      if (!this.isRunning) break;
      // This clock advances only while playing, so pause also freezes cooldowns.
      const now = this.timePlayed * 1000; // Active game clock: pauses freeze cooldowns and spawns.
      this.handleInput(this.fixedStep, now);
      this.updateEnemies(this.fixedStep, now);
      if (!this.isRunning) break;
      this.updateProjectiles(this.fixedStep);
      if (!this.isRunning) break;
      this.updateEffects(this.fixedStep);
    }
    if (!this.isRunning) return;
    this.updateDamageAppearance(this.player, this.playerHp, this.config.player.hp);
    this.drawHealthBar(this.playerHpBar, this.player.x, this.player.y, this.playerHp, this.config.player.hp);
    this.notifyUI();
  }

  private updateTime(deltaMS: number) {
    this.timePlayed = Math.min(this.config.gameSessionTime, this.timePlayed + deltaMS / 1000);
    this.timeLeft = Math.max(0, this.config.gameSessionTime - this.timePlayed);

    if (this.timeLeft <= 0) this.endGame('time_up');
  }

  private handleInput(timeScale: number, now: number) {
    if (!this.input || !this.input.isEnabled) return;
    const keys = this.input.keys;
    const cfg = this.config.player;

    if (keys['KeyA'] || keys['ArrowLeft']) this.player.rotation -= cfg.rotationSpeed * timeScale;
    if (keys['KeyD'] || keys['ArrowRight']) this.player.rotation += cfg.rotationSpeed * timeScale;

    if (keys['KeyW'] || keys['ArrowUp']) {
      const nextX = this.player.x + Math.sin(this.player.rotation) * cfg.speed * timeScale;
      const nextY = this.player.y - Math.cos(this.player.rotation) * cfg.speed * timeScale;

      const clampedX = Math.max(cfg.radius, Math.min(this.ARENA_WIDTH - cfg.radius, nextX));
      const clampedY = Math.max(cfg.radius, Math.min(this.ARENA_HEIGHT - cfg.radius, nextY));

      if (!this.checkIslandCollision(clampedX, clampedY, cfg.radius)) {
        this.player.x = clampedX;
        this.player.y = clampedY;
      }
    }

    if (keys['Space'] || keys['KeyJ']) this.fireFrontal(now);
    if (keys['KeyQ'] || keys['KeyU']) this.fireBroadside('left', now);
    if (keys['KeyE'] || keys['KeyO']) this.fireBroadside('right', now);
  }

  private fireFrontal(now: number) {
    const cfg = this.config;
    if (now - this.lastFrontShot < cfg.player.frontCooldown) return;
    this.lastFrontShot = now;

    this.playSound('shoot');
    const dirX = Math.sin(this.player.rotation);
    const dirY = -Math.cos(this.player.rotation);

    this.spawnProjectile(
      this.player.x + dirX * 95,
      this.player.y + dirY * 95,
      dirX * cfg.projectiles.speed,
      dirY * cfg.projectiles.speed,
      false,
      cfg.player.frontDamage
    );
  }

  private fireBroadside(side: 'left' | 'right', now: number) {
    const cfg = this.config;
    if (side === 'left' && now - this.lastLeftShot < cfg.player.sideCooldown) return;
    if (side === 'right' && now - this.lastRightShot < cfg.player.sideCooldown) return;

    if (side === 'left') this.lastLeftShot = now;
    else this.lastRightShot = now;

    this.playSound('shoot');
    const dirX = Math.sin(this.player.rotation);
    const dirY = -Math.cos(this.player.rotation);
    const sideDir = side === 'right' ? 1 : -1;
    const sideX = Math.cos(this.player.rotation) * sideDir;
    const sideY = Math.sin(this.player.rotation) * sideDir;

    [-42, 0, 42].forEach((offset) => {
      this.spawnProjectile(
        this.player.x + dirX * offset + sideX * 48,
        this.player.y + dirY * offset + sideY * 48,
        sideX * cfg.projectiles.speed,
        sideY * cfg.projectiles.speed,
        false,
        cfg.player.sideDamage
      );
    });
  }

  private spawnProjectile(x: number, y: number, vx: number, vy: number, isEnemy: boolean, damage: number) {
    if (this.isDestroyed || !this.isRunning) return;
    this.shotCount++;
    this.addEffect(x, y, false);
    const sprite = new PIXI.Sprite(this.textures.projectile);
    sprite.anchor.set(0.5);
    sprite.width = sprite.height = 20;
    const trail = new PIXI.Graphics();
    this.world.addChild(trail);
    sprite.x = x;
    sprite.y = y;
    this.world.addChild(sprite);

    this.projectiles.push({
      sprite,
      trail,
      x,
      y,
      vx,
      vy,
      life: 0,
      maxLife: this.config.projectiles.lifeTime,
      radius: this.config.projectiles.radius,
      isEnemy,
      damage,
    });
  }

  private updateEnemies(timeScale: number, now: number) {
    if (now - this.lastSpawnTime >= this.config.enemySpawnTime * 1000) {
      this.lastSpawnTime = now;
      this.spawnEnemy();
    }

    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const enemy = this.enemies[i];
      if (!this.isRunning) break;
      if (!enemy || this.isDestroyed) continue;

      const cfg = enemy.type === 'chaser' ? this.config.chaserEnemy : this.config.shooterEnemy;

      const angleToPlayer = Math.atan2(this.player.y - enemy.y, this.player.x - enemy.x) + Math.PI / 2;
      const difference = Math.atan2(Math.sin(angleToPlayer - enemy.sprite.rotation), Math.cos(angleToPlayer - enemy.sprite.rotation));
      const turn = cfg.rotationSpeed * timeScale;
      enemy.sprite.rotation += Math.max(-turn, Math.min(turn, difference));
      const moveAngle = enemy.sprite.rotation;

      const dist = Math.hypot(this.player.x - enemy.x, this.player.y - enemy.y);

      if (enemy.type === 'chaser') {
        const nextX = enemy.x + Math.sin(moveAngle) * cfg.speed * timeScale;
        const nextY = enemy.y - Math.cos(moveAngle) * cfg.speed * timeScale;

        if (!this.checkIslandCollision(nextX, nextY, cfg.radius)) {
          enemy.x = nextX;
          enemy.y = nextY;
          enemy.sprite.x = nextX;
          enemy.sprite.y = nextY;
        }

        if (dist < cfg.radius + this.config.player.radius) {
          this.damagePlayer(this.config.chaserEnemy.damage);
          this.removeEnemy(i);
          continue;
        }
      } else {
        const sCfg = this.config.shooterEnemy;
        if (dist > sCfg.stopDistance) {
          const nextX = enemy.x + Math.sin(moveAngle) * cfg.speed * timeScale;
          const nextY = enemy.y - Math.cos(moveAngle) * cfg.speed * timeScale;
          if (!this.checkIslandCollision(nextX, nextY, cfg.radius)) {
            enemy.x = nextX;
            enemy.y = nextY;
            enemy.sprite.x = nextX;
            enemy.sprite.y = nextY;
          }
        }
        if (dist <= sCfg.attackRange && now - enemy.lastShot > sCfg.cooldown) {
          enemy.lastShot = now;
          this.playSound('shoot');
          this.spawnProjectile(
            enemy.x + Math.sin(angleToPlayer) * 95,
            enemy.y - Math.cos(angleToPlayer) * 95,
            Math.sin(angleToPlayer) * sCfg.projectileSpeed,
            -Math.cos(angleToPlayer) * sCfg.projectileSpeed,
            true,
            sCfg.projectileDamage
          );
        }
      }

      this.updateDamageAppearance(enemy.sprite, enemy.hp, cfg.hp);
      this.drawHealthBar(enemy.hpBar, enemy.x, enemy.y, enemy.hp, cfg.hp);
    }
  }

  private updateProjectiles(timeScale: number) {
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const p = this.projectiles[i];
      if (!this.isRunning) break;
      if (!p || this.isDestroyed) continue;

      p.x += p.vx * timeScale;
      p.y += p.vy * timeScale;
      p.life += timeScale;
      const length = Math.hypot(p.vx, p.vy) || 1;
      p.trail.clear().moveTo(p.x - p.vx / length * 65, p.y - p.vy / length * 65)
        .lineTo(p.x, p.y).stroke({ width: 4, color: 0xe3f8ff, alpha: 0.55 });
      
      if (!p.sprite.destroyed) {
        p.sprite.x = p.x;
        p.sprite.y = p.y;
      }

      let remove = p.x < 0 || p.x > this.ARENA_WIDTH || p.y < 0 || p.y > this.ARENA_HEIGHT || p.life >= p.maxLife;

      if (!remove && this.checkIslandCollision(p.x, p.y, p.radius)) remove = true;

      if (!remove && !p.isEnemy) {
        for (let j = this.enemies.length - 1; j >= 0; j--) {
          const enemy = this.enemies[j];
          if (Math.hypot(p.x - enemy.x, p.y - enemy.y) < enemy.radius + p.radius) {
            enemy.hp -= p.damage;
            this.addEffect(enemy.x, enemy.y, false);
            remove = true;
            if (enemy.hp <= 0) {
              this.score += enemy.scoreValue;
              this.playSound('explosion');
              this.removeEnemy(j);
            }
            break;
          }
        }
      }

      if (!remove && p.isEnemy && Math.hypot(p.x - this.player.x, p.y - this.player.y) < this.config.player.radius + p.radius) {
        this.damagePlayer(p.damage);
        remove = true;
      }

      if (remove) {
        p.sprite.destroy();
        p.trail.destroy();
        this.projectiles.splice(i, 1);
      }
    }
  }

  private spawnEnemy() {
    if (this.isDestroyed) return;
    const type = this.config.spawn.order[this.spawnIndex % this.config.spawn.order.length] || 'chaser';
    let x = 0, y = 0, valid = false;
    for (let i = 0; i < this.config.spawn.attempts && !valid; i++) {
      const margin = this.config.spawn.margin;
      x = this.random() * (this.ARENA_WIDTH - margin * 2) + margin;
      y = this.random() * (this.ARENA_HEIGHT - margin * 2) + margin;
      if (Math.hypot(x - this.player.x, y - this.player.y) > this.config.spawn.minDistance && !this.checkIslandCollision(x, y, Math.max(this.config.chaserEnemy.radius, this.config.shooterEnemy.radius))) valid = true;
    }
    if (!valid) return;
    this.spawnIndex++;

    this.createEnemy(type, x, y);
  }

  private createEnemy(type: EnemyType, x: number, y: number, rotation = 0) {
    const cfg = type === 'chaser' ? this.config.chaserEnemy : this.config.shooterEnemy;
    const sprite = this.createShip(type);
    sprite.rotation = rotation;


    sprite.x = x;
    sprite.y = y;

    const hpBar = createShipHealthBar(this.textures, false);
    this.world.addChild(sprite);
    this.world.addChild(hpBar.container);

    this.drawHealthBar(hpBar, x, y, cfg.hp, cfg.hp);
    this.enemies.push({ type, sprite, hpBar, x, y, hp: cfg.hp, radius: cfg.radius, scoreValue: cfg.scoreValue, lastShot: this.timePlayed * 1000 });
  }

  private checkIslandCollision(x: number, y: number, radius: number) {
    return this.map.collides(x, y, radius);
  }

  private removeEnemy(index: number) {
    const enemy = this.enemies[index];
    if (!enemy) return;
    this.addEffect(enemy.x, enemy.y, true);
    this.playSound('explosion');
    enemy.sprite.destroy({ children: true });
    enemy.hpBar.container.destroy({ children: true });
    this.shipTypes.delete(enemy.sprite);
    this.enemies.splice(index, 1);
  }

  private damagePlayer(amount: number) {
    if (!this.isRunning) return;
    this.addEffect(this.player.x, this.player.y, false);
    this.playerHp = Math.max(0, this.playerHp - amount);
    if (this.playerHp <= 0) this.endGame('player_destroyed');
  }

  private drawHealthBar(bar: ShipHealthBar, x: number, y: number, hp: number, maxHp: number) {
    if (this.isDestroyed || bar.container.destroyed) return;
    updateShipHealthBar(bar, x, y, hp, maxHp);
  }
  private updateDamageAppearance(ship: PIXI.Container, hp: number, maxHp: number) {
    const ratio = hp / maxHp;
    const hull = ship.children[0] as PIXI.Sprite;
    const frame = ratio > 0.65 ? 0 : ratio > 0.3 ? 1 : 2;
    hull.texture = this.textures[`${this.shipTypes.get(ship)}${frame}`];
    hull.width = 108; hull.height = 184;
    hull.tint = ratio < 0.3 ? 0xbaaaa0 : 0xffffff;
  }
  private addEffect(x: number, y: number, explosion: boolean) {
    const sprite = new PIXI.Sprite(this.textures[explosion ? 'explosion0' : 'flash']);
    sprite.anchor.set(0.5);
    sprite.position.set(x, y);
    sprite.width = sprite.height = explosion ? 180 : 45;
    this.world.addChild(sprite);
    this.effects.push({ sprite, age: 0, duration: explosion ? 0.45 : 0.12, explosion });
  }
  private updateEffects(seconds: number) {
    for (let i = this.effects.length - 1; i >= 0; i--) {
      const effect = this.effects[i];
      effect.age += seconds;
      if (effect.age >= effect.duration) {
        effect.sprite.destroy();
        this.effects.splice(i, 1);
      } else {
        if (effect.explosion) {
          effect.sprite.texture = this.textures[`explosion${Math.min(2, Math.floor(effect.age / 0.15))}`];
          effect.sprite.width = effect.sprite.height = 180;
        }
        effect.sprite.alpha = 1 - effect.age / effect.duration;
      }
    }
  }

  private notifyUI() {
    if (this.isDestroyed) return;
    const timeFloored = Math.ceil(this.timeLeft);
    if (this.lastUI.hp !== this.playerHp || this.lastUI.score !== this.score || this.lastUI.timeLeft !== timeFloored) {
      this.callbacks.onUIUpdate(this.playerHp, this.score, timeFloored);
      this.lastUI = { hp: this.playerHp, score: this.score, timeLeft: timeFloored };
    }
  }

  private endGame(reason: EndReason) {
    if (this.isDestroyed || !this.isRunning) return;
    this.isRunning = false;
    this.input?.clearAllKeys();
    this.notifyUI();
    if (this.input) this.input.isEnabled = false;
    this.playSound('gameOver');
    this.callbacks.onGameOver(this.score, this.timePlayed, reason);
  }



  private snapshot(): GameSnapshot {
    return {
      running: this.isRunning, paused: this.isPaused, timePlayed: this.timePlayed,
      timeLeft: this.timeLeft, hp: this.playerHp, score: this.score,
      spawnCount: this.spawnIndex, shotCount: this.shotCount,
      player: { x: this.player.x, y: this.player.y, rotation: this.player.rotation },
      enemies: this.enemies.map(enemy => ({ type: enemy.type, x: enemy.x, y: enemy.y,
        rotation: enemy.sprite.rotation, hp: enemy.hp })),
      projectiles: this.projectiles.map(p => ({ x: p.x, y: p.y, vx: p.vx, vy: p.vy, enemy: p.isEnemy })),
      config: structuredClone(this.config),
    };
  }

  private destroyPixiApp(): void {
    if (!this.pixiInitialized || this.pixiDestroyed || !this.app) return;

    this.pixiDestroyed = true;
    const app = this.app;

    try {
      app.ticker?.stop();
      app.ticker?.remove(this.boundLoop);
    } catch (e) {
      console.warn('Failed to stop the Pixi ticker:', e);
    }

    try {
      app.destroy(true, { children: true });
    } catch (e) {
      console.warn('Failed to destroy graphics:', e);
    }
  }


  public destroy() {
    if (this.isDestroyed) return;
    this.profile?.finish(this.timePlayed, this.enemies.length, this.projectiles.length, this.effects.length);
    this.profile = undefined;
    
    this.isRunning = false;
    if (this.testSetup && this.player) {
      const finalState = this.snapshot();
      window.__pirateTest = { read: () => structuredClone(finalState), advance: () => {}, islandAt: () => false };
    }
    this.isDestroyed = true;
    window.removeEventListener('resize', this.handleResize);
    
    if (this.input) {
      this.input.destroy();
    }

    Object.values(this.sounds).forEach((audio) => {
      audio.pause();
      audio.currentTime = 0;
    });

    this.destroyPixiApp();
  }
}
