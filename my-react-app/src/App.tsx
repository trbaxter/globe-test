import Globe from '@/components/three/Globe.tsx';
import LoadingScreen from '@/components/ui/LoadingScreen.tsx';
import { useEffect, useState } from 'react';

const MIN_LOADER_MS = 4000;

export default function App() {
  const [ready, setReady] = useState(false);
  const [minDone, setMinDone] = useState(false);

  useEffect(() => {
    const onLoad = () => setReady(true);
    if (document.readyState === 'complete') onLoad();
    else window.addEventListener('load', onLoad);
    return () => window.removeEventListener('load', onLoad);
  }, []);

  useEffect(() => {
    const t = setTimeout(() => setMinDone(true), MIN_LOADER_MS);
    return () => clearTimeout(t);
  }, []);

  const showLoader = !(ready && minDone);

  return (
    <>
      {showLoader && <LoadingScreen />}
      <Globe />
    </>
  );
}
