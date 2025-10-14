import { useEffect, useRef, useState } from 'react';
import Globe, { type GlobeMethods } from 'react-globe.gl';
import earthImg from '@/assets/img/earth-blue-marble.jpg';

export default function GlobeComponent() {
  // Mutable reference object. Object's .current value type either GlobeMethods or undefined. Undefined initial value on first render.
  const globeRef = useRef<GlobeMethods | undefined>(undefined);

  const [{ w, h }, setSize] = useState({
    w: typeof window !== 'undefined' ? window.innerWidth : 0,
    h: typeof window !== 'undefined' ? window.innerHeight : 0
  });

  useEffect(() => {
    const onResize = () => setSize({ w: window.innerWidth, h: window.innerHeight });
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  // mount-only setup
  useEffect(() => {
    const globe = globeRef.current;
    if (!globe) return;
    const controls = globe.controls?.();
    controls?.saveState();
    if (controls) {
      const R = globe.getGlobeRadius?.() ?? 100;
      controls.minDistance = R * 1.2;
      controls.maxDistance = R * 2.3;
      controls.update?.();
    }

    globe.pointOfView?.({ lat: 38, lng: -95, altitude: 0.75 }, 0);

    const mat = globe.globeMaterial?.();
    if (mat) {
      mat.polygonOffset = true;
      mat.polygonOffsetFactor = 1;
      mat.polygonOffsetUnits = 1;
      mat.needsUpdate = true;
    }

    globe.renderer?.().setPixelRatio?.(Math.min(window.devicePixelRatio || 1, 3));
  }, []);

  return (
    <Globe
      ref={globeRef}
      width={w}
      height={h}
      globeImageUrl={earthImg}
      backgroundColor={'#000'}
      showAtmosphere={true}
      atmosphereColor="lightskyblue"
      atmosphereAltitude={0.15}
      rendererConfig={{ antialias: true, alpha: false, powerPreference: 'high-performance' }}
    />
  );
}
