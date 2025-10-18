import { useCallback, useRef } from 'react';
import type { PhaseKey } from '@/types';

type Weights = { net: number; compose: number; decode: number; gpu: number };

export function useLoadProgress(
  onProgress?: (loaded: number, total: number) => void,
  weights: Weights = { net: 0.6, compose: 0.25, decode: 0.1, gpu: 0.05 }
) {
  const progRef = useRef<Record<PhaseKey, number>>({ pNet: 0, pCompose: 0, pDecode: 0, pGpu: 0 });
  const lastFracRef = useRef(0);
  const capRef = useRef(0);

  const report = useCallback(() => {
    const p = progRef.current;
    const raw =
      weights.net * p.pNet +
      weights.compose * p.pCompose +
      weights.decode * p.pDecode +
      weights.gpu * p.pGpu;
    const frac = Math.min(0.995, Math.min(raw, capRef.current));
    if (frac >= lastFracRef.current) {
      lastFracRef.current = frac;
      onProgress?.(frac, 1);
    }
  }, [onProgress, weights.compose, weights.decode, weights.gpu, weights.net]);

  const capTo = useCallback(
    (target: number, ms: number) => {
      const start = performance.now();
      const c0 = capRef.current;
      const step = (t: number) => {
        const k = Math.min(1, (t - start) / ms);
        const eased = c0 + (target - c0) * (1 - Math.pow(1 - k, 3));
        capRef.current = Math.max(c0, Math.min(target, eased));
        report();
        if (k < 1) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    },
    [report]
  );

  const setCap = useCallback(
    (v: number) => {
      capRef.current = v;
      report();
    },
    [report]
  );

  const reset = useCallback(() => {
    progRef.current = { pNet: 0, pCompose: 0, pDecode: 0, pGpu: 0 };
    lastFracRef.current = 0;
    capRef.current = 0;
    onProgress?.(0, 1);
  }, [onProgress]);

  const setNet = useCallback(
    (p: number) => {
      progRef.current.pNet = p;
      report();
    },
    [report]
  );
  const setComposeMax = useCallback(
    (p: number) => {
      progRef.current.pCompose = Math.max(progRef.current.pCompose, p);
      report();
    },
    [report]
  );
  const setDecodeMax = useCallback(
    (p: number) => {
      progRef.current.pDecode = Math.max(progRef.current.pDecode, p);
      report();
    },
    [report]
  );
  const setGpuMax = useCallback(
    (p: number) => {
      progRef.current.pGpu = Math.max(progRef.current.pGpu, p);
      report();
    },
    [report]
  );

  return { reset, capTo, setCap, setNet, setComposeMax, setDecodeMax, setGpuMax };
}
