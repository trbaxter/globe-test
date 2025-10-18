import { useEffect } from 'react';
import type { GlobeMethods } from 'react-globe.gl';

export function useCursorLatLong(
  ref: React.RefObject<GlobeMethods | undefined>,
  imgUrl: string | null,
  onCursorLL?: (ll: { lat: number; lng: number } | null) => void
): void {
  useEffect(() => {
    const g = ref.current;
    if (!g || !imgUrl) return;

    const r = g.renderer?.();
    const dom = r?.domElement;
    if (!dom) return;

    let mmRaf = 0;
    let mx = 0,
      my = 0;

    const onCursorMove = (e: MouseEvent) => {
      mx = e.clientX;
      my = e.clientY;
      if (!mmRaf) {
        mmRaf = requestAnimationFrame(() => {
          mmRaf = 0;
          const rect = dom.getBoundingClientRect();
          const x = mx - rect.left;
          const y = my - rect.top;
          const ll = (g as any).toGlobeCoords?.(x, y) as
            | { lat: number; lng: number }
            | null
            | undefined;
          onCursorLL?.(ll ?? null);
        });
      }
    };

    const onLeave = () => onCursorLL?.(null);

    dom.addEventListener('mousemove', onCursorMove, { passive: true });
    dom.addEventListener('mouseleave', onLeave);

    return () => {
      dom.removeEventListener('mousemove', onCursorMove);
      dom.removeEventListener('mouseleave', onLeave);
      if (mmRaf) cancelAnimationFrame(mmRaf);
    };
  }, [ref, imgUrl, onCursorLL]);
}
