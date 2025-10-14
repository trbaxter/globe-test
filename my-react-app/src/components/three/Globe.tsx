import { useEffect, useRef, useState } from 'react';
import Globe, { type GlobeMethods } from 'react-globe.gl';
import earthImg from '@/assets/img/earth-blue-marble.jpg';

export default function GlobeComponent() {
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

  useEffect(() => {
    const globe = globeRef.current;
    if (!globe) return;
    globe?.renderer?.().setPixelRatio(2); // Sets the pixel ratio to 2x the default

    const c = globe.controls?.();
    if (!c) return;

    const R = globe.getGlobeRadius?.() ?? 100;
    c.minDistance = R * 1.2; // Min zoom level
    c.maxDistance = R * 3; // Max zoom level

    globe.pointOfView?.({ lat: 38, lng: -95, altitude: 1.6 }, 0); // Initial globe perspective
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
      atmosphereAltitude={0.12}
      rendererConfig={{ antialias: true, alpha: false, powerPreference: 'high-performance' }}
    />
  );
}
