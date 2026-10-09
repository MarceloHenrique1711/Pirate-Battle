import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AssetButton, MenuScene, RoundButton, WoodPanel } from '../components/ui/GameUI';

export default function MainMenu() {
  const navigate = useNavigate();
  const [showHelp, setShowHelp] = useState(false);
  const [name, setName] = useState(() => localStorage.getItem('naval_arena_player_name') || 'Captain');
  const dialogRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (showHelp) {
      const previousFocus = document.activeElement as HTMLElement | null;
      dialogRef.current?.querySelector<HTMLInputElement>('input')?.focus();
      return () => previousFocus?.focus();
    }
  }, [showHelp]);
  return <MenuScene>
    <WoodPanel kind="main">
      <img className="main-title" src="/assets/png/retina/ui/menu/title_pirate_battle.png" alt="Pirate Battle" />
      <p className="main-tagline">SET SAIL. TAKE COMMAND.</p>
      <div className="main-actions">
        <AssetButton onClick={() => navigate('/arena')}>PLAY</AssetButton>
        <AssetButton onClick={() => navigate('/options')}>OPTIONS</AssetButton>
      </div>
      <img className="main-ship" src="/assets/png/retina/ships/ship_2.png" alt="Pirate ship" />
      <p className="main-caption">Navigate the islands. Survive the battle.</p>
      <nav className="main-tabs" aria-label="Captain's log">
        <AssetButton secondary onClick={() => navigate('/ranking')}>RANKING</AssetButton>
        <AssetButton secondary onClick={() => navigate('/history')}>MATCH HISTORY</AssetButton>
      </nav>
    </WoodPanel>
    <div className="menu-help-trigger"><RoundButton icon="icon_settings" label="Captain name and controls" onClick={() => setShowHelp(true)} /></div>
    {showHelp && <WoodPanel kind="help" modal titleId="help-title">
      <div className="help-content" ref={dialogRef} onKeyDown={event => {
        if (event.key === 'Escape') setShowHelp(false);
        if (event.key !== 'Tab') return;
        const items = dialogRef.current?.querySelectorAll<HTMLElement>('input, button');
        if (!items?.length) return;
        const first = items[0], last = items[items.length - 1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
      }}>
        <h1 id="help-title">CAPTAIN & CONTROLS</h1>
        <label htmlFor="captain-name">Captain name</label>
        <input id="captain-name" maxLength={30} value={name} onChange={event => {
          setName(event.target.value);
          localStorage.setItem('naval_arena_player_name', event.target.value.trim() || 'Captain');
        }} />
        <p>W / ↑: forward · A D / ← →: rotate<br />Space / J: front shot · Q / U: left broadside · E / O: right broadside</p>
        <p>Touch: hold movement and attack buttons together. Pause using the HUD button.</p>
        <button className="text-link" onClick={() => window.dispatchEvent(new Event('open-network-demo'))}>Network scenarios</button>
        <AssetButton onClick={() => setShowHelp(false)}>BACK</AssetButton>
      </div>
    </WoodPanel>}
  </MenuScene>;
}
