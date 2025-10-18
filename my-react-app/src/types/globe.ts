export type PathPoint = { lat: number; lng: number };
export type PathRec = { points: PathPoint[] };
export type PhaseKey = 'pNet' | 'pCompose' | 'pDecode' | 'pGpu';
export type GlobeProps = {
  onReady?: () => void;
  onProgress?: (loaded: number, total: number) => void;
  onCursorLL?: (ll: { lat: number; lng: number } | null) => void;
};
