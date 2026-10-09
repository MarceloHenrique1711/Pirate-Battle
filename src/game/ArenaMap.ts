import { Container, Sprite, Texture, TilingSprite } from 'pixi.js';

export const ARENA_WIDTH = 1800;
export const ARENA_HEIGHT = 1000;
const TILE_SIZE = 100;
// Tile numbers refer to the supplied tile_*.png files, not to a generated background.
export const TERRAIN_ASSETS = [6, 7, 9, 22, 23, 25, 39, 40, 54, 55, 57, 73,
  13, 15, 16, 29, 30, 31, 47, 60, 65, 66, 67, 70, 71, 72, 81, 83, 85, 87, 88];
export class ArenaMap {
  private tiles: number[][] = [];
  private alphaMasks = new Map<number, Uint8ClampedArray>();
  constructor() {
    const land = (col: number, row: number) => {
      if (col < 0 || col >= 18) return false;
      return (row <= 0 && col <= 8)
        || (row >= 1 && row <= 2 && col >= 2 && col <= 8)
        || (row >= 3 && row <= 4 && col >= 2 && col <= 6)
        || (row >= 6 && col >= 14)
        || (row >= 7 && col >= 6 && col <= 11)
        || (row >= 8 && col >= 6);
    };
    for (let row = 0; row < 10; row++) {
      const cells: number[] = [];
      for (let col = 0; col < 18; col++) {
        if (!land(col, row)) { cells.push(0); continue; }
        const top = !land(col, row - 1), bottom = !land(col, row + 1);
        const left = !land(col - 1, row), right = !land(col + 1, row);
        let tile = 23;
        if (top && left) tile = 6;
        else if (top && right) tile = 9;
        else if (bottom && left) tile = 54;
        else if (bottom && right) tile = 57;
        else if (top) tile = 7;
        else if (bottom) tile = 55;
        else if (left) tile = 22;
        else if (right) tile = 25;
        cells.push(tile);
      }
      this.tiles.push(cells);
    }
  }
  public build(world: Container, textures: Record<string, Texture>) {
    const water = new TilingSprite({ texture: textures.tile73, width: ARENA_WIDTH, height: ARENA_HEIGHT });
    water.tileScale.set(3);
    world.addChild(water);
    for (let row = 0; row < this.tiles.length; row++) {
      for (let col = 0; col < this.tiles[row].length; col++) {
        const tile = this.tiles[row][col];
        if (!tile) continue;
        const texture = textures[`tile${tile}`];
        const sprite = new Sprite(texture);
        sprite.position.set(col * TILE_SIZE, row * TILE_SIZE);
        sprite.width = sprite.height = TILE_SIZE;
        if (tile === 23) {
          // Mirror alternating grass tiles so their light/dark edges join.
          if (col % 2) { sprite.scale.x *= -1; sprite.x += TILE_SIZE; }
          if (row % 2) { sprite.scale.y *= -1; sprite.y += TILE_SIZE; }
        }
        world.addChild(sprite);
        if (!this.alphaMasks.has(tile)) {
          // Cache the tile's alpha once, so collision follows its curved beach edge.
          const canvas = document.createElement('canvas');
          canvas.width = canvas.height = 128;
          const context = canvas.getContext('2d', { willReadFrequently: true });
          if (!context) throw new Error('Could not read island collision masks.');
          context.drawImage(texture.source.resource as CanvasImageSource, 0, 0, 128, 128);
          this.alphaMasks.set(tile, context.getImageData(0, 0, 128, 128).data);
        }
      }
    }
    const decoration = (tile: number, x: number, y: number, size = 110, rotation = 0) => {
      const sprite = new Sprite(textures[`tile${tile}`]);
      sprite.anchor.set(0.5); sprite.position.set(x, y); sprite.width = sprite.height = size; sprite.rotation = rotation;
      world.addChild(sprite);
    };
    // Fortress, trees, rocks and abandoned boats use the same supplied tiles.
    [100, 250, 400, 550].forEach(x => decoration(16, x, 60, 150));
    decoration(29, 130, 60, 150); decoration(30, 375, 60, 150);
    decoration(15, 375, 170, 150); decoration(15, 625, 55, 150);
    decoration(31, 625, 65, 130); decoration(16, 500, 180, 150);
    decoration(29, 375, 185, 150); decoration(30, 625, 185, 150);
    decoration(60, 500, 185, 150);
    decoration(71, 275, 300, 130); decoration(72, 400, 440, 105);
    decoration(66, 615, 375, 125); decoration(70, 755, 65, 130);
    decoration(71, 1555, 890, 155); decoration(70, 1690, 830, 100);
    decoration(67, 1250, 945, 130); 
    
    decoration(67, 1780, 880, 110); decoration(87, 1550, 780, 75);
    const object = (key: string, x: number, y: number, width: number, height: number, rotation: number) => {
      const sprite = new Sprite(textures[key]);
      sprite.anchor.set(0.5); sprite.position.set(x, y);
      sprite.width = width; sprite.height = height; sprite.rotation = rotation;
      world.addChild(sprite);
    };
    object('dinghy', 1025, 825, 45, 75, -0.5);
    object('dinghy', 1355, 660, 35, 60, 0.6);
    object('dinghy', 1250, 610, 35, 60, -0.5);
    object('looseCannon', 1505, 665, 48, 75, -0.5);
  }
  private isLandAt(x: number, y: number): boolean {
    if (x < 0 || y < 0 || x >= ARENA_WIDTH || y >= ARENA_HEIGHT) return false;
    const col = Math.floor(x / TILE_SIZE), row = Math.floor(y / TILE_SIZE);
    const tile = this.tiles[row]?.[col];
    const pixels = this.alphaMasks.get(tile);
    if (!pixels) return false;
    const localX = Math.min(127, Math.floor((x % TILE_SIZE) / TILE_SIZE * 128));
    const localY = Math.min(127, Math.floor((y % TILE_SIZE) / TILE_SIZE * 128));
    return pixels[(localY * 128 + localX) * 4 + 3] > 40;
  }
  public collides(x: number, y: number, radius: number): boolean {
    if (this.isLandAt(x, y)) return true;
    // A small ring of samples covers the circular hull/projectile footprint.
    for (let index = 0; index < 16; index++) {
      const angle = index / 16 * Math.PI * 2;
      if (this.isLandAt(x + Math.cos(angle) * radius, y + Math.sin(angle) * radius)) return true;
    }
    return false;
  }
}
