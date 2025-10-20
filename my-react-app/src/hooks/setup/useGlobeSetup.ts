import { useEffect, type RefObject } from 'react';
import {
  type ColorSpace,
  LinearFilter,
  LinearMipmapLinearFilter,
  NoToneMapping,
  SRGBColorSpace
} from 'three';
import type { GlobeMethods } from 'react-globe.gl';
import { useLatest } from '@/hooks/utils/useLatest';

type POV = { lat: number; lng: number; altitude: number };

export function useGlobeSetup(
  ref: RefObject<GlobeMethods | undefined>,
  imgUrl: string | null,
  opts?: {
    pixelRatioMax?: number;
    startPOV?: POV;
    colorSpace?: ColorSpace;
  }
): void {
  const optsRef = useLatest(opts);

  useEffect(() => {
    const g = ref.current;
    if (!g || !imgUrl) return;

    const {
      pixelRatioMax = 2,
      startPOV = { lat: 38, lng: -95, altitude: 1.6 },
      colorSpace = SRGBColorSpace
    } = optsRef.current ?? {};

    const r = g.renderer?.();
    r?.setPixelRatio(Math.min(window.devicePixelRatio || 1, pixelRatioMax));
    if (r) {
      r.outputColorSpace = colorSpace;
      r.toneMapping = NoToneMapping;
    }

    g.pointOfView?.(startPOV, 0);

    const mat = (g as any).globeMaterial?.();
    if (mat?.map && r) {
      mat.map.anisotropy = r.capabilities.getMaxAnisotropy?.() ?? 1;
      (mat.map as any).colorSpace = SRGBColorSpace;
      mat.map.generateMipmaps = true;
      mat.map.minFilter = LinearMipmapLinearFilter;
      mat.map.magFilter = LinearFilter;
      mat.needsUpdate = true;
    }
  }, [ref, imgUrl]);
}
