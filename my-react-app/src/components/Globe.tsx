import { useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import RGGlobe, { type GlobeMethods } from 'react-globe.gl';
import {
  AdditiveBlending,
  AmbientLight,
  Color,
  LinearFilter,
  LinearMipmapLinearFilter,
  Mesh,
  NormalBlending,
  Scene,
  ShaderMaterial,
  SphereGeometry,
  SRGBColorSpace,
  Texture,
  Vector3,
  WebGLRenderer,
  type CompressedTexture
} from 'three';
import { KTX2Loader } from 'three/examples/jsm/loaders/KTX2Loader.js';
import { getUSStatePaths, getCanadaProvincePaths, getWorldCountryPaths } from '@/data';
import {
  useComposedTexture,
  useCursorLL,
  useGlobeControls,
  useGlobeReady,
  useGlobeSetup,
  useGlobeZoom,
  useLoadProgress,
  useWindowSize
} from '@/hooks';
import { ensurePathRecs, type GlobeProps } from '@/types';

const earthUrl_Jpg = 'https://pub-221ed7e76f9147fda70d952c90a59f1f.r2.dev/earth.jpg';
const earthUrl = 'https://pub-221ed7e76f9147fda70d952c90a59f1f.r2.dev/earth_16k_uastc.ktx2';
const basisUrl = 'https://pub-221ed7e76f9147fda70d952c90a59f1f.r2.dev/basis/';
const bootImgUrl = earthUrl_Jpg;
const USE_KTX_FIRST = false;
const BOOT_PIXEL =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR4nGNgYAAAAAMAASsJTYQAAAAASUVORK5CYII=';

/* helpers */
function sceneOf(ref: RefObject<GlobeMethods | undefined>) {
  const g = ref.current;
  const scene = g?.scene();
  return scene ?? null;
}
function rendererOf(ref: RefObject<GlobeMethods | undefined>) {
  const g = ref.current;
  const r = g?.renderer?.() as WebGLRenderer | undefined;
  return r ?? null;
}
function globeRadius(scene: Scene, fallback = 100) {
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
const VIEW_LIGHT_DIR = new Vector3(-0.9, 0.9, 0.6).normalize();

/* night overlay */
function makeTerminatorMaterial(strength = 0.92, softness = 0.22) {
  return new ShaderMaterial({
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
    blending: NormalBlending,
    name: 'TerminatorMaterial'
  });
}

/* day-side rim */
function makeDayAtmosphereMaterial(
  color = new Color('lightskyblue'),
  strength = 1.15,
  softness = 0.22,
  rimPower = 4.0
) {
  return new ShaderMaterial({
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
    blending: AdditiveBlending,
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
    baseUrl: bootImgUrl,
    countryPaths,
    statePaths,
    provincePaths,
    onNetProgress: setNet,
    onComposeProgress: setComposeMax,
    onDecodeProgress: setDecodeMax,
    capTo
  });

  /* KTX2-first; earthImg is lazy fallback loaded only if KTX2 fails */
  const [ktxTex, setKtxTex] = useState<CompressedTexture | null>(null);
  useEffect(() => {
    let disposed = false;
    const tmp = new WebGLRenderer({ antialias: true });
    const loader = new KTX2Loader().setTranscoderPath(basisUrl).detectSupport(tmp);

    loader.load(
      earthUrl,
      (t: CompressedTexture) => {
        if (disposed) return;
        (t as any).colorSpace = SRGBColorSpace;
        t.generateMipmaps = false;
        t.minFilter = LinearFilter;
        t.magFilter = LinearFilter;
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
      ktxTex.minFilter = LinearMipmapLinearFilter;
      ktxTex.magFilter = LinearFilter;
      (ktxTex as any).colorSpace = SRGBColorSpace;
      const prev = mat.map as Texture | null;
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
    const amb = new AmbientLight(0xffffff, 0.04);
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

    const nightGeo = new SphereGeometry(radius * 1.003, 128, 128);
    const nightMat = makeTerminatorMaterial(0.92, 0.22);
    const nightMesh = new Mesh(nightGeo, nightMat);
    nightMesh.name = 'TerminatorOverlay';
    nightMesh.renderOrder = 5;
    scene.add(nightMesh);

    const atmGeo = new SphereGeometry(radius * 1.006, 128, 128);
    const atmMat = makeDayAtmosphereMaterial(new Color('lightskyblue'), 1.2, 0.25, 3.0);
    const atmMesh = new Mesh(atmGeo, atmMat);
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

  const zoomOpts = useMemo(() => ({ min: 0.6, max: 3, base: 1.9, startAlt: 1.6 }), []);
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
      globeImageUrl={USE_KTX_FIRST ? BOOT_PIXEL : imgUrl}
      backgroundColor="#000"
      showAtmosphere={false}
      rendererConfig={{ antialias: true, alpha: false, powerPreference: 'high-performance' }}
    />
  );
}
