import { useState } from 'react';
import { useMatchHistoryQuery } from '../api/gameHooks';
import { CaptainsLog } from '../components/ui/CaptainsLog';
import { formatDate, formatDuration } from '../components/ui/format';
export default function MatchHistory() {
  const [page, setPage] = useState(1);
  const { data, isLoading, isError, isFetching, refetch } = useMatchHistoryQuery(page);
  const matches = data?.data ?? [];
  const name = localStorage.getItem('naval_arena_player_name') || 'Captain';
  return <CaptainsLog active="history" subtitle={`${name.toUpperCase()} · YOUR RECENT BATTLES`}
    page={page} totalPages={data?.totalPages || 1} changePage={setPage} updating={isFetching && !isLoading}>
    <table className="log-table history-table">
      <colgroup><col style={{ width: '34%' }} /><col style={{ width: '20%' }} /><col style={{ width: '24%' }} /><col style={{ width: '22%' }} /></colgroup>
      <thead><tr><th>DATE</th><th>POINTS</th><th>DURATION</th><th>RESULT</th></tr></thead>
      <tbody>
        {isLoading && <tr><td colSpan={4} className="table-message">Loading match history...</td></tr>}
        {isError && <tr><td colSpan={4} className="table-message" role="alert">Failed to load match history. <button className="text-link" onClick={() => refetch()}>Try again</button></td></tr>}
        {!isLoading && !isError && matches.length === 0 && <tr><td colSpan={4} className="table-message">No match history found. Play a game first!</td></tr>}
        {!isError && matches.map((row, index) => <tr key={row.id} className={index === 0 && page === 1 ? 'user-row' : ''}>
          <td>{formatDate(row.date)}</td><td className="points-cell">{row.score}</td><td>{formatDuration(row.duration)}</td>
          <td className={`result-cell ${row.endReason === 'time_up' ? 'result-time-up' : 'result-defeated'}`}>{row.endReason === 'time_up' ? 'TIME UP' : 'DEFEATED'}</td>
        </tr>)}
      </tbody>
    </table>
  </CaptainsLog>;
}
