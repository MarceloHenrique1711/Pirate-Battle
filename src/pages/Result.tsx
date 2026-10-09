import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AssetButton, MenuScene, WoodPanel } from '../components/ui/GameUI';
import { formatDuration } from '../components/ui/format';
import { getLastMatch } from '../types/history';
import { getPendingMatches } from '../api/gameApi';
import { useSyncMatchesMutation } from '../api/gameHooks';

export default function Result() {
  const navigate = useNavigate();
  const [record] = useState(getLastMatch);
  const [pending, setPending] = useState(() => getPendingMatches().some(item => item.id === record?.id));
  const { mutate: retry, isPending } = useSyncMatchesMutation();
  useEffect(() => {
    const timer = window.setInterval(() => {
      setPending(getPendingMatches().some(item => item.id === record?.id));
    }, 500);
    return () => window.clearInterval(timer);
  }, [record]);
  useEffect(() => { document.querySelector<HTMLButtonElement>('.result-actions button')?.focus(); }, []);
  if (!record) return <MenuScene><WoodPanel><div className="result-content">
    <h1>NO COMPLETED BATTLE</h1><AssetButton onClick={() => navigate('/')}>MAIN MENU</AssetButton>
  </div></WoodPanel></MenuScene>;
  return <MenuScene><WoodPanel><div className="result-content">
    <h1>{record.endReason === 'time_up' ? 'BATTLE COMPLETE' : 'SHIP DESTROYED'}</h1>
    <p className="result-score">{record.score}</p>
    <p className="result-summary">POINTS · {formatDuration(record.duration)} · {record.endReason === 'time_up' ? 'TIME UP' : 'DEFEATED'}</p>
    <div className="result-actions">
      <AssetButton onClick={() => navigate('/arena')}>PLAY AGAIN</AssetButton>
      <AssetButton onClick={() => navigate('/')}>MAIN MENU</AssetButton>
    </div>
    <p className="registration-status" role="status">{pending ? 'Match pending. Saved locally.' : 'Match registered.'}</p>
    {pending && <button className="text-link" disabled={isPending} onClick={() => retry()}>Retry registration</button>}
  </div></WoodPanel></MenuScene>;
}
