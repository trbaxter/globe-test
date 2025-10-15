import { useEffect, useState } from 'react';

export default function LoadingScreen({ show }: { show: boolean }) {
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
        fontSize: 34,
        zIndex: 9999,
        opacity: visible ? 1 : 0,
        transition: 'opacity 700ms ease-out 150ms',
        willChange: 'opacity',
        pointerEvents: visible ? 'auto' : 'none'
      }}
    >
      <span>Loading ...</span>
    </div>
  );
}
