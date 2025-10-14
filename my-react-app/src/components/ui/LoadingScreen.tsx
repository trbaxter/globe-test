import { useEffect, useState } from 'react';

type Props = { show: boolean };

const FADE_MS = 700;
const DELAY_MS = 150;

export default function LoadingScreen({ show }: Props) {
  const [present, setPresent] = useState(show);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    let raf = 0,
      t: ReturnType<typeof setTimeout> | undefined;

    if (show) {
      setPresent(true);
      raf = requestAnimationFrame(() => setVisible(true));
    } else {
      raf = requestAnimationFrame(() => setVisible(false));
      t = setTimeout(() => setPresent(false), FADE_MS + DELAY_MS);
    }
    return () => {
      cancelAnimationFrame(raf);
      if (t) clearTimeout(t);
    };
  }, [show]);

  if (!present) return null;

  return (
    <>
      <style>{`
        @media (prefers-reduced-motion: reduce) {
          .fade { transition: none !important; }
        }
      `}</style>
      <div
        role="status"
        aria-live="polite"
        className="fade"
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
          transition: `opacity ${FADE_MS}ms ease-out ${DELAY_MS}ms`,
          pointerEvents: visible ? 'auto' : 'none'
        }}
      >
        <span>Loading ...</span>
      </div>
    </>
  );
}
