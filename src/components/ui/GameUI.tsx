import { useEffect, useState, type CSSProperties, type ReactNode } from 'react';
import { loadGameConfig, saveGameConfig } from '../../types/gameConfig';

export const UI_ASSETS = '/assets/png/retina/ui';
export function MenuScene({ children, overlay = false }: { children: ReactNode; overlay?: boolean }) {
  const [scale, setScale] = useState(() => Math.min(window.innerWidth / 1800, window.innerHeight / 1000));
  useEffect(() => {
    const resize = () => setScale(Math.min(window.innerWidth / 1800, window.innerHeight / 1000));
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, []);
  return <div className={`menu-scene${overlay ? ' menu-scene-overlay' : ''}`}>
    <div className="menu-stage" style={{ '--menu-scale': scale } as CSSProperties}>
      {children}
      <img className="brand-logo" src="/assets/logo_jungle_gaming.svg" alt="Jungle Gaming" />
    </div>
  </div>;
}
export function WoodPanel({ children, kind = 'standard', titleId, modal = false }: {
  children: ReactNode; kind?: 'main' | 'standard' | 'log' | 'help'; titleId?: string; modal?: boolean;
}) {
  return <section className={`wood-panel wood-panel-${kind}`} role={modal ? 'dialog' : undefined}
    aria-modal={modal || undefined} aria-labelledby={titleId}>{children}</section>;
}
export function AssetButton({ children, onClick, secondary = false, className = '', disabled = false }: {
  children: ReactNode; onClick: () => void; secondary?: boolean; className?: string; disabled?: boolean;
}) {
  return <button type="button" className={`asset-button${secondary ? ' asset-button-secondary' : ''} ${className}`}
    onClick={onClick} disabled={disabled}>{children}</button>;
}
export function RoundButton({ icon, label, onClick, disabled = false, className = '' }: {
  icon: string; label: string; onClick: () => void; disabled?: boolean; className?: string;
}) {
  return <button type="button" className={`round-button ${className}`} aria-label={label} disabled={disabled} onClick={onClick}>
    <img src={`${UI_ASSETS}/controls/${icon}.png`} alt="" />
  </button>;
}
export function OptionsContent({ onBack, backLabel = 'MAIN MENU' }: { onBack: () => void; backLabel?: string }) {
  const [config] = useState(loadGameConfig);
  const [session, setSession] = useState(config.gameSessionTime);
  const [spawn, setSpawn] = useState(config.enemySpawnTime);
  const [error, setError] = useState('');
  const save = () => {
    try { saveGameConfig({ gameSessionTime: session, enemySpawnTime: spawn }); onBack(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Failed to save options.'); }
  };
  return <div className="options-content">
    <h1 id="options-title">OPTIONS</h1>
    <div className="setting-block">
      <p id="session-label">Game session time</p>
      <div className="setting-controls" role="group" aria-labelledby="session-label">
        <RoundButton icon="icon_minus" label="Decrease session time" disabled={session <= 60}
          onClick={() => setSession(Math.max(60, session - 15))} />
        <output aria-live="polite">{session} s</output>
        <RoundButton icon="icon_plus" label="Increase session time" disabled={session >= 180}
          onClick={() => setSession(Math.min(180, session + 15))} />
      </div>
    </div>
    <div className="setting-block">
      <p id="spawn-label">Enemy spawn time</p>
      <div className="setting-controls" role="group" aria-labelledby="spawn-label">
        <RoundButton icon="icon_minus" label="Decrease spawn interval" disabled={spawn <= 1}
          onClick={() => setSpawn(Math.max(1, spawn - 1))} />
        <output aria-live="polite">{spawn} s</output>
        <RoundButton icon="icon_plus" label="Increase spawn interval" disabled={spawn >= 10}
          onClick={() => setSpawn(Math.min(10, spawn + 1))} />
      </div>
    </div>
    <p className="sr-only">Session: 60–180 seconds. Spawn interval: 1–10 seconds. Changes apply to new matches.</p>
    {error && <p className="ui-error" role="alert">{error}</p>}
    <AssetButton onClick={save}>{backLabel}</AssetButton>
  </div>;
}
