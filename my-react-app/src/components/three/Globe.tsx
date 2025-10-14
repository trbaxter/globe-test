import { useEffect, useRef, useState } from 'react';
import Globe, { type GlobeMethods } from 'react-globe.gl';
import earthImg from '@/assets/img/earth-blue-marble.jpg';

export default function GlobeComponent() {
  // Mutable reference object. Object's .current value type either GlobeMethods or undefined. Undefined initial value on first render.
  const globeRef = useRef<GlobeMethods | undefined>(undefined);

  // Initializes state object to current window size if exists. (0,0) otherwise. Deconstructs to w & h variables. Uses setSize to update state and re-render.
  const [{ w, h }, setSize] = useState({
    w: typeof window !== 'undefined' ? window.innerWidth : 0,
    h: typeof window !== 'undefined' ? window.innerHeight : 0
  });

  // Listener hook to check if browser changes size and re-render the canvas to fit.
  useEffect(() => {
    const onResize = () => setSize({ w: window.innerWidth, h: window.innerHeight });
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  // Hook for setting up globe controls.
  useEffect(() => {
    // If there's no current globe, don't continue with the hook.
    const globe = globeRef.current;
    if (!globe) return;

    globe?.renderer?.().setPixelRatio(2);

    // If there's no controls object that exists, don't continue with the hook.
    const c = globe.controls?.();
    if (!c) return;

    // Defines R = sphere radius value. Uses 100 if undefined. Sets min & max zoom levels.
    const R = globe.getGlobeRadius?.() ?? 100;
    c.minDistance = R * 1.2;
    c.maxDistance = R * 3;

    // Sets initial perspective on globe on initial render.
    globe.pointOfView?.({ lat: 38, lng: -95, altitude: 1.75 }, 0);
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
