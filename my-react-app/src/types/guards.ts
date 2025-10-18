import type { PathRec, PathPoint } from '@/types/globe';

const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const isPoint = (p: any): p is PathPoint => p && isNum(p.lat) && isNum(p.lng);
const isPathRec = (r: any): r is PathRec => r && Array.isArray(r.points) && r.points.every(isPoint);

export const isPathRecArray = (a: any): a is PathRec[] => Array.isArray(a) && a.every(isPathRec);

export function ensurePathRecs(v: any, label?: string): PathRec[] {
  if (isPathRecArray(v)) return v;
  if (typeof console !== 'undefined')
    console.warn(`[ensurePathRecs] Invalid ${label ?? 'paths'} payload`, v);
  return [];
}
