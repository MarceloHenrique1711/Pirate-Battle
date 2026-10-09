import { useEffect, useState } from 'react';
export function useSceneScale() {
  const [scale, setScale] = useState(() => Math.min(window.innerWidth / 1800, window.innerHeight / 1000));
  useEffect(() => {
    const resize = () => setScale(Math.min(window.innerWidth / 1800, window.innerHeight / 1000));
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, []);
  return scale;
}
