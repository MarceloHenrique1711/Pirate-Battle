import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react';
import { useNavigate } from 'react-router-dom';
import { AssetButton, MenuScene, OptionsContent, RoundButton, WoodPanel } from '../components/ui/GameUI';
import { useSceneScale } from '../components/ui/useSceneScale';
import { GameEngine } from '../game/GameEngine';
import { getTestSetup } from '../game/testSupport';
import { queueMatch } from '../api/gameApi';
import { useSaveMatchMutation } from '../api/gameHooks';
import { getPlayerId, saveLastMatch } from '../types/history';
import { loadGameConfig, type GameConfig } from '../types/gameConfig';
import type { MatchRecord, EndReason } from '../mocks/types';

const CONTROL_FROM_KEY: Record<string, string> = {
  KeyA: 'KeyA', ArrowLeft: 'KeyA',
  KeyW: 'KeyW', ArrowUp: 'KeyW',
  KeyD: 'KeyD', ArrowRight: 'KeyD',
  KeyQ: 'KeyQ', KeyU: 'KeyQ',
  Space: 'Space', KeyJ: 'Space',
  KeyE: 'KeyE', KeyO: 'KeyE',
};

function ArenaControlButton({
  code, icon, label, raised = false, pressed, onVirtualKey,
}: {
  code: string;
  icon: string;
  label: string;
  raised?: boolean;
  pressed: boolean;
  onVirtualKey: (code: string, down: boolean) => void;
}) {
  return (
    <button
      type="button"
      className={`round-button ${raised ? 'raised-control' : ''}`}
      data-pressed={pressed ? 'true' : 'false'}
      aria-label={label}
      aria-pressed={pressed}
      onPointerDown={(event) => {
        event.preventDefault();
        event.currentTarget.setPointerCapture(event.pointerId);
        onVirtualKey(code, true);
      }}
      onPointerUp={(event) => {
        onVirtualKey(code, false);
        if (event.currentTarget.hasPointerCapture(event.pointerId)) {
          event.currentTarget.releasePointerCapture(event.pointerId);
        }
      }}
      onPointerCancel={() => onVirtualKey(code, false)}
      onLostPointerCapture={() => onVirtualKey(code, false)}
    >
      <img src={`/assets/png/retina/ui/controls/${icon}`} alt="" aria-hidden="true" />
    </button>
  );
}

const formatTime = (seconds: number): string => {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
};

export default function Arena() {
  const navigate = useNavigate();
  const uiScale = useSceneScale();
  const [pauseOptionsOpen, setPauseOptionsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<GameEngine | null>(null);

  const [gameState, setGameState] = useState<'loading' | 'playing' | 'paused' | 'gameover'>('loading');
  const [loadProgress, setLoadProgress] = useState(0);
  const [gameOverData, setGameOverData] = useState<{ score: number; time: number; reason: string } | null>(null);

  const recordRef = useRef<MatchRecord | null>(null);
  const previousHpRef = useRef(100);
  const { mutate: registerMatch, reset: resetRegistration, isPending } = useSaveMatchMutation();
  const [registrationError, setRegistrationError] = useState('');
  const [isRecordSaved, setIsRecordSaved] = useState(false);

  const [hp, setHp] = useState(100);
  const [maxHp, setMaxHp] = useState(100);
  const [score, setScore] = useState(0);
  const [timeLeft, setTimeLeft] = useState(60);
  const [keyboardPressed, setKeyboardPressed] = useState<Set<string>>(() => new Set());
  const [pointerPressed, setPointerPressed] = useState<Set<string>>(() => new Set());
  const pointerPressedRef = useRef<Set<string>>(new Set());

  const [semanticAnnouncement, setSemanticAnnouncement] = useState('Welcome to Pirate Battle. Loading...');

  const configRef = useRef<GameConfig>(loadGameConfig());

  useEffect(() => {
    if (gameState !== 'playing') return;
    const keyDown = (event: KeyboardEvent) => {
      const key = CONTROL_FROM_KEY[event.code];
      if (!key) return;
      const target = event.target as HTMLElement | null;
      if (target?.closest('input, textarea, select, button, [contenteditable="true"]')) return;
      if (event.code.startsWith('Arrow') || event.code === 'Space') event.preventDefault();
      setKeyboardPressed(previous => {
        if (previous.has(key)) return previous;
        const next = new Set(previous);
        next.add(key);
        return next;
      });
    };
    const keyUp = (event: KeyboardEvent) => {
      const key = CONTROL_FROM_KEY[event.code];
      if (!key) return;
      if (event.code.startsWith('Arrow') || event.code === 'Space') event.preventDefault();
      setKeyboardPressed(previous => {
        if (!previous.has(key)) return previous;
        const next = new Set(previous);
        next.delete(key);
        return next;
      });
    };
    let autoPaused = false;
    const blur = () => {
      if (autoPaused) return;
      autoPaused = true;
      if (engineRef.current?.togglePause()) {
        setGameState('paused');
        setSemanticAnnouncement('Paused. Select Resume to continue.');
        pointerPressedRef.current.clear();
        setPointerPressed(new Set());
        setKeyboardPressed(new Set());
      }
    };
    const visibilityChange = () => { if (document.hidden) blur(); };
    window.addEventListener('keydown', keyDown);
    window.addEventListener('keyup', keyUp);
    window.addEventListener('blur', blur);
    document.addEventListener('visibilitychange', visibilityChange);
    return () => {
      window.removeEventListener('keydown', keyDown);
      window.removeEventListener('keyup', keyUp);
      window.removeEventListener('blur', blur);
      document.removeEventListener('visibilitychange', visibilityChange);
    };
  }, [gameState]);

  const initGame = useCallback(() => {
    if (!containerRef.current) return;

    if (engineRef.current) {
      engineRef.current.destroy();
      engineRef.current = null;
    }

    if (containerRef.current) {
      containerRef.current.innerHTML = '';
    }

    const config = structuredClone(getTestSetup()?.config || loadGameConfig());
    configRef.current = config;

    recordRef.current = null;
    previousHpRef.current = config.player.hp;
    resetRegistration();
    setRegistrationError('');
    setLoadProgress(0);
    setPauseOptionsOpen(false);
    setKeyboardPressed(new Set());
    setPointerPressed(new Set());
    pointerPressedRef.current.clear();
    setGameState('loading');
    setIsRecordSaved(false);
    setGameOverData(null);
    setHp(config.player?.hp ?? 100);
    setMaxHp(config.player?.hp ?? 100);
    setScore(0);
    setTimeLeft(config.gameSessionTime);
    setSemanticAnnouncement('Loading assets...');

    engineRef.current = new GameEngine(config, {
      onLoadProgress: (progress: number) => {
        setLoadProgress(Math.floor(progress));
      },
      onReady: () => {
        if (document.hidden) {
          engineRef.current?.togglePause();
          setGameState('paused');
          setSemanticAnnouncement('Paused. Select Resume to continue.');
          return;
        }
        setGameState('playing');
        setSemanticAnnouncement('Battle started.');
        containerRef.current?.focus();
      },
      onUIUpdate: (newHp: number, newScore: number, newTime: number) => {
        setHp(newHp);
        setScore(newScore);
        setTimeLeft(newTime);

        if (newTime === 30) setSemanticAnnouncement('30 seconds remaining.');
        if (newTime === 10) setSemanticAnnouncement('10 seconds remaining!');
        if (newHp < 30 && previousHpRef.current >= 30) setSemanticAnnouncement('Warning: low health!');
        previousHpRef.current = newHp;
      },
      onGameOver: (finalScore: number, timePlayed: number, reason: EndReason) => {
        setGameOverData({ score: finalScore, time: timePlayed, reason });
        setGameState('gameover');
        const record: MatchRecord = {
          id: crypto.randomUUID(), playerId: getPlayerId(),
          playerName: localStorage.getItem('naval_arena_player_name') || 'Captain',
          date: new Date().toISOString(), score: finalScore,
          duration: timePlayed, endReason: reason, config: structuredClone(config),
        };
        recordRef.current = record;
        saveLastMatch(record);
        queueMatch(record);
        setSemanticAnnouncement('Battle finished. Saving match.');
        navigate('/result');
        registerMatch(record, {
          onSuccess: () => { if (recordRef.current?.id === record.id) setIsRecordSaved(true); },
          onError: () => {
            if (recordRef.current?.id === record.id) setRegistrationError('Pending: saved locally. Try again when the API recovers.');
          },
        });
      },

      onError: (errorMessage: string) => {
        console.error("Engine error:", errorMessage);
        setGameOverData({ score: 0, time: 0, reason: `Loading Error: ${errorMessage}` });
        setGameState('gameover');
        setSemanticAnnouncement('Failed to load the game.');
      }
    }); 

    try {
      const initResult = engineRef.current.init(containerRef.current);

      if (initResult instanceof Promise) {
        initResult.catch((error) => {
          console.error("Async initialization error:", error);
          setGameOverData({ score: 0, time: 0, reason: "Error: invalid assets." });
          setGameState('gameover');
          setSemanticAnnouncement('Error loading assets.');
        });
      }
    } catch (error) {

      console.error("Initialization error:", error);
      setGameOverData({ score: 0, time: 0, reason: "Error: game initialization failed." });
      setGameState('gameover');
      setSemanticAnnouncement('Error initializing game.');
    }
  }, [registerMatch, resetRegistration, navigate]);

  useEffect(() => {

    const frame = requestAnimationFrame(initGame);
    return () => {
      cancelAnimationFrame(frame);

      if (engineRef.current) {
        engineRef.current.destroy();
        engineRef.current = null;
      }
    };
  }, [initGame]);

  const togglePause = () => {
    if (engineRef.current) {
      for (const key of pointerPressedRef.current) {
        engineRef.current.input?.setVirtualKey(key, false);
      }
      pointerPressedRef.current.clear();
      setPointerPressed(new Set());
      setKeyboardPressed(new Set());
      const isPaused = engineRef.current.togglePause();
      setGameState(isPaused ? 'paused' : 'playing');
      setSemanticAnnouncement(isPaused ? 'Paused.' : 'Battle resumed.');
      if (!isPaused) containerRef.current?.focus();
    }
  };

  const handleTouch = (key: string, isPressed: boolean) => {
    if (gameState !== 'playing') return;
    if (engineRef.current?.input) {
      engineRef.current.input.setVirtualKey(key, isPressed);
    }
    if (isPressed) pointerPressedRef.current.add(key);
    else pointerPressedRef.current.delete(key);
    setPointerPressed(new Set(pointerPressedRef.current));
  };

  const quitToMenu = () => {
    if (engineRef.current) {
      engineRef.current.destroy();
      engineRef.current = null;
    }
    navigate('/');
  };

  const retryRegistration = () => {
    const record = recordRef.current;
    if (!record || isPending) return;
    setRegistrationError('');
    registerMatch(record, {
      onSuccess: () => { if (recordRef.current?.id === record.id) setIsRecordSaved(true); },
      onError: () => { if (recordRef.current?.id === record.id) setRegistrationError('Still pending. Your match is saved locally.'); },
    });
  };

  useEffect(() => {
    if (gameState !== 'paused' && gameState !== 'gameover') return;
    const dialog = document.querySelector<HTMLElement>('[aria-modal="true"]');
    const focusable = dialog?.querySelectorAll<HTMLElement>('button:not(:disabled), input, [tabindex="0"]');
    focusable?.[0]?.focus();
    const trapTab = (event: KeyboardEvent) => {
      if (event.key !== 'Tab') return;
      const current = dialog?.querySelectorAll<HTMLElement>('button:not(:disabled), input, [tabindex="0"]');
      if (!current?.length) return;
      const first = current[0];
      const last = current[current.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    dialog?.addEventListener('keydown', trapTab);
    return () => dialog?.removeEventListener('keydown', trapTab);
  }, [gameState, pauseOptionsOpen]);

  const resultReason = gameOverData?.reason === 'time_up' ? 'TIME UP' : 'DEFEATED';
  const loadingError = gameOverData?.reason.includes('Error');
  const healthRatio = Math.max(0, Math.min(1, hp / maxHp));
  // Keep the complete fill image at its original size and reveal its atlas fill_rect.
  const fillRight = 100 - (30 / 256 * 100 + 196 / 256 * 100 * healthRatio);

  return <div className="battle-page">
    <div className="sr-only" role="status" aria-live="polite">{semanticAnnouncement}</div>
    <p className="sr-only">Health: {hp}. Score: {score}. Time remaining: {timeLeft} seconds. State: {gameState}.</p>
    <div ref={containerRef} className="arena-canvas" tabIndex={0}
      aria-label="Game arena. W to move, A and D to rotate, Space to fire, Q and E for broadsides." />
    {gameState === 'playing' && <div className="battle-ui" style={{ '--menu-scale': uiScale } as CSSProperties}>
      <header>
        <div className="battle-health" aria-label={`Health: ${hp} of ${maxHp}`}>
          <img src="/assets/png/retina/ui/hud/icon_heart.png" alt="" />
          <div className="health-meter">
            <img src="/assets/png/retina/ui/hud/health_frame.png" alt="" />
            <img src={`/assets/png/retina/ui/hud/health_fill_${healthRatio > .65 ? 'green' : healthRatio > .3 ? 'amber' : 'red'}.png`}
              style={{ clipPath: `inset(0 ${fillRight}% 0 0)` }} alt="" />
            <span>{hp} / {maxHp}</span>
          </div>
        </div>
        <div className="battle-counters">
          <div className="hud-counter" aria-label={`Score: ${score}`}><img src="/assets/png/retina/ui/hud/icon_score.png" alt="" /><span>{score}</span></div>
          <div className="hud-counter" aria-label={`Time remaining: ${formatTime(timeLeft)}`}><img src="/assets/png/retina/ui/hud/icon_time.png" alt="" /><span>{formatTime(timeLeft)}</span></div>
          <RoundButton icon="icon_pause" label="Pause game" onClick={togglePause} />
        </div>
      </header>
      <div className="battle-controls battle-controls-left">
        <ArenaControlButton code="KeyA" label="Rotate left (A)" icon="icon_turn_left.png" pressed={keyboardPressed.has('KeyA') || pointerPressed.has('KeyA')} onVirtualKey={handleTouch} />
        <ArenaControlButton code="KeyW" label="Forward (W)" icon="icon_forward.png" raised pressed={keyboardPressed.has('KeyW') || pointerPressed.has('KeyW')} onVirtualKey={handleTouch} />
        <ArenaControlButton code="KeyD" label="Rotate right (D)" icon="icon_turn_right.png" pressed={keyboardPressed.has('KeyD') || pointerPressed.has('KeyD')} onVirtualKey={handleTouch} />
      </div>
      <div className="battle-controls battle-controls-right">
        <ArenaControlButton code="KeyQ" label="Left broadside (Q)" icon="icon_fire_left.png" pressed={keyboardPressed.has('KeyQ') || pointerPressed.has('KeyQ')} onVirtualKey={handleTouch} />
        <ArenaControlButton code="Space" label="Front shot (Space)" icon="icon_fire_front.png" raised pressed={keyboardPressed.has('Space') || pointerPressed.has('Space')} onVirtualKey={handleTouch} />
        <ArenaControlButton code="KeyE" label="Right broadside (E)" icon="icon_fire_right.png" pressed={keyboardPressed.has('KeyE') || pointerPressed.has('KeyE')} onVirtualKey={handleTouch} />
      </div>
      <img className="battle-brand" src="/assets/logo_jungle_gaming.svg" alt="Jungle Gaming" />
    </div>}
    {gameState === 'loading' && <MenuScene overlay><WoodPanel><div className="loading-content" role="status">
      <h2>LOADING BATTLE</h2><progress value={loadProgress} max="100" aria-label="Loading assets" /><p>{loadProgress}%</p>
    </div></WoodPanel></MenuScene>}
    {gameState === 'paused' && <MenuScene overlay><WoodPanel modal titleId={pauseOptionsOpen ? 'options-title' : 'pause-title'}>
      {pauseOptionsOpen ? <OptionsContent onBack={() => setPauseOptionsOpen(false)} backLabel="BACK" /> : <div className="pause-content">
        <h2 id="pause-title">PAUSED</h2><p>Ready when you are.</p>
        <div className="pause-actions">
          <AssetButton onClick={togglePause}>RESUME</AssetButton>
          <AssetButton onClick={() => setPauseOptionsOpen(true)}>OPTIONS</AssetButton>
          <AssetButton onClick={quitToMenu}>MAIN MENU</AssetButton>
        </div>
      </div>}
    </WoodPanel></MenuScene>}
    {gameState === 'gameover' && gameOverData && <MenuScene overlay><WoodPanel modal titleId="result-title">
      <div className="result-content">
        <h2 id="result-title">{loadingError ? 'LOADING ERROR' : gameOverData.reason === 'time_up' ? 'BATTLE COMPLETE' : 'SHIP DESTROYED'}</h2>
        {loadingError ? <p className="ui-error">{gameOverData.reason}</p> : <>
          <p className="result-score">{gameOverData.score}</p>
          <p className="result-summary">POINTS · {formatTime(Math.floor(gameOverData.time))} · {resultReason}</p>
        </>}
        <div className="result-actions"><AssetButton onClick={initGame}>PLAY AGAIN</AssetButton><AssetButton onClick={quitToMenu}>MAIN MENU</AssetButton></div>
        {!loadingError && <p className="registration-status" role="status">{isRecordSaved ? 'Match registered.' : isPending ? 'Saving match...' : registrationError || 'Match pending.'}</p>}
        {!loadingError && !isRecordSaved && !isPending && <button className="text-link" onClick={retryRegistration}>Retry registration</button>}
      </div>
    </WoodPanel></MenuScene>}
  </div>;
}
