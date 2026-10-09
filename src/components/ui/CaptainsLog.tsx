import { useNavigate } from 'react-router-dom';
import type { ReactNode } from 'react';
import { AssetButton, MenuScene, RoundButton, WoodPanel } from './GameUI';
export function CaptainsLog({ active, subtitle, page, totalPages, changePage, children, updating }: {
  active: 'ranking' | 'history'; subtitle: string; page: number; totalPages: number;
  changePage: (page: number) => void; children: ReactNode; updating: boolean;
}) {
  const navigate = useNavigate();
  return <MenuScene><WoodPanel kind="log">
    <div className="log-content">
      <h1>CAPTAIN'S LOG</h1>
      <nav className="log-tabs" aria-label="Captain's log">
        <AssetButton secondary={active !== 'ranking'} onClick={() => navigate('/ranking')}>RANKING</AssetButton>
        <AssetButton secondary={active !== 'history'} onClick={() => navigate('/history')}>MATCH HISTORY</AssetButton>
      </nav>
      <p className="log-subtitle">{subtitle}</p>
      <span className="background-update" role="status">{updating ? 'Updating...' : ''}</span>
      <div className="log-table-wrap">{children}</div>
      <nav className="log-pagination" aria-label="Pagination">
        <RoundButton icon="icon_turn_left" label="Previous page" disabled={page === 1}
          onClick={() => changePage(Math.max(1, page - 1))} />
        <span>PAGE {page} OF {totalPages}</span>
        <RoundButton icon="icon_turn_right" label="Next page" disabled={page >= totalPages}
          onClick={() => changePage(Math.min(totalPages, page + 1))} />
      </nav>
      <AssetButton className="log-main-menu" onClick={() => navigate('/')}>MAIN MENU</AssetButton>
    </div>
  </WoodPanel></MenuScene>;
}
