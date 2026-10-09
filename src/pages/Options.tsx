import { useNavigate } from 'react-router-dom';
import { MenuScene, OptionsContent, WoodPanel } from '../components/ui/GameUI';
export default function Options() {
  const navigate = useNavigate();
  return <MenuScene><WoodPanel><OptionsContent onBack={() => navigate('/')} /></WoodPanel></MenuScene>;
}
