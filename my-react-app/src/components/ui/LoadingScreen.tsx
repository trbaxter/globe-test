import { useEffect, useState } from 'react';

export default function LoadingScreen({
  show,
  progress = 0
}: {
  show: boolean;
  progress?: number;
}) {
  const [present, setPresent] = useState(show);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    let raf = 0;
    if (show) {
      setPresent(true);
      raf = requestAnimationFrame(() => setVisible(true));
      document.body.style.overflow = 'hidden';
    } else {
      raf = requestAnimationFrame(() => setVisible(false));
    }
    return () => cancelAnimationFrame(raf);
  }, [show]);

  useEffect(() => {
    if (!visible) document.body.style.overflow = '';
  }, [visible]);

  if (!present) return null;

  const pct = Math.max(0, Math.min(1, progress)) * 100;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fade"
      onTransitionEnd={() => {
        if (!visible) setPresent(false);
      }}
      style={{
        position: 'fixed',
        inset: 0,
        background: '#000',
        color: '#fff',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'column',
        gap: 16,
        fontSize: 34,
        zIndex: 9999,
        opacity: visible ? 1 : 0,
        transition: 'opacity 700ms ease-out 150ms',
        willChange: 'opacity',
        pointerEvents: visible ? 'auto' : 'none'
      }}
    >
      <span>Loading ...</span>
      <div
        aria-label="loading progress"
        style={{
          width: 320,
          height: 6,
          borderRadius: 999,
          background: '#1a1a1a',
          border: '1px solid #2c2c2c',
          overflow: 'hidden'
        }}
      >
        <div
          style={{
            width: `${pct}%`,
            height: '100%',
            background: '#5aa3ff',
            transition: 'width 150ms linear'
          }}
        />
      </div>
    </div>
  );
}
