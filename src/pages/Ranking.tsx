import { useState } from 'react';
import { useRankingQuery } from '../api/gameHooks';
import { loadGameConfig } from '../types/gameConfig';
import { CaptainsLog } from '../components/ui/CaptainsLog';
import { formatDate } from '../components/ui/format';
export default function Ranking() {
  const [page, setPage] = useState(1);
  const { data, isLoading, isError, isFetching, refetch } = useRankingQuery(page);
  const rankings = data?.data ?? [];
  const config = loadGameConfig();
  return <CaptainsLog active="ranking" subtitle={`${config.gameSessionTime} SECOND BATTLES · ${config.enemySpawnTime} SECOND SPAWN INTERVAL`}
    page={page} totalPages={data?.totalPages || 1} changePage={setPage} updating={isFetching && !isLoading}>
    <table className="log-table ranking-table">
      <colgroup><col style={{ width: '14%' }} /><col style={{ width: '42%' }} /><col style={{ width: '17%' }} /><col style={{ width: '27%' }} /></colgroup>
      <thead><tr><th>RANK</th><th>CAPTAIN</th><th>POINTS</th><th>PLAYED</th></tr></thead>
      <tbody>
        {isLoading && <tr><td colSpan={4} className="table-message">Loading rankings...</td></tr>}
        {isError && <tr><td colSpan={4} className="table-message" role="alert">Failed to load rankings. <button className="text-link" onClick={() => refetch()}>Try again</button></td></tr>}
        {!isLoading && !isError && rankings.length === 0 && <tr><td colSpan={4} className="table-message">No rankings found. Play a game first!</td></tr>}
        {!isError && rankings.map(row => <tr key={row.id} className={row.isUser ? 'user-row' : ''}>
          <td className="rank-cell">{String(row.rank).padStart(2, '0')}</td>
          <td>{row.rank === 1 && <img className="ranking-star" src="/assets/png/retina/ui/hud/icon_score.png" alt="First place" />}{row.playerName} {row.isUser && <span className="you-badge">YOU</span>}</td>
          <td className="points-cell">{row.score}</td><td className="date-cell">{formatDate(row.date)}</td>
        </tr>)}
      </tbody>
    </table>
  </CaptainsLog>;
}
