import { useEffect, useMemo, useRef } from 'react';
import RGGlobe, { type GlobeMethods } from 'react-globe.gl';
import earthImg from '@/assets/img/earth.jpg';
import { getUSStatePaths } from '@/components/three/StateBordersPaths';
import { getCanadaProvincePaths } from '@/components/three/ProvincesBordersPaths';
import { getWorldCountryPaths } from '@/components/three/CountryBordersPaths';
import { useWindowSize } from '@/hooks/dom/useWindowSize';
import type { GlobeProps, PathRec, PhaseKey } from '@/types/globe';
import { useComposedTexture } from '@/hooks/texture/useComposedTexture';
import { useGlobeSetup } from '@/hooks/setup/useGlobeSetup';
import { useGlobeZoom } from '@/hooks/zoom/useGlobeZoom';
import { useCursorLatLong } from '@/hooks/cursor/useCursorLatLong';

export default function GlobeComponent({ onReady, onProgress, onCursorLL }: GlobeProps) {
  const globeRef = useRef<GlobeMethods | undefined>(undefined);

  const statePaths = useMemo(() => getUSStatePaths() as unknown as PathRec[], []);
  const provincePaths = useMemo(() => getCanadaProvincePaths() as unknown as PathRec[], []);
  const countryPaths = useMemo(() => getWorldCountryPaths() as unknown as PathRec[], []);

  const { w, h } = useWindowSize();

  const progRef = useRef<Record<PhaseKey, number>>({ pNet: 0, pCompose: 0, pDecode: 0, pGpu: 0 });
  const lastFracRef = useRef(0);
  const capRef = useRef(0);
  const weights = { net: 0.6, compose: 0.25, decode: 0.1, gpu: 0.05 };

  const report = () => {
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
  };

  const capTo = (target: number, ms: number) => {
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
  };

  useEffect(() => {
    progRef.current = { pNet: 0, pCompose: 0, pDecode: 0, pGpu: 0 };
    lastFracRef.current = 0;
    capRef.current = 0;
    onProgress?.(0, 1);
    capTo(0.35, 1200);
  }, [countryPaths, statePaths, provincePaths, onProgress]);

  const imgUrl = useComposedTexture({
    baseUrl: earthImg,
    countryPaths,
    statePaths,
    provincePaths,
    onNetProgress: (p) => {
      progRef.current.pNet = p;
      report();
    },
    onComposeProgress: (p) => {
      progRef.current.pCompose = Math.max(progRef.current.pCompose, p);
      report();
    },
    onDecodeProgress: (p) => {
      progRef.current.pDecode = Math.max(progRef.current.pDecode, p);
      report();
    },
    capTo
  });

  const setupOpts = useMemo(
    () => ({ pixelRatioMax: 2, startPOV: { lat: 38, lng: -95, altitude: 1.6 } }),
    []
  );
  useGlobeSetup(globeRef, imgUrl, setupOpts);

  const zoomOpts = useMemo(() => ({ min: 0.01, max: 3, base: 1.9, startAlt: 1.6 }), []);
  useGlobeZoom(globeRef, imgUrl, zoomOpts);
  useCursorLatLong(globeRef, imgUrl, onCursorLL);

  useEffect(() => {
    const g = globeRef.current;
    if (!g || !imgUrl) return;

    const r = g.renderer?.();
    const dom = r?.domElement;
    if (!dom) return;

    const c = g.controls?.() as any;
    if (c) {
      c.enableDamping = true;
      c.dampingFactor = 0.09;
      c.rotateSpeed = 0.55;
      c.enableZoom = false;
    }
  }, [imgUrl]);

  useEffect(() => {
    const g = globeRef.current;
    if (!g || !imgUrl) return;
    let raf = 0;
    let passes = 0;
    let tries = 0;
    let fired = false;
    const MAX_TRIES = 900;
    const fallback = window.setTimeout(() => {
      if (!fired) onReady?.();
    }, 15000);

    const check = () => {
      tries++;
      progRef.current.pGpu = Math.min(1, Math.max(progRef.current.pGpu, tries / MAX_TRIES));
      report();

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
            progRef.current.pGpu = 1;
            capRef.current = 1;
            report();
            fired = true;
            onReady?.();
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
  }, [imgUrl, onReady]);

  if (!imgUrl) return null;

  return (
    <RGGlobe
      key={imgUrl || 'no-img'}
      ref={globeRef}
      width={w}
      height={h}
      globeImageUrl={imgUrl}
      backgroundColor="#000"
      showAtmosphere
      atmosphereColor="lightskyblue"
      atmosphereAltitude={0.12}
      rendererConfig={{ antialias: true, alpha: false, powerPreference: 'high-performance' }}
    />
  );
}
