import { useEffect } from 'react';
import * as THREE from 'three';
import type { GlobeMethods } from 'react-globe.gl';

type POV = { lat: number; lng: number; altitude: number };

export function useGlobeSetup(
  ref: React.RefObject<GlobeMethods | undefined>,
  imgUrl: string | null,
  opts?: {
    pixelRatioMax?: number;
    startPOV?: POV;
    colorSpace?: THREE.ColorSpace;
  }
): void {
  useEffect(() => {
    const g = ref.current;
    if (!g || !imgUrl) return;

    const pixelRatioMax = opts?.pixelRatioMax ?? 2;
    const startPOV = opts?.startPOV ?? { lat: 38, lng: -95, altitude: 1.6 };
    const colorSpace = opts?.colorSpace ?? THREE.SRGBColorSpace;

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
  }, [ref, imgUrl, opts?.pixelRatioMax, opts?.startPOV, opts?.colorSpace]);
}
