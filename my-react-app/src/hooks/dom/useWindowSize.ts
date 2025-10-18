import { useEffect, useState } from 'react';

export function useWindowSize(): { w: number; h: number } {
  const isClient = typeof window !== 'undefined';

  const [size, setSize] = useState(() => ({
    w: isClient ? window.innerWidth : 0,
    h: isClient ? window.innerHeight : 0
  }));

  useEffect(() => {
    if (!isClient) return;
    const onResize = () => setSize({ w: window.innerWidth, h: window.innerHeight });
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [isClient]);

  return size;
}
