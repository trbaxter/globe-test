import Globe from '@/components/three/Globe.tsx';
import LoadingScreen from '@/components/ui/LoadingScreen.tsx';
import { useCallback, useEffect, useRef, useState } from 'react';

const MIN_LOADER_MS = 4000;

export default function App() {
  const [ready, setReady] = useState(false);
  const [minDone, setMinDone] = useState(false);
  const [pct, setPct] = useState(0);
  const targetRef = useRef(0);

  useEffect(() => {
    const t = setTimeout(() => setMinDone(true), MIN_LOADER_MS);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    let raf = 0;
    const tick = () => {
      setPct((v) => {
        const t = targetRef.current;
        const next = v + (t - v) * 0.18; // easing factor
        return Math.abs(next - v) < 0.001 ? t : next;
      });
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  const handleProgress = useCallback((loaded: number, total: number) => {
    const p = total > 0 ? loaded / total : 0;
    targetRef.current = Math.min(1, Math.max(0, p));
  }, []);

  const handleReady = useCallback(() => {
    targetRef.current = 1;
    setReady(true);
  }, []);

  const showLoader = !(ready && minDone);

  return (
    <>
      <LoadingScreen show={showLoader} progress={pct} />
      <Globe onReady={handleReady} onProgress={handleProgress} />
    </>
  );
}
