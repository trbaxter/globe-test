import { useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import RGGlobe, { type GlobeMethods } from 'react-globe.gl';
import {
  AdditiveBlending,
  AmbientLight,
  CanvasTexture,
  Color,
  DirectionalLight,
  LinearFilter,
  LinearMipmapLinearFilter,
  Matrix3,
  Mesh,
  MeshBasicMaterial,
  MeshPhongMaterial,
  NoToneMapping,
  NormalBlending,
  RepeatWrapping,
  Scene,
  ShaderMaterial,
  SphereGeometry,
  SRGBColorSpace,
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
import { drawBorders } from '@/utils';
import { ensurePathRecs, type GlobeProps } from '@/types';

const earthUrl_Jpg = 'https://pub-221ed7e76f9147fda70d952c90a59f1f.r2.dev/earth.jpg';
const earthUrl = 'https://pub-221ed7e76f9147fda70d952c90a59f1f.r2.dev/earth_16k_uastc.ktx2';
const basisUrl = 'https://pub-221ed7e76f9147fda70d952c90a59f1f.r2.dev/basis/';
const bootImgUrl = earthUrl_Jpg;

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

  /* KTX2 */
  const [ktxTex, setKtxTex] = useState<CompressedTexture | null>(null);
  const [globeMat, setGlobeMat] = useState<MeshPhongMaterial | null>(null);
  useEffect(() => {
    const tmp = new WebGLRenderer({ antialias: true });
    const loader = new KTX2Loader().setTranscoderPath(basisUrl).detectSupport(tmp);

    loader.load(
      earthUrl,
      (t) => {
        (t as any).flipY = false;
        t.wrapT = RepeatWrapping;
        t.repeat.set(1, -1);
        t.offset.set(0, 1);

        (t as any).colorSpace = SRGBColorSpace;
        t.anisotropy = Math.min(16, tmp.capabilities.getMaxAnisotropy());
        t.needsUpdate = true;
        setKtxTex(t);

        const m = new MeshPhongMaterial({ map: t });
        (m as any).shininess = 0;
        setGlobeMat(m);

        loader.dispose();
        tmp.forceContextLoss?.();
        tmp.dispose();
      },
      undefined,
      (e) => {
        loader.dispose();
        tmp.forceContextLoss?.();
        tmp.dispose();
        console.error('KTX2 error', e);
      }
    );

    return () => {
      loader.dispose();
      tmp.forceContextLoss?.();
      tmp.dispose();
    };
  }, []);

  /* Dispose KTX texture on unmount */
  useEffect(
    () => () => {
      ktxTex?.dispose();
    },
    [ktxTex]
  );

  const readyToken = globeMat ? 'ktx-ready' : null;

  /* renderer sizing */
  useEffect(() => {
    const r = rendererOf(globeRef);
    if (!r) return;
    const rect = r.domElement.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    r.setPixelRatio(Math.min(dpr, 2));
    r.setSize(rect.width, rect.height, false);
  }, [w, h, readyToken]);

  /* renderer output to avoid tone surprises */
  useEffect(() => {
    const r = rendererOf(globeRef);
    if (!r) return;
    (r as any).outputColorSpace = SRGBColorSpace;
    r.toneMapping = NoToneMapping;
    r.toneMappingExposure = 1;
  }, [readyToken]);

  /* lights */
  useEffect(() => {
    const scene = sceneOf(globeRef);
    if (!scene) return;

    scene.children.filter((o: any) => o.isLight).forEach((l) => scene.remove(l));
    scene.getObjectByName('SunTarget')?.parent?.remove(scene.getObjectByName('SunTarget')!);

    const amb = new AmbientLight(0xffffff, 0.04);
    amb.name = 'AmbientLight';

    const sun = new DirectionalLight(0xffffff, 1.0);
    sun.name = 'SunLight';
    sun.position.copy(VIEW_LIGHT_DIR).multiplyScalar(1000);
    sun.target.position.set(0, 0, 0);
    sun.target.name = 'SunTarget';

    scene.add(sun, sun.target, amb);

    return () => {
      scene.remove(amb);
      scene.remove(sun);
      scene.remove(sun.target);
    };
  }, [readyToken]);

  /* overlays */
  useEffect(() => {
    const scene = sceneOf(globeRef);
    if (!scene) return;

    // ensure lights exist even if the lights effect hasn't run yet
    let sun = scene.getObjectByName('SunLight') as DirectionalLight | null;
    let amb = scene.getObjectByName('AmbientLight') as AmbientLight | null;
    if (!sun) {
      sun = new DirectionalLight(0xffffff, 1.0);
      sun.name = 'SunLight';
      sun.position.copy(VIEW_LIGHT_DIR).multiplyScalar(1000);
      sun.target.position.set(0, 0, 0);
      sun.target.name = 'SunTarget';
      scene.add(sun, sun.target);
    }
    if (!amb) {
      amb = new AmbientLight(0xffffff, 0.04);
      amb.name = 'AmbientLight';
      scene.add(amb);
    }

    // hard reset overlays that might survive HMR
    ['TerminatorOverlay', 'DayAtmosphere', 'BordersOverlay'].forEach((n) => {
      const o = scene.getObjectByName(n);
      if (o) {
        scene.remove(o);
        o.traverse((c: any) => {
          c.geometry?.dispose?.();
          c.material?.dispose?.();
        });
      }
    });

    const radius = globeRadius(scene, 100);

    // night
    const nightGeo = new SphereGeometry(radius * 1.003, 128, 128);
    const nightMat = makeTerminatorMaterial(0.92, 0.22);
    const nightMesh = new Mesh(nightGeo, nightMat);
    nightMesh.name = 'TerminatorOverlay';
    nightMesh.renderOrder = 5;
    scene.add(nightMesh);

    // day rim
    const atmGeo = new SphereGeometry(radius * 1.006, 128, 128);
    const atmMat = makeDayAtmosphereMaterial(new Color('lightskyblue'), 1.2, 0.25, 3.0);
    const atmMesh = new Mesh(atmGeo, atmMat);
    atmMesh.name = 'DayAtmosphere';
    atmMesh.renderOrder = 9;
    scene.add(atmMesh);

    // borders overlay
    const BW = 16384,
      BH = 8192;
    const borderCanvas = document.createElement('canvas');
    borderCanvas.width = BW;
    borderCanvas.height = BH;
    const bctx = borderCanvas.getContext('2d', { alpha: true });
    if (bctx) {
      drawBorders(
        bctx,
        BW,
        BH,
        { countryPaths, statePaths, provincePaths },
        { color: '#ffffff', alpha: 0.95, halo: 1.0, lineWidthScale: 1.4 }
      );
    }

    const r = rendererOf(globeRef);
    const bordersTex = new CanvasTexture(borderCanvas);

    const baseMap = globeMat?.map as any;
    if (baseMap) {
      bordersTex.flipY = !!baseMap.flipY;
      bordersTex.wrapS = baseMap.wrapS;
      bordersTex.wrapT = baseMap.wrapT;
      bordersTex.repeat.copy(baseMap.repeat);
      bordersTex.offset.copy(baseMap.offset);
    } else {
      bordersTex.flipY = false;
      bordersTex.wrapT = RepeatWrapping;
      bordersTex.repeat.set(1, -1);
      bordersTex.offset.set(0, 1);
    }
    bordersTex.wrapS = RepeatWrapping;
    bordersTex.offset.x = (bordersTex.offset.x + 0.25) % 1;

    (bordersTex as any).colorSpace = SRGBColorSpace;
    bordersTex.generateMipmaps = true;
    bordersTex.minFilter = LinearMipmapLinearFilter;
    bordersTex.magFilter = LinearFilter;
    bordersTex.anisotropy = Math.min(16, r?.capabilities.getMaxAnisotropy() ?? 1);
    bordersTex.needsUpdate = true;

    const bordersMat = new MeshBasicMaterial({ map: bordersTex, transparent: true });
    bordersMat.depthWrite = false;
    bordersMat.depthTest = false;

    const bordersGeo = new SphereGeometry(radius * 1.0015, 128, 128);
    const bordersMesh = new Mesh(bordersGeo, bordersMat);
    bordersMesh.name = 'BordersOverlay';
    bordersMesh.renderOrder = 8;
    scene.add(bordersMesh);

    return () => {
      scene.remove(nightMesh);
      scene.remove(atmMesh);
      scene.remove(bordersMesh);
      nightGeo.dispose();
      nightMat.dispose();
      atmGeo.dispose();
      atmMat.dispose();
      bordersGeo.dispose();
      bordersTex.dispose();
      bordersMat.dispose();
    };
  }, [readyToken, countryPaths, statePaths, provincePaths, globeMat]);

  /* keep terminator bound to the actual sun in view space */
  useEffect(() => {
    const g = globeRef.current as any;
    const scene = sceneOf(globeRef);
    if (!g || !scene) return;

    const night = scene.getObjectByName('TerminatorOverlay') as Mesh | null;
    const sun = scene.getObjectByName('SunLight') as DirectionalLight | null;
    const cam = g.camera?.();
    if (!night || !sun || !cam) return;

    const dir = new Vector3();
    const toView = new Matrix3();
    let raf = 0;

    const tick = () => {
      toView.setFromMatrix4(cam.matrixWorldInverse);
      dir.copy(sun.position).sub(sun.target.position).normalize();
      dir.applyMatrix3(toView).normalize();
      const uni = (night.material as any).uniforms?.uLightDirVS;
      if (uni?.value) uni.value.copy(dir);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [readyToken]);

  /* setup and controls */
  const setupOpts = useMemo(
    () => ({ pixelRatioMax: 2, startPOV: { lat: 38, lng: -95, altitude: 1.6 } }),
    []
  );
  useGlobeSetup(globeRef, readyToken, setupOpts);

  const zoomOpts = useMemo(() => ({ min: 0.1, max: 3, base: 1.9, startAlt: 1.6 }), []);
  useGlobeZoom(globeRef, readyToken, zoomOpts);
  useCursorLL(globeRef, readyToken, onCursorLL);
  useGlobeControls(globeRef, readyToken, { damping: 0.09, rotateSpeed: 0.55 });

  useGlobeReady(globeRef, readyToken, {
    onProgress: setGpuMax,
    onBeforeReady: () => setCap(1),
    onReady
  });

  /* close progress when KTX2 mat is ready */
  useEffect(() => {
    if (!globeMat) return;
    setNet(1);
    setComposeMax(1);
    setDecodeMax(1);
    setGpuMax(1);
    setCap(1);
  }, [globeMat, setNet, setComposeMax, setDecodeMax, setGpuMax, setCap]);

  if (!globeMat && !imgUrl) return null;

  return (
    <RGGlobe
      key="ktx-boot"
      ref={globeRef}
      width={w}
      height={h}
      globeMaterial={globeMat ?? undefined}
      globeImageUrl={globeMat ? undefined : imgUrl}
      backgroundColor="#000"
      showAtmosphere={false}
      rendererConfig={{ antialias: true, alpha: false, powerPreference: 'high-performance' }}
    />
  );
}
