import { useEffect, useRef, useState } from 'react';

const FADE_MS = 700;
const FADE_DELAY_MS = 150;

export default function LoadingScreen({
  show,
  progress = 0
}: {
  show: boolean;
  progress?: number;
}) {
  const [present, setPresent] = useState(show);
  const [visible, setVisible] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let raf1 = 0;
    let raf2 = 0;

    if (show) {
      setPresent(true);
      raf1 = requestAnimationFrame(() => {
        raf2 = requestAnimationFrame(() => setVisible(true));
      });
      document.body.style.overflow = 'hidden';
    } else {
      // Ensure the browser has committed current styles, then toggle opacity
      raf1 = requestAnimationFrame(() => {
        // force a layout flush on the element we transition
        void rootRef.current?.offsetHeight;
        raf2 = requestAnimationFrame(() => setVisible(false));
      });
    }
    return () => {
      if (raf1) cancelAnimationFrame(raf1);
      if (raf2) cancelAnimationFrame(raf2);
    };
  }, [show]);

  // Fallback: if transitionend doesn't fire, unmount after the expected duration
  useEffect(() => {
    if (show) return;
    const t = window.setTimeout(
      () => {
        if (!visible) setPresent(false);
      },
      FADE_DELAY_MS + FADE_MS + 50
    );
    return () => clearTimeout(t);
  }, [show, visible]);

  useEffect(() => {
    if (!visible) document.body.style.overflow = '';
  }, [visible]);

  if (!present) return null;

  const pct = Math.max(0, Math.min(1, progress)) * 100;

  return (
    <div
      ref={rootRef}
      role="status"
      aria-live="polite"
      className="fade"
      onTransitionEnd={(e) => {
        if (e.target !== rootRef.current) return; // ignore bubbled events
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
        transition: `opacity ${FADE_MS}ms ease-out ${FADE_DELAY_MS}ms`,
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
