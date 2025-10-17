// src/components/three/Globe.tsx
import { useEffect, useMemo, useRef, useState } from 'react';
import RGGlobe, { type GlobeMethods } from 'react-globe.gl';
import earthImg from '@/assets/img/earth.jpg';
import { getUSStatePaths } from '@/components/three/StateBordersPaths';
import { getCanadaProvincePaths } from '@/components/three/ProvincesBordersPaths';
import { getWorldCountryPaths } from '@/components/three/CountryBordersPaths';

export type GlobeProps = {
  onReady?: () => void;
  onProgress?: (loaded: number, total: number) => void;
};

export default function GlobeComponent({ onReady, onProgress }: GlobeProps) {
  const globeRef = useRef<GlobeMethods | undefined>(undefined);

  const statePaths = useMemo(() => getUSStatePaths(), []);
  const provincePaths = useMemo(() => getCanadaProvincePaths(), []);
  const countryPaths = useMemo(() => getWorldCountryPaths(), []);
  const borderPaths = useMemo(
    () => [...countryPaths, ...statePaths, ...provincePaths],
    [countryPaths, statePaths, provincePaths]
  );

  const [{ w, h }, setSize] = useState({
    w: typeof window !== 'undefined' ? window.innerWidth : 0,
    h: typeof window !== 'undefined' ? window.innerHeight : 0
  });
  const [imgUrl, setImgUrl] = useState<string | null>(null);

  useEffect(() => {
    const onResize = () => setSize({ w: window.innerWidth, h: window.innerHeight });
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  useEffect(() => {
    let cancelled = false;
    let objUrl: string | null = null;

    async function run() {
      try {
        const res = await fetch(earthImg);
        const total = Number(res.headers.get('content-length')) || 0;

        if (!res.ok || !res.body) {
          setImgUrl(earthImg);
          requestAnimationFrame(() => onReady?.());
          return;
        }

        const reader = res.body.getReader();
        const parts: BlobPart[] = [];
        let loaded = 0;

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          if (value) {
            parts.push(value.buffer.slice(value.byteOffset, value.byteOffset + value.byteLength));
            loaded += value.byteLength;
            onProgress?.(loaded, total);
          }
          if (cancelled) return;
        }

        const contentType = res.headers.get('content-type') || 'image/jpeg';
        const blob = new Blob(parts, { type: contentType });
        objUrl = URL.createObjectURL(blob);
        setImgUrl(objUrl);

        const img = new Image();
        img.src = objUrl;
        const anyImg = img as HTMLImageElement & { decode?: () => Promise<void> };
        if (anyImg.decode) {
          try {
            await anyImg.decode();
          } catch {}
        }
        if (!cancelled) requestAnimationFrame(() => onReady?.());
      } catch {
        setImgUrl(earthImg);
        requestAnimationFrame(() => onReady?.());
      }
    }

    void run();
    return () => {
      cancelled = true;
      if (objUrl) URL.revokeObjectURL(objUrl);
    };
  }, [onReady, onProgress]);

  useEffect(() => {
    const g = globeRef.current;
    if (!g || !imgUrl) return;

    g.renderer?.().setPixelRatio(2);
    g.pointOfView?.({ lat: 38, lng: -95, altitude: 1.6 }, 0);

    const dom = g.renderer?.()?.domElement;
    if (!dom) return;

    const ALT_MIN = 0.3;
    const ALT_MAX = 3.0;
    const ZOOM_BASE = 1.9; // per notch multiplier
    const DELTA_UNIT = 100; // px per notch
    const TAU = 0.12; // inertia (s to ~63% toward target)
    const EPS = 0.0015;

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

      if (Math.abs(targetAlt.v - nxt) > EPS) {
        raf = requestAnimationFrame(step);
      } else {
        raf = 0;
      }
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

    const c = g.controls?.() as any;
    c.enableDamping = true;
    c.dampingFactor = 0.075;
    if (c) c.enableZoom = false;

    dom.addEventListener('wheel', onWheel, { passive: false, capture: true });
    return () => {
      dom.removeEventListener('wheel', onWheel, true);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [imgUrl, w, h]);

  if (!imgUrl) return null;

  return (
    <RGGlobe
      ref={globeRef}
      width={w}
      height={h}
      globeImageUrl={imgUrl}
      backgroundColor="#000"
      showAtmosphere
      atmosphereColor="lightskyblue"
      atmosphereAltitude={0.12}
      rendererConfig={{ antialias: true, alpha: false, powerPreference: 'high-performance' }}
      pathsData={borderPaths}
      pathPoints="points"
      pathPointLat="lat"
      pathPointLng="lng"
      pathColor={() => '#ffffff'}
      pathStroke={0.85}
      pathPointAlt={0.0015}
      pathDashLength={0}
      pathDashGap={0}
      pathTransitionDuration={0}
      pathLabel={() => ''}
      polygonLabel={() => ''}
    />
  );
}
