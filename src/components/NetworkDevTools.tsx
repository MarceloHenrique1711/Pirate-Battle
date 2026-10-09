import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { NETWORK_SCENARIOS } from '../mocks/types';
import { resetMockState } from '../mocks/handlers';
import { getPendingMatches } from '../api/gameApi';
import { useSyncMatchesMutation } from '../api/gameHooks';
export function NetworkDevTools() {
  const location = useLocation();
  const [visible, setVisible] = useState(() => new URLSearchParams(window.location.search).has('network'));
  useEffect(() => {
    const open = () => setVisible(true);
    const key = (event: KeyboardEvent) => { if (event.code === 'F8') setVisible(previous => !previous); };
    window.addEventListener('open-network-demo', open);
    window.addEventListener('keydown', key);
    return () => { window.removeEventListener('open-network-demo', open); window.removeEventListener('keydown', key); };
  }, []);
  const client = useQueryClient();
  const { mutate: sync, isPending } = useSyncMatchesMutation();
  useEffect(() => {
    sync();
    const onOnline = () => sync();
    window.addEventListener('online', onOnline);
    return () => window.removeEventListener('online', onOnline);
  }, [sync]);
  if (location.pathname === '/arena' || !visible) return null;
  return (
    <details className="network-tools" open>
      <summary>Network demo · {getPendingMatches().length} pending</summary>
      <button onClick={() => setVisible(false)} aria-label="Close network demo">Close</button>
      <label htmlFor="network-scenario">Scenario</label>{' '}
      <select id="network-scenario" defaultValue={localStorage.getItem('msw_scenario') || 'SUCCESS'}
        onChange={event => {
          localStorage.setItem('msw_scenario', event.target.value);
          void client.invalidateQueries();
          if (event.target.value === 'SUCCESS') sync();
        }}>
        {NETWORK_SCENARIOS.map(value => <option key={value}>{value}</option>)}
      </select>
      <button onClick={() => sync()} disabled={isPending}>Retry pending matches</button>
      <button onClick={() => {
        if (!window.confirm('Reset confirmed demo matches to fixtures? Pending matches will be kept.')) return;
        resetMockState();
        window.location.reload();
      }}>Reset demo</button>
    </details>
  );
}
