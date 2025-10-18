import { useEffect } from 'react';
import type { RefObject } from 'react';
import * as THREE from 'three';
import type { GlobeMethods } from 'react-globe.gl';
import { useLatest } from '@/hooks/utils/useLatest';

type POV = { lat: number; lng: number; altitude: number };

export function useGlobeSetup(
  ref: RefObject<GlobeMethods | undefined>,
  imgUrl: string | null,
  opts?: {
    pixelRatioMax?: number;
    startPOV?: POV;
    colorSpace?: THREE.ColorSpace;
  }
): void {
  const optsRef = useLatest(opts);

  useEffect(() => {
    const g = ref.current;
    if (!g || !imgUrl) return;

    const {
      pixelRatioMax = 2,
      startPOV = { lat: 38, lng: -95, altitude: 1.6 },
      colorSpace = THREE.SRGBColorSpace
    } = optsRef.current ?? {};

    const r = g.renderer?.();
    r?.setPixelRatio(Math.min(window.devicePixelRatio || 1, pixelRatioMax));
    if (r) {
      r.outputColorSpace = colorSpace;
      r.toneMapping = THREE.NoToneMapping;
    }

    g.pointOfView?.(startPOV, 0);

    const mat = (g as any).globeMaterial?.();
    if (mat?.map && r) {
      mat.map.anisotropy = r.capabilities.getMaxAnisotropy?.() ?? 1;
      (mat.map as any).colorSpace = THREE.SRGBColorSpace;
      mat.map.generateMipmaps = true;
      mat.map.minFilter = THREE.LinearMipmapLinearFilter;
      mat.map.magFilter = THREE.LinearFilter;
      mat.needsUpdate = true;
    }
  }, [ref, imgUrl]); // opts read via ref
}
