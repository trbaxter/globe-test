import { useEffect, useMemo, useRef } from 'react';
import RGGlobe, { type GlobeMethods } from 'react-globe.gl';
import earthImg from '@/assets/img/earth.jpg';
import { getUSStatePaths, getCanadaProvincePaths, getWorldCountryPaths } from '@/data';
import { useWindowSize } from '@/hooks';
import type { GlobeProps } from '@/types';
import { ensurePathRecs } from '@/types';
import {
  useComposedTexture,
  useCursorLL,
  useGlobeControls,
  useGlobeReady,
  useGlobeSetup,
  useGlobeZoom,
  useLoadProgress
} from '@/hooks';

export default function GlobeComponent({ onReady, onProgress, onCursorLL }: GlobeProps) {
  const globeRef = useRef<GlobeMethods | undefined>(undefined);

  const statePaths = useMemo(() => ensurePathRecs(getUSStatePaths(), 'US state paths'), []);
  const provincePaths = useMemo(
    () => ensurePathRecs(getCanadaProvincePaths(), 'CA province paths'),
    []
  );
  const countryPaths = useMemo(
    () => ensurePathRecs(getWorldCountryPaths(), 'World country paths'),
    []
  );

  const { w, h } = useWindowSize();
  const { reset, capTo, setCap, setNet, setComposeMax, setDecodeMax, setGpuMax } =
    useLoadProgress(onProgress);

  useEffect(() => {
    reset();
    capTo(0.35, 1200);
  }, [countryPaths, statePaths, provincePaths, reset, capTo]);

  const imgUrl = useComposedTexture({
    baseUrl: earthImg,
    countryPaths,
    statePaths,
    provincePaths,
    onNetProgress: setNet,
    onComposeProgress: setComposeMax,
    onDecodeProgress: setDecodeMax,
    capTo
  });

  const setupOpts = useMemo(
    () => ({ pixelRatioMax: 2, startPOV: { lat: 38, lng: -95, altitude: 1.6 } }),
    []
  );
  useGlobeSetup(globeRef, imgUrl, setupOpts);
  const zoomOpts = useMemo(() => ({ min: 0.01, max: 3, base: 1.9, startAlt: 1.6 }), []);

  useGlobeZoom(globeRef, imgUrl, zoomOpts);
  useCursorLL(globeRef, imgUrl, onCursorLL);
  useGlobeControls(globeRef, imgUrl, { damping: 0.09, rotateSpeed: 0.55 });

  useGlobeReady(globeRef, imgUrl, {
    onProgress: setGpuMax,
    onBeforeReady: () => setCap(1),
    onReady
  });

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
