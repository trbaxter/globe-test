import { useEffect, useRef, useState } from 'react';
import { drawBorders } from '@/components/utils/drawBorders';
import { fetchAsBlob } from '@/components/utils/fetchAsBlob';
import type { PathRec } from '@/types/globe.ts';

type Cbs = {
  onNetProgress?: (p: number) => void;
  onComposeProgress?: (p: number) => void;
  onDecodeProgress?: (p: number) => void;
  capTo?: (target: number, ms: number) => void;
};

export function useComposedTexture(
  params: {
    baseUrl: string;
    countryPaths: PathRec[];
    statePaths: PathRec[];
    provincePaths: PathRec[];
  } & Cbs
): string | null {
  const { baseUrl, countryPaths, statePaths, provincePaths } = params;
  const cbsRef = useRef<Cbs>({
    onNetProgress: params.onNetProgress,
    onComposeProgress: params.onComposeProgress,
    onDecodeProgress: params.onDecodeProgress,
    capTo: params.capTo
  });
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    cbsRef.current = {
      onNetProgress: params.onNetProgress,
      onComposeProgress: params.onComposeProgress,
      onDecodeProgress: params.onDecodeProgress,
      capTo: params.capTo
    };
  }, [params.onNetProgress, params.onComposeProgress, params.onDecodeProgress, params.capTo]);

  useEffect(() => {
    let cancelled = false;
    let objUrl: string | null = null;

    const rampCompose = (ms = 500) => {
      const start = performance.now();
      const step = (t: number) => {
        const k = Math.min(1, (t - start) / ms);
        const eased = 1 - Math.pow(1 - k, 3);
        cbsRef.current.onComposeProgress?.(eased);
        if (k < 1) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    };

    async function run() {
      try {
        const baseBlob = await fetchAsBlob(baseUrl, (p) => cbsRef.current.onNetProgress?.(p));
        const baseBmp = await createImageBitmap(baseBlob);

        const cw = baseBmp.width;
        const ch = baseBmp.height;

        const canvas = document.createElement('canvas');
        canvas.width = cw;
        canvas.height = ch;
        const ctx = canvas.getContext('2d', { alpha: false });
        if (!ctx) {
          setUrl(baseUrl);
          return;
        }

        (ctx as any).imageSmoothingEnabled = true;
        (ctx as any).imageSmoothingQuality = 'high';
        ctx.drawImage(baseBmp, 0, 0, cw, ch);
        drawBorders(ctx, cw, ch, { countryPaths, statePaths, provincePaths });

        cbsRef.current.capTo?.(0.7, 700);
        rampCompose(500);

        const composedBlob: Blob = await new Promise((resolve) =>
          canvas.toBlob((b) => resolve((b as Blob) ?? new Blob()), 'image/jpeg', 0.96)
        );
        const blobUrl = URL.createObjectURL(composedBlob);

        const im = new Image();
        im.src = blobUrl;
        if ((im as HTMLImageElement & { decode?: () => Promise<void> }).decode) {
          try {
            await (im as any).decode();
          } catch {}
        }
        cbsRef.current.onDecodeProgress?.(1);
        cbsRef.current.capTo?.(0.92, 600);

        if (!cancelled) {
          objUrl = blobUrl;
          setUrl(blobUrl);
        } else {
          URL.revokeObjectURL(blobUrl);
        }
      } catch {
        setUrl(baseUrl);
      }
    }

    run();
    return () => {
      cancelled = true;
      if (objUrl) URL.revokeObjectURL(objUrl);
    };
  }, [baseUrl, countryPaths, statePaths, provincePaths]);

  return url;
}
