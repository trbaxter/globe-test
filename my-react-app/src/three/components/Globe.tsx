import { useEffect, useMemo, useRef, useState } from 'react';
import Globe, { type GlobeMethods } from 'react-globe.gl';
import countries from '@/data/low_res.geo.json';
import states from '@/data/gz_2010_us_040_00_500k.json';
import type { FeatureCollection, Position } from 'geojson';
import type { WebGLRendererParameters } from 'three';

type Props = {
  autoRotate?: boolean;
  autoRotateSpeed?: number;
  backgroundColor?: string;
  rendererConfig?: WebGLRendererParameters;
  highlightByRegion?: { americas?: string[]; apac?: string[]; emea?: string[] };
};

type Path = { path: { lat: number; lng: number }[]; kind: 'country' | 'state' };

const iso3 = (p: any) => p?.iso_a3 ?? p?.adm0_a3 ?? p?.gu_a3 ?? p?.adm0_a3_us;

/** Smooth-mode for 60 Hz displays. */
const isSmoothMode = true;
const DENSIFY_STEP = isSmoothMode ? 0.25 : 0.5;
const LINE_LIFT = isSmoothMode ? 0.005 : 0.003;
const STROKE_PX = isSmoothMode ? 1.1 : 0.6;
const ROTATE_SPEED = isSmoothMode ? 0.25 : 0.5;

const asset = (p: string) => `${import.meta.env.BASE_URL}images/${p}`;

// Skip list (ADM0 ISO-3)
const SKIP_ADM0 = new Set(['GUF']); // French Guiana

// Densify to reduce aliasing shimmer
function densify(line: Position[], maxStepDeg = DENSIFY_STEP): Position[] {
  const out: Position[] = [];
  for (let i = 0; i < line.length - 1; i++) {
    const [lon1, lat1] = line[i] as [number, number];
    const [lon2, lat2] = line[i + 1] as [number, number];
    const steps = Math.max(
      1,
      Math.ceil(Math.max(Math.abs(lon2 - lon1), Math.abs(lat2 - lat1)) / maxStepDeg)
    );
    for (let k = 0; k < steps; k++) {
      const t = k / steps;
      out.push([lon1 + (lon2 - lon1) * t, lat1 + (lat2 - lat1) * t]);
    }
  }
  out.push(line[line.length - 1]);
  return out;
}

function toPaths(fc: FeatureCollection, kind: 'country' | 'state'): Path[] {
  const out: Path[] = [];
  for (const f of fc.features) {
    const g: any = f.geometry;
    if (!g) continue;

    const pushRing = (ring: Position[]) =>
      out.push({
        path: densify(ring).map(([lon, lat]) => ({ lat: lat as number, lng: lon as number })),
        kind
      });

    if (g.type === 'Polygon') g.coordinates.forEach(pushRing);
    else if (g.type === 'MultiPolygon')
      g.coordinates.forEach((poly: Position[][]) => poly.forEach(pushRing));
    else if (g.type === 'LineString')
      out.push({
        path: densify(g.coordinates as Position[]).map(([lon, lat]) => ({
          lat: lat as number,
          lng: lon as number
        })),
        kind
      });
    else if (g.type === 'MultiLineString')
      g.coordinates.forEach((line: Position[]) =>
        out.push({
          path: densify(line).map(([lon, lat]) => ({ lat: lat as number, lng: lon as number })),
          kind
        })
      );
  }
  return out;
}

export default function GlobeComponent({
  autoRotate = true,
  autoRotateSpeed = 0.5,
  backgroundColor = '#000',
  rendererConfig = { antialias: true, alpha: false, powerPreference: 'high-performance' },
  highlightByRegion = {}
}: Props) {
  const globeRef = useRef<GlobeMethods | undefined>(undefined);
  const [{ w, h }, setSize] = useState({ w: window.innerWidth, h: window.innerHeight });

  // Filter countries once using skip list
  const countriesFC = countries as FeatureCollection;
  const countriesFiltered: FeatureCollection = useMemo(
    () => ({
      ...countriesFC,
      features: countriesFC.features.filter(
        (f) => !SKIP_ADM0.has((f.properties as any)?.adm0_a3 as string)
      )
    }),
    []
  );

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
      controls.enableDamping = true;
      controls.dampingFactor = 0.05;
      controls.autoRotate = autoRotate;
      controls.autoRotateSpeed = isSmoothMode ? ROTATE_SPEED : autoRotateSpeed;
    }

    globe.pointOfView({ lat: 20, lng: 0, altitude: 2 }, 0);

    const mat = globe.globeMaterial?.();
    if (mat) {
      mat.bumpScale = 10;
      mat.polygonOffset = true;
      mat.polygonOffsetFactor = 1;
      mat.polygonOffsetUnits = 1;
      mat.needsUpdate = true;
    }

    globe.renderer?.().setPixelRatio?.(Math.min(window.devicePixelRatio || 1, 2));
    globe.pathAltitude?.(LINE_LIFT);
  }, [autoRotate, autoRotateSpeed, w, h]);

  const paths = useMemo(
    () => [
      ...toPaths(countriesFiltered, 'country'),
      ...toPaths(states as FeatureCollection, 'state')
    ],
    [countriesFiltered]
  );

  const regionSets = useMemo(() => {
    const { americas = [], apac = [], emea = [] } = highlightByRegion ?? {};
    return { americas: new Set(americas), apac: new Set(apac), emea: new Set(emea) };
  }, [highlightByRegion]);

  const polys = useMemo(() => {
    return countriesFiltered.features.filter((f) => {
      const code = iso3(f.properties as any);
      return (
        regionSets.americas.has(code) || regionSets.apac.has(code) || regionSets.emea.has(code)
      );
    });
  }, [countriesFiltered, regionSets]);

  const capColor = (d: any) => {
    const code = iso3(d.properties);
    if (regionSets.americas.has(code)) return 'rgba(255, 215, 0, 0.25)';
    if (regionSets.apac.has(code)) return 'rgba(0, 200, 255, 0.25)';
    if (regionSets.emea.has(code)) return 'rgba(255, 0, 180, 0.25)';
    return 'rgba(0, 0, 0, 0)';
  };

  const sideColor = (d: any) => capColor(d).replace(/0\.18\)$/, '0.06)');

  return (
    <Globe
      ref={globeRef}
      width={w}
      height={h}
      globeImageUrl={asset('earth-blue-marble.jpg')}
      bumpImageUrl={asset('earth-topology.png')}
      backgroundColor={backgroundColor}
      showAtmosphere
      atmosphereColor="lightskyblue"
      atmosphereAltitude={0.15}
      /* borders */
      pathsData={paths}
      pathPoints="path"
      pathPointLat="lat"
      pathPointLng="lng"
      pathColor={() => '#EEEEEE'}
      pathStroke={() => STROKE_PX}
      pathTransitionDuration={0}
      /* fills */
      polygonsData={polys}
      polygonCapColor={capColor}
      polygonSideColor={sideColor}
      polygonAltitude={LINE_LIFT}
      /* renderer */
      rendererConfig={{ ...rendererConfig, logarithmicDepthBuffer: true }}
    />
  );
}
