import type { PathPoint, PathRec } from '@/types/globe';

type Sets = Readonly<{
  countryPaths: ReadonlyArray<PathRec>;
  statePaths: ReadonlyArray<PathRec>;
  provincePaths: ReadonlyArray<PathRec>;
}>;

export type BorderStyle = Readonly<{
  color?: string;
  alpha?: number;
  lineWidthScale?: number;
  tolerancePx?: number;
  dash?: number[];
  halo?: number;
  signal?: AbortSignal;
}>;

export function drawBorders(
  ctx: CanvasRenderingContext2D,
  W: number,
  H: number,
  sets: Sets,
  style: BorderStyle = {}
): void {
  if (!ctx || W <= 0 || H <= 0) return;

  const tolPx = style.tolerancePx ?? 0.5;
  const tolLng = (360 / Math.max(1, W)) * tolPx;
  const tolLat = (180 / Math.max(1, H)) * tolPx;
  const SLNG = 1 / tolLng;
  const SLAT = 1 / tolLat;

  const isFiniteLL = (p: PathPoint) => Number.isFinite(p.lat) && Number.isFinite(p.lng);

  const toXY = (lat: number, lng: number) => {
    const clat = Math.max(-90, Math.min(90, lat));
    return [((lng + 180) / 360) * W, ((90 - clat) / 180) * H] as const;
  };

  const keyPt = (p: PathPoint) => `${Math.round(p.lng * SLNG)},${Math.round(p.lat * SLAT)}`;
  const segKey = (a: PathPoint, b: PathPoint) => {
    const ka = keyPt(a),
      kb = keyPt(b);
    return ka < kb ? `${ka}|${kb}` : `${kb}|${ka}`;
  };

  const unwrap = (bLng: number, aLng: number) => {
    let x = bLng;
    while (x - aLng > 180) x -= 360;
    while (aLng - x > 180) x += 360;
    return x;
  };

  const nearSeam = (lng: number) => Math.abs(Math.abs(lng) - 180) <= tolLng * 1.5;

  function segmentize(a: PathPoint, b: PathPoint): Array<[PathPoint, PathPoint]> {
    if (!isFiniteLL(a) || !isFiniteLL(b)) return [];
    const l1 = a.lng;
    const l2u = unwrap(b.lng, l1);
    const d = l2u - l1;
    if (Math.abs(d) <= 180 - tolLng) {
      return [[a, { lat: b.lat, lng: l2u }]];
    }
    const boundary = d > 0 ? 180 : -180;
    const t = (boundary - l1) / d;
    const lat = a.lat + t * (b.lat - a.lat);
    const mid1: PathPoint = { lat, lng: boundary };
    const mid2: PathPoint = { lat, lng: -boundary };
    return [
      [a, mid1],
      [mid2, { lat: b.lat, lng: l2u }]
    ];
  }

  const seen = new Set<string>();
  const path = new Path2D();

  const samePx = (p: PathPoint, q: PathPoint) => {
    const [x1, y1] = toXY(p.lat, p.lng);
    const [x2, y2] = toXY(q.lat, q.lng);
    return Math.abs(x1 - x2) < 0.1 && Math.abs(y1 - y2) < 0.1;
  };

  const drawRecord = (rec: PathRec) => {
    const pts = rec?.points as ReadonlyArray<PathPoint> | undefined;
    if (!pts || pts.length < 2) return;

    let penAt: PathPoint | null = null;

    for (let i = 1; i < pts.length; i++) {
      if (style.signal?.aborted) return;

      const a = pts[i - 1],
        b = pts[i];
      const pieces = segmentize(a, b);

      for (const [u, v] of pieces) {
        if (nearSeam(u.lng) && nearSeam(v.lng) && Math.sign(u.lng) === Math.sign(v.lng)) {
          continue;
        }

        const key = segKey(u, v);
        if (seen.has(key)) continue;
        seen.add(key);

        const [x1, y1] = toXY(u.lat, u.lng);
        const [x2, y2] = toXY(v.lat, v.lng);
        if (!Number.isFinite(x1 + y1 + x2 + y2)) continue;

        if (!penAt || !samePx(penAt, u)) path.moveTo(x1, y1);
        path.lineTo(x2, y2);
        penAt = v;
      }
    }
  };

  for (const rec of sets.countryPaths) drawRecord(rec);
  for (const rec of sets.statePaths) drawRecord(rec);
  for (const rec of sets.provincePaths) drawRecord(rec);

  const lineWidth = Math.max(1, Math.round((W / 8192) * (style.lineWidthScale ?? 1.4)));

  ctx.save();
  if ((style.halo ?? 0) > 0) {
    ctx.strokeStyle = 'rgba(0,0,0,0.65)';
    ctx.lineWidth = lineWidth + 2 * (style.halo as number);
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.stroke(path);
  }
  ctx.strokeStyle = style.color ?? '#fff';
  ctx.globalAlpha = style.alpha ?? 0.92;
  ctx.lineWidth = lineWidth;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  if (style.dash) ctx.setLineDash(style.dash);
  ctx.stroke(path);
  if (style.dash) ctx.setLineDash([]);
  ctx.restore();
}
