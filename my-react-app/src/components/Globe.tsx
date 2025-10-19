import * as THREE from 'three';
import { useEffect, useMemo, useRef, useState } from 'react';
import RGGlobe, { type GlobeMethods } from 'react-globe.gl';
import { KTX2Loader } from 'three/examples/jsm/loaders/KTX2Loader.js';

import earthImg from '@/assets/img/earth.jpg';
import { getUSStatePaths, getCanadaProvincePaths, getWorldCountryPaths } from '@/data';
import { useWindowSize } from '@/hooks';
import type { GlobeProps } from '@/types';
import type { RefObject } from 'react';
import type { CompressedTexture } from 'three';
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

/* helpers */
function sceneOf(ref: RefObject<GlobeMethods | undefined>) {
  const g = ref.current;
  const scene = g?.scene();
  return scene ?? null;
}
function rendererOf(ref: RefObject<GlobeMethods | undefined>) {
  const g = ref.current;
  const r = g?.renderer?.() as THREE.WebGLRenderer | undefined;
  return r ?? null;
}
function globeRadius(scene: THREE.Scene, fallback = 100) {
  let radius = fallback;
  scene.traverse((o: any) => {
    if (o?.geometry?.type === 'SphereGeometry') {
      const r = o.geometry.parameters?.radius;
      if (typeof r === 'number') radius = r;
    }
  });
  return radius;
}

/* shared view-space light */
const VIEW_LIGHT_DIR = new THREE.Vector3(-0.9, 0.9, 0.6).normalize();

/* night overlay */
function makeTerminatorMaterial(strength = 0.92, softness = 0.22) {
  return new THREE.ShaderMaterial({
    uniforms: {
      uLightDirVS: { value: VIEW_LIGHT_DIR.clone() },
      uStrength: { value: strength },
      uSoft: { value: softness }
    },
    vertexShader: `
      varying vec3 vNvs;
      void main(){
        vNvs = normalize(normalMatrix * normal);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      precision mediump float;
      varying vec3 vNvs;
      uniform vec3  uLightDirVS;
      uniform float uStrength, uSoft;
      void main(){
        float t = dot(normalize(vNvs), normalize(uLightDirVS));
        float a = uStrength * (1.0 - smoothstep(-uSoft, 0.0, t));
        gl_FragColor = vec4(0.0, 0.0, 0.0, a);
      }
    `,
    transparent: true,
    depthTest: false,
    depthWrite: false,
    blending: THREE.NormalBlending,
    name: 'TerminatorMaterial'
  });
}

/* day-side rim */
function makeDayAtmosphereMaterial(
  color = new THREE.Color('lightskyblue'),
  strength = 1.15,
  softness = 0.22,
  rimPower = 4.0
) {
  return new THREE.ShaderMaterial({
    uniforms: {
      uColor: { value: color },
      uLightDirVS: { value: VIEW_LIGHT_DIR.clone() },
      uStrength: { value: strength },
      uSoft: { value: softness },
      uRimPower: { value: rimPower }
    },
    vertexShader: `
      varying vec3 vNvs;
      varying vec3 vPosVS;
      void main() {
        vNvs = normalize(normalMatrix * normal);
        vec4 p = modelViewMatrix * vec4(position, 1.0);
        vPosVS = vec3(p);
        gl_Position = projectionMatrix * p;
      }
    `,
    fragmentShader: `
      precision mediump float;
      varying vec3 vNvs;
      varying vec3 vPosVS;
      uniform vec3  uColor;
      uniform vec3  uLightDirVS;
      uniform float uStrength, uSoft, uRimPower;
      void main() {
        vec3 N = normalize(vNvs);
        vec3 L = normalize(uLightDirVS);
        vec3 V = normalize(-vPosVS);
        float day = smoothstep(0.0, uSoft, dot(N, L));
        float rim = pow(1.0 - max(dot(N, V), 0.0), uRimPower);
        float a = uStrength * day * rim;
        gl_FragColor = vec4(uColor, a);
      }
    `,
    transparent: true,
    depthWrite: false,
    depthTest: false,
    blending: THREE.AdditiveBlending,
    name: 'DayAtmosphereMaterial'
  });
}

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

  /* progress boot */
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

  /* KTX2-first; PNG is lazy fallback loaded only if KTX2 fails */
  const [ktxTex, setKtxTex] = useState<CompressedTexture | null>(null);
  useEffect(() => {
    let disposed = false;
    const tmp = new THREE.WebGLRenderer({ antialias: true });
    const loader = new KTX2Loader()
      .setTranscoderPath(`${import.meta.env.BASE_URL}basis/`)
      .detectSupport(tmp);

    loader.load(
      `${import.meta.env.BASE_URL}textures/earth_16k_uastc.ktx2`,
      (t: CompressedTexture) => {
        if (disposed) return;
        if ('SRGBColorSpace' in THREE) (t as any).colorSpace = (THREE as any).SRGBColorSpace;
        else (t as any).encoding = (THREE as any).sRGBEncoding;
        t.generateMipmaps = false;
        t.minFilter = THREE.LinearFilter;
        t.magFilter = THREE.LinearFilter;
        t.anisotropy = Math.min(16, tmp.capabilities.getMaxAnisotropy());
        t.needsUpdate = true;
        setKtxTex(t);
        setGpuMax?.(1);
        loader.dispose();
        tmp.forceContextLoss?.();
        tmp.dispose();
      },
      undefined,
      () => {
        loader.dispose();
        tmp.forceContextLoss?.();
        tmp.dispose();
      }
    );

    return () => {
      disposed = true;
      loader.dispose();
      tmp.forceContextLoss?.();
      tmp.dispose();
    };
  }, [setGpuMax]);

  /* swap to KTX2 texture when available */
  useEffect(() => {
    if (!ktxTex || !imgUrl) return;
    let cancelled = false;
    let tries = 0;
    const findMaterial = () => {
      const g = globeRef.current as any;
      const apiMat = g?.globeMaterial?.();
      if (apiMat) return apiMat;
      let found: any;
      const scn = g?.scene?.();
      scn?.traverse((o: any) => {
        if (found) return;
        if (o?.isMesh && o?.geometry?.type === 'SphereGeometry' && o?.material?.map !== undefined) {
          found = o.material;
        }
      });
      return found;
    };
    const apply = () => {
      const mat: any = findMaterial();
      if (!mat) {
        if (!cancelled && ++tries < 200) setTimeout(apply, 30);
        return;
      }
      const r = rendererOf(globeRef);
      if (r) ktxTex.anisotropy = Math.min(16, r.capabilities.getMaxAnisotropy());
      ktxTex.generateMipmaps = false;
      ktxTex.minFilter = THREE.LinearMipmapLinearFilter;
      ktxTex.magFilter = THREE.LinearFilter;
      if ('SRGBColorSpace' in THREE) (ktxTex as any).colorSpace = (THREE as any).SRGBColorSpace;
      else (ktxTex as any).encoding = (THREE as any).sRGBEncoding;
      const prev = mat.map as THREE.Texture | null;
      mat.map = ktxTex;
      mat.needsUpdate = true;
      prev?.dispose?.();
    };
    apply();
    return () => {
      cancelled = true;
    };
  }, [ktxTex, imgUrl]);

  // Dispose KTX texture on unmount
  useEffect(
    () => () => {
      ktxTex?.dispose();
    },
    [ktxTex]
  );

  /* renderer sizing */
  useEffect(() => {
    const r = rendererOf(globeRef);
    if (!r) return;
    const rect = r.domElement.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    r.setPixelRatio(Math.min(dpr, 2));
    r.setSize(rect.width, rect.height, false);
  }, [w, h, imgUrl]);

  /* lights */
  useEffect(() => {
    const scene = sceneOf(globeRef);
    if (!scene) return;
    scene.children.filter((o: any) => o.isLight).forEach((l) => scene.remove(l));
    const amb = new THREE.AmbientLight(0xffffff, 0.04);
    scene.add(amb);
    return () => {
      scene.remove(amb);
    };
  }, [imgUrl]);

  /* overlays */
  useEffect(() => {
    const scene = sceneOf(globeRef);
    if (!scene) return;
    const radius = globeRadius(scene, 100);

    const nightGeo = new THREE.SphereGeometry(radius * 1.003, 128, 128);
    const nightMat = makeTerminatorMaterial(0.92, 0.22);
    const nightMesh = new THREE.Mesh(nightGeo, nightMat);
    nightMesh.name = 'TerminatorOverlay';
    nightMesh.renderOrder = 5;
    scene.add(nightMesh);

    const atmGeo = new THREE.SphereGeometry(radius * 1.006, 128, 128);
    const atmMat = makeDayAtmosphereMaterial(new THREE.Color('lightskyblue'), 1.2, 0.25, 3.0);
    const atmMesh = new THREE.Mesh(atmGeo, atmMat);
    atmMesh.name = 'DayAtmosphere';
    atmMesh.renderOrder = 9;
    scene.add(atmMesh);

    return () => {
      scene.remove(nightMesh);
      scene.remove(atmMesh);
      nightGeo.dispose();
      nightMat.dispose();
      atmGeo.dispose();
      atmMat.dispose();
    };
  }, [imgUrl]);

  /* setup and controls */
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
      showAtmosphere={false}
      rendererConfig={{ antialias: true, alpha: false, powerPreference: 'high-performance' }}
    />
  );
}
