import { useEffect, useMemo, useRef, useState } from 'react';
import RGGlobe, { type GlobeMethods } from 'react-globe.gl';
import earthImg from '@/assets/img/earth.jpg';
import { getUSStatePaths } from '@/components/three/StateBordersPaths.ts';
import { getCanadaProvincePaths } from '@/components/three/ProvincesBordersPaths';

export type GlobeProps = {
  onReady?: () => void;
  onProgress?: (loaded: number, total: number) => void;
};

export default function GlobeComponent({ onReady, onProgress }: GlobeProps) {
  const globeRef = useRef<GlobeMethods | undefined>(undefined);

  const statePaths = useMemo(() => getUSStatePaths(), []);
  const provincePaths = useMemo(() => getCanadaProvincePaths(), []);
  const borderPaths = useMemo(() => statePaths.concat(provincePaths), [statePaths, provincePaths]);

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
    const globe = globeRef.current;
    if (!globe) return;
    globe?.renderer?.().setPixelRatio(2);

    const c = globe.controls?.();
    if (!c) return;

    const R = globe.getGlobeRadius?.() ?? 100;
    c.minDistance = R * 1.2;
    c.maxDistance = R * 3;

    globe.pointOfView?.({ lat: 38, lng: -95, altitude: 1.6 }, 0);
  }, [imgUrl]);

  if (!imgUrl) return null;

  return (
    <RGGlobe
      ref={globeRef}
      width={w}
      height={h}
      globeImageUrl={imgUrl}
      backgroundColor={'#000'}
      showAtmosphere={true}
      atmosphereColor="lightskyblue"
      atmosphereAltitude={0.12}
      rendererConfig={{ antialias: true, alpha: false, powerPreference: 'high-performance' }}
      pathLabel={() => ''}
      polygonLabel={() => ''}
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
    />
  );
}
