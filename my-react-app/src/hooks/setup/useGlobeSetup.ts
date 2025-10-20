import { useEffect, type RefObject } from 'react';
import {
  type ColorSpace,
  CompressedTexture,
  LinearFilter,
  LinearMipmapLinearFilter,
  NoToneMapping,
  SRGBColorSpace,
  Texture
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
      const tex = mat.map as Texture & Partial<CompressedTexture>;
      const hasMips = Array.isArray((tex as any).mipmaps) && (tex as any).mipmaps.length > 1;
      tex.anisotropy = r.capabilities.getMaxAnisotropy?.() ?? 1;
      (tex as any).colorSpace = SRGBColorSpace;

      if ((tex as any).isCompressedTexture) {
        tex.generateMipmaps = false; // keep KTX2 mip chain
        tex.minFilter = hasMips ? LinearMipmapLinearFilter : LinearFilter; // KTX2 includes mips
        tex.magFilter = LinearFilter;
      } else {
        tex.generateMipmaps = true;
        tex.minFilter = LinearMipmapLinearFilter;
        tex.magFilter = LinearFilter;
      }
      mat.needsUpdate = true;
    }
  }, [ref, imgUrl]);
}
