import { useEffect, type RefObject } from 'react';
import type { GlobeMethods } from 'react-globe.gl';

export function useGlobeControls(
  ref: RefObject<GlobeMethods | undefined>,
  imgUrl: string | null,
  opts: { damping?: number; rotateSpeed?: number } = {}
): void {
  useEffect(() => {
    const g = ref.current;
    if (!g || !imgUrl) return;

    const c = g.controls?.() as any;
    if (!c) return;

    c.enableDamping = true;
    c.dampingFactor = opts.damping ?? 0.09;
    c.rotateSpeed = opts.rotateSpeed ?? 0.55;
    c.enableZoom = false;
  }, [ref, imgUrl, opts.damping, opts.rotateSpeed]);
}
