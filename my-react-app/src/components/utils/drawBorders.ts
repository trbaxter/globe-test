import type { PathPoint, PathRec } from '@/types/globe.ts';

export function drawBorders(
  ctx: CanvasRenderingContext2D,
  W: number,
  H: number,
  sets: { countryPaths: PathRec[]; statePaths: PathRec[]; provincePaths: PathRec[] }
): void {
  const { countryPaths, statePaths, provincePaths } = sets;

  const LW = Math.max(1, Math.round((W / 8192) * 1.4));
  const TOL = 1e-4;
  const SCALE = 1 / TOL;

  const toKey = (p: PathPoint) => {
    const ax = Math.round(p.lng * SCALE);
    const ay = Math.round(p.lat * SCALE);
    return `${ax},${ay}`;
  };
  const fromKey = (k: string): PathPoint => {
    const [x, y] = k.split(',').map(Number);
    return { lng: x / SCALE, lat: y / SCALE };
  };
  const toXY = (lat: number, lng: number) =>
    [((lng + 180) / 360) * W, ((90 - lat) / 180) * H] as const;

  const G = new Map<string, Set<string>>();
  const addEdge = (a: PathPoint, b: PathPoint) => {
    const dLng = ((b.lng - a.lng + 540) % 360) - 180;
    if (Math.abs(dLng) > 170) return;
    const ka = toKey(a);
    const kb = toKey(b);
    if (ka === kb) return;
    if (!G.has(ka)) G.set(ka, new Set());
    if (!G.has(kb)) G.set(kb, new Set());
    G.get(ka)!.add(kb);
    G.get(kb)!.add(ka);
  };

  const addSet = (recs: PathRec[]) => {
    for (const rec of recs) {
      const pts = rec?.points;
      if (!pts || pts.length < 2) continue;
      for (let i = 1; i < pts.length; i++) addEdge(pts[i - 1], pts[i]);
    }
  };
  addSet(countryPaths);
  addSet(statePaths);
  addSet(provincePaths);

  const edgeVisited = new Set<string>();
  const edgeKey = (u: string, v: string) => (u < v ? `${u}|${v}` : `${v}|${u}`);

  const walk = (start: string): string[] => {
    const chain: string[] = [start];
    let cur = start;
    let prev: string | null = null;

    while (true) {
      const nbrs = [...(G.get(cur) ?? [])].filter((n) => !edgeVisited.has(edgeKey(cur, n)));
      if (nbrs.length === 0) break;
      const next = prev && nbrs.length > 1 ? nbrs.find((n) => n !== prev)! : nbrs[0];
      edgeVisited.add(edgeKey(cur, next));
      chain.push(next);
      prev = cur;
      cur = next;
    }
    return chain;
  };

  const starts = [...[...G.keys()].filter((k) => (G.get(k)?.size ?? 0) !== 2), ...G.keys()];

  ctx.save();
  ctx.strokeStyle = '#fff';
  ctx.globalAlpha = 0.92;
  ctx.lineWidth = LW;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.beginPath();

  const usedNode = new Set<string>();
  for (const s of starts) {
    const pending = [...(G.get(s) ?? [])].some((n) => !edgeVisited.has(edgeKey(s, n)));
    if (!pending) continue;

    const chain = walk(s);
    if (chain.length < 2) continue;

    const p0 = fromKey(chain[0]);
    let [x0, y0] = toXY(p0.lat, p0.lng);
    ctx.moveTo(x0, y0);
    for (let i = 1; i < chain.length; i++) {
      const pi = fromKey(chain[i]);
      const [x, y] = toXY(pi.lat, pi.lng);
      ctx.lineTo(x, y);
    }
    chain.forEach((k) => usedNode.add(k));
  }

  ctx.stroke();
  ctx.restore();
}
