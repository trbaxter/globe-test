import { useEffect } from 'react';
import type { RefObject } from 'react';
import type { GlobeMethods } from 'react-globe.gl';

type Opts = {
  onProgress?: (p01: number) => void; // update pGpu
  onBeforeReady?: () => void; // e.g., capRef.current = 1
  onReady?: () => void;
  timeoutMs?: number; // default 15000
  maxTries?: number; // default 900
};

export function useGlobeReady(
  ref: RefObject<GlobeMethods | undefined>,
  imgUrl: string | null,
  opts: Opts = {}
): void {
  useEffect(() => {
    const g = ref.current;
    if (!g || !imgUrl) return;

    let raf = 0;
    let passes = 0;
    let tries = 0;
    let fired = false;
    const MAX_TRIES = opts.maxTries ?? 900;

    const fallback = window.setTimeout(() => {
      if (!fired) {
        fired = true;
        opts.onBeforeReady?.();
        opts.onProgress?.(1);
        opts.onReady?.();
      }
    }, opts.timeoutMs ?? 15000);

    const check = () => {
      tries++;
      opts.onProgress?.(Math.min(1, tries / MAX_TRIES));

      const mat = (g as any).globeMaterial?.();
      const tex = mat?.map as { image?: any } | undefined;
      const img = tex?.image as HTMLImageElement | ImageBitmap | undefined;
      const ready = !!img && ((img as any).naturalWidth > 0 || (img as any).width > 0);

      if (ready) {
        const arm = () => {
          passes++;
          if (passes < 2) {
            raf = requestAnimationFrame(arm);
          } else {
            clearTimeout(fallback);
            opts.onProgress?.(1);
            opts.onBeforeReady?.();
            if (!fired) {
              fired = true;
              opts.onReady?.();
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
  }, [ref, imgUrl, opts.maxTries, opts.timeoutMs]);
}
