import Globe from '@/components/three/Globe.tsx';
import LoadingScreen from '@/components/ui/LoadingScreen.tsx';
import { useCallback, useEffect, useRef, useState } from 'react';

const MIN_LOADER_MS = 4000;
const POST_FULL_HOLD_MS = 1000;

export default function App() {
  const [ready, setReady] = useState(false);
  const [minDone, setMinDone] = useState(false);
  const [pct, setPct] = useState(0); // displayed progress (0..1)
  const targetRef = useRef(0); // real progress (0..1)
  const [postFullDone, setPostFullDone] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setMinDone(true), MIN_LOADER_MS);
    return () => clearTimeout(t);
  }, []);

  // Smooth progress animation
  useEffect(() => {
    let raf = 0;
    const tick = () => {
      setPct((v) => {
        const t = targetRef.current;
        const next = v + (t - v) * 0.18;
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
    targetRef.current = 1; // ensure bar fills
    setReady(true);
  }, []);

  const barFull = pct >= 0.999;

  // Hold for 1s after all hide conditions are met
  useEffect(() => {
    if (ready && minDone && barFull) {
      const t = setTimeout(() => setPostFullDone(true), POST_FULL_HOLD_MS);
      return () => clearTimeout(t);
    }
    setPostFullDone(false);
  }, [ready, minDone, barFull]);

  const showLoader = !(ready && minDone && barFull && postFullDone);

  return (
    <>
      <LoadingScreen show={showLoader} progress={pct} />
      <Globe onReady={handleReady} onProgress={handleProgress} />
    </>
  );
}
