import { useCallback, useEffect, useRef, useState } from 'react';
import Globe from '@/components/Globe.tsx';
import LoadingScreen from '@/components/LoadingScreen.tsx';

const MIN_LOADER_MS = 4000;
const POST_FULL_HOLD_MS = 1000;

export default function App() {
  const [ready, setReady] = useState(false);
  const [minDone, setMinDone] = useState(false);
  const [pct, setPct] = useState(0);
  const targetRef = useRef(0);
  const firstProgressSeen = useRef(false);
  const [postFullDone, setPostFullDone] = useState(false);
  const [ll, setLL] = useState<{ lat: number; lng: number } | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setMinDone(true), MIN_LOADER_MS);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    let raf = 0;
    const tick = () => {
      setPct((v) => {
        const t = targetRef.current;
        const next = v + (t - v) * 0.18;
        if (next < v) return v;
        return Math.abs(next - v) < 0.001 ? t : next;
      });
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  const handleProgress = useCallback((loaded: number, total: number) => {
    const p = total > 0 ? loaded / total : 0;
    const clamped = Math.max(0, Math.min(1, p));

    if (!firstProgressSeen.current) {
      targetRef.current = 0;
      firstProgressSeen.current = true;
      return;
    }
    targetRef.current = Math.max(targetRef.current, clamped);
  }, []);

  const handleReady = useCallback(() => {
    targetRef.current = 1;
    setReady(true);
  }, []);

  const barFull = pct >= 0.999;

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

      <div
        style={{
          position: 'fixed',
          left: 12,
          bottom: 12,
          padding: '6px 8px',
          borderRadius: 8,
          fontSize: 12,
          background: 'rgba(15,21,43,0.85)',
          color: '#fff',
          pointerEvents: 'none',
          zIndex: 10
        }}
      >
        {ll ? `lat ${ll.lat.toFixed(4)}  lng ${ll.lng.toFixed(4)}` : 'lat ————  lng ————'}
      </div>
      <Globe onReady={handleReady} onProgress={handleProgress} onCursorLL={setLL} />
    </>
  );
}
