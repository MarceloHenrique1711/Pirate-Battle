import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { NetworkDevTools } from './components/NetworkDevTools';
import MainMenu from './pages/MainMenu';
import Options from './pages/Options';
import Arena from './pages/Arena';
import Ranking from './pages/Ranking';
import Result from './pages/Result';
import MatchHistory from './pages/MatchHistory';

export default function App() {
  return (
    <Router>
      <NetworkDevTools />
      <Routes>
        <Route path="/" element={<MainMenu />} />
        <Route path="/options" element={<Options />} />
        <Route path="/arena" element={<Arena />} />
        <Route path="/result" element={<Result />} />
        <Route path="/ranking" element={<Ranking />} />
        <Route path="/history" element={<MatchHistory />} />
      </Routes>
    </Router>
  );
}