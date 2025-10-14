import { useEffect, useState } from 'react';

export default function LoadingScreen() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const id = requestAnimationFrame(() => setVisible(true)); // start after first paint
    return () => cancelAnimationFrame(id);
  }, []);

  return (
    <>
      <style>{`
        @media (prefers-reduced-motion: reduce) {
          .fade { transition: none !important; opacity: 1 !important; }
        }
      `}</style>
      <div
        role="status"
        aria-live="polite"
        style={{
          position: 'fixed',
          inset: 0,
          background: '#000',
          color: '#fff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 34,
          zIndex: 9999
        }}
      >
        <span
          className="fade"
          style={{
            opacity: visible ? 1 : 0,
            transition: 'opacity 700ms ease-out 150ms'
          }}
        >
          Loading ...
        </span>
      </div>
    </>
  );
}
