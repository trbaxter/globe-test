import { useEffect } from 'react';
import type { RefObject } from 'react';
import type { GlobeMethods } from 'react-globe.gl';
import { useLatest } from '@/hooks/utils/useLatest';

type Opts = {
  onProgress?: (p01: number) => void;
  onBeforeReady?: () => void;
  onReady?: () => void;
  timeoutMs?: number;
  maxTries?: number;
};

export function useGlobeReady(
  ref: RefObject<GlobeMethods | undefined>,
  imgUrl: string | null,
  opts: Opts = {}
): void {
  const optsRef = useLatest(opts);

  useEffect(() => {
    const g = ref.current;
    if (!g || !imgUrl) return;

    let raf = 0;
    let passes = 0;
    let tries = 0;
    let fired = false;
    const MAX_TRIES = optsRef.current.maxTries ?? 900;

    const fallback = window.setTimeout(() => {
      if (!fired) {
        fired = true;
        optsRef.current.onBeforeReady?.();
        optsRef.current.onProgress?.(1);
        optsRef.current.onReady?.();
      }
    }, optsRef.current.timeoutMs ?? 15000);

    const check = () => {
      tries++;
      optsRef.current.onProgress?.(Math.min(1, tries / MAX_TRIES));

      const mat = (g as any).globeMaterial?.();
      const tex = mat?.map as { image?: any } | undefined;
      const img = tex?.image as HTMLImageElement | ImageBitmap | undefined;
      const ready = !!img && ((img as any).naturalWidth > 0 || (img as any).width > 0);

      if (ready) {
        const arm = () => {
          passes++;
          if (passes < 2) raf = requestAnimationFrame(arm);
          else {
            clearTimeout(fallback);
            optsRef.current.onProgress?.(1);
            optsRef.current.onBeforeReady?.();
            if (!fired) {
              fired = true;
              optsRef.current.onReady?.();
            }
          }
        };
        raf = requestAnimationFrame(arm);
        return;
      }
      if (tries < MAX_TRIES) raf = requestAnimationFrame(check);
    };

    raf = requestAnimationFrame(check);
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(fallback);
    };
  }, [ref, imgUrl]);
}
