import { useEffect, useRef, useState } from 'react';
import Globe, { type GlobeMethods } from 'react-globe.gl';
import type { WebGLRendererParameters } from 'three';
import earthImg from '@/img/earth-blue-marble.jpg';

export default function GlobeComponent() {
  const backgroundColor = '#000'; // Black background for space
  const rendererConfig: WebGLRendererParameters = {
    antialias: true,
    alpha: false,
    powerPreference: 'high-performance'
  };

  const globeRef = useRef<GlobeMethods | undefined>(undefined);
  const [{ w, h }, setSize] = useState({ w: window.innerWidth, h: window.innerHeight });

  useEffect(() => {
    const onResize = () => setSize({ w: window.innerWidth, h: window.innerHeight });
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  useEffect(() => {
    const globe = globeRef.current as any;
    if (!globe) return;

    const controls = globe.controls?.();
    if (controls) {
      const R = globe.getGlobeRadius?.() ?? 100;
      controls.minDistance = R * 1.2;
      controls.maxDistance = R * 2.3;
      controls.update?.();
    }

    globe.pointOfView({ lat: 38, lng: -95, altitude: 0.75 }, 0);

    const mat = globe.globeMaterial?.();
    if (mat) {
      mat.bumpScale = 10;
      mat.polygonOffset = true;
      mat.polygonOffsetFactor = 1;
      mat.polygonOffsetUnits = 1;
      mat.needsUpdate = true;
    }

    globe.renderer?.().setPixelRatio?.(Math.min(window.devicePixelRatio || 1, 3));
  }, [w, h]);

  return (
    <Globe
      ref={globeRef}
      animateIn={true}
      width={w}
      height={h}
      globeImageUrl={earthImg}
      backgroundColor={backgroundColor}
      showAtmosphere
      atmosphereColor="lightskyblue"
      atmosphereAltitude={0.15}
      rendererConfig={rendererConfig}
    />
  );
}
