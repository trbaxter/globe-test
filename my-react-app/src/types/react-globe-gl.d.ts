import type { WebGLRenderer, Material } from 'three';
import type { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';

declare module 'react-globe.gl' {
  interface GlobeMethods {
    globeMaterial?: () => Material;
    renderer?: () => WebGLRenderer;
    controls?: () => OrbitControls;
    getGlobeRadius?: () => number;
  }
}
