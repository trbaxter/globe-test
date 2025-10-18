import { useSyncExternalStore } from 'react';

type Size = { w: number; h: number };

let cached: Size = { w: 0, h: 0 };

const getServerSnapshot = (): Size => ({ w: 0, h: 0 });

const getSnapshot = (): Size => {
  if (typeof window === 'undefined') return cached;
  const w = window.innerWidth;
  const h = window.innerHeight;
  if (cached.w !== w || cached.h !== h) cached = { w, h };
  return cached;
};

const subscribe = (cb: () => void) => {
  if (typeof window === 'undefined') return () => {};
  const onResize = () => {
    const prev = cached;
    const next = getSnapshot();
    if (next !== prev) cb();
  };
  window.addEventListener('resize', onResize);
  return () => window.removeEventListener('resize', onResize);
};

export function useWindowSize(): Size {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
