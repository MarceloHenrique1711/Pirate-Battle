import { Container, Graphics, Sprite, type Texture } from 'pixi.js';
export interface ShipHealthBar { container: Container; fill: Sprite; mask: Graphics }
export function createShipHealthBar(textures: Record<string, Texture>, friendly: boolean): ShipHealthBar {
  const container = new Container();
  const frame = new Sprite(textures.healthFrame);
  const fill = new Sprite(textures[friendly ? 'healthGreen' : 'healthRed']);
  const mask = new Graphics();
  frame.width = fill.width = 110;
  frame.height = fill.height = 27.5;
  fill.mask = mask;
  container.addChild(frame, fill, mask);
  return { container, fill, mask };
}
export function updateShipHealthBar(bar: ShipHealthBar, x: number, y: number, hp: number, maxHp: number) {
  bar.container.position.set(x - 55, y - 120);
  const ratio = Math.max(0, Math.min(1, hp / maxHp));
  // Atlas fill_rect: x=24, y=12, w=112, h=15 in a logical 160×40 sprite.
  bar.mask.clear().rect(24 / 160 * 110, 12 / 40 * 27.5, 112 / 160 * 110 * ratio, 15 / 40 * 27.5).fill(0xffffff);
}
