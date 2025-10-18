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

  // Memoize setup options so POV is not re-applied every render.
  const setupOpts = useMemo(
    () => ({ pixelRatioMax: 2, startPOV: { lat: 38, lng: -95, altitude: 1.6 } }),
    []
  );
  useGlobeSetup(globeRef, imgUrl, setupOpts);

  useEffect(() => {
    const g = globeRef.current;
    if (!g || !imgUrl) return;

    const r = g.renderer?.();
    const dom = r?.domElement;
    if (!dom) return;

    const ALT_MIN = 0.01;
    const ALT_MAX = 3.0;
    const ZOOM_BASE = 1.9;
    const DELTA_UNIT = 100;
    const TAU = 0.12;
    const EPS = 0.0015;
    const DRAG_UNIT = 120;

    const targetAlt = { v: 1.6 };
    let raf = 0;
    let last = 0;

    const step = (tNow: number) => {
      const povNow = (g as any).pointOfView();
      const cur = typeof povNow?.altitude === 'number' ? povNow.altitude : 1.6;
      const dt = Math.min(0.05, (tNow - last) / 1000 || 0.016);
      last = tNow;
      const alpha = 1 - Math.exp(-dt / TAU);
      const nxt = cur + (targetAlt.v - cur) * alpha;
      (g as any).pointOfView({ ...povNow, altitude: nxt }, 0);
      if (Math.abs(targetAlt.v - nxt) > EPS) raf = requestAnimationFrame(step);
      else raf = 0;
    };

    const kick = (newTarget: number) => {
      targetAlt.v = Math.min(ALT_MAX, Math.max(ALT_MIN, newTarget));
      if (!raf) {
        last = performance.now();
        raf = requestAnimationFrame(step);
      }
    };

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      e.stopImmediatePropagation();
      const unit = e.deltaMode === 1 ? 35 : 1;
      const delta = e.deltaY * unit;
      const repeats = Math.max(1, Math.round(Math.abs(delta) / DELTA_UNIT));
      const factor = Math.pow(ZOOM_BASE, repeats);
      const pov = (g as any).pointOfView();
      const cur = typeof pov?.altitude === 'number' ? pov.altitude : 1.6;
      const next = delta < 0 ? cur / factor : cur * factor;
      kick(next);
    };

    let dragging = false;
    let startY = 0;
    let startAlt = 1.6;

    const onContextMenu = (e: MouseEvent) => {
      e.preventDefault();
    };

    const onMouseDown = (e: MouseEvent) => {
      if (e.button !== 2) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      dragging = true;
      startY = e.clientY;
      const pov = (g as any).pointOfView();
      startAlt = typeof pov?.altitude === 'number' ? pov.altitude : 1.6;
      dom.addEventListener('mousemove', onMouseMove, { passive: false, capture: true });
      window.addEventListener('mouseup', onMouseUp, { passive: true, capture: true });
    };

    const onMouseMove = (e: MouseEvent) => {
      if (!dragging) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      const dy = e.clientY - startY;
      const f = Math.pow(ZOOM_BASE, Math.abs(dy) / DRAG_UNIT);
      const next = dy < 0 ? startAlt / f : startAlt * f;
      kick(next);
    };

    const onMouseUp = () => {
      if (!dragging) return;
      dragging = false;
      dom.removeEventListener('mousemove', onMouseMove, true);
      window.removeEventListener('mouseup', onMouseUp, true);
    };

    const c = g.controls?.() as any;
    if (c) {
      c.enableDamping = true;
      c.dampingFactor = 0.09;
      c.rotateSpeed = 0.55;
      c.enableZoom = false;
    }

    dom.addEventListener('wheel', onWheel, { passive: false, capture: true });
    dom.addEventListener('contextmenu', onContextMenu);
    dom.addEventListener('mousedown', onMouseDown, { passive: false, capture: true });

    // cursor → lat/lng
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
      dom.removeEventListener('wheel', onWheel, true);
      dom.removeEventListener('contextmenu', onContextMenu);
      dom.removeEventListener('mousedown', onMouseDown, true);
      dom.removeEventListener('mousemove', onMouseMove, true);
      window.removeEventListener('mouseup', onMouseUp, true);

      dom.removeEventListener('mousemove', onCursorMove);
      dom.removeEventListener('mouseleave', onLeave);
      if (mmRaf) cancelAnimationFrame(mmRaf);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [imgUrl, w, h, onCursorLL]);

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
