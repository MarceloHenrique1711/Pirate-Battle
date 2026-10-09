const GAME_KEYS = new Set(['KeyW', 'KeyA', 'KeyD', 'ArrowUp', 'ArrowLeft', 'ArrowRight',
  'Space', 'KeyJ', 'KeyQ', 'KeyU', 'KeyE', 'KeyO']);
export class InputManager {
  public isEnabled = true;
  private physicalKeys = new Set<string>();
  private virtualKeys = new Set<string>();
  public get keys(): Record<string, boolean> {
    const pressed: Record<string, boolean> = {};
    for (const key of this.physicalKeys) pressed[key] = true;
    for (const key of this.virtualKeys) pressed[key] = true;
    return pressed;
  }
  constructor() {
    window.addEventListener('keydown', this.handleKeyDown);
    window.addEventListener('keyup', this.handleKeyUp);
  }
  private handleKeyDown = (event: KeyboardEvent) => {
    if (!this.isEnabled || !GAME_KEYS.has(event.code)) return;
    const target = event.target as HTMLElement | null;
    if (target?.closest('input, textarea, select, button, [contenteditable="true"]')) return;
    event.preventDefault();
    this.physicalKeys.add(event.code);
  };
  private handleKeyUp = (event: KeyboardEvent) => {
    this.physicalKeys.delete(event.code);
  };
  public setVirtualKey(code: string, pressed: boolean) {
    if (!pressed) this.virtualKeys.delete(code);
    else if (this.isEnabled) this.virtualKeys.add(code);
  }
  public clearAllKeys() {
    this.physicalKeys.clear();
    this.virtualKeys.clear();
  }
  public destroy() {
    window.removeEventListener('keydown', this.handleKeyDown);
    window.removeEventListener('keyup', this.handleKeyUp);
    this.clearAllKeys();
  }
}
