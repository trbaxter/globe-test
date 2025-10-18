import data from '@/assets/data/coordinates/canada_provinces_borders.json';
import { recordsToPaths, type Geometry, type PathRec } from '@/utils/geo/pathBuilder';

type Rec = { name: string; abbreviation: string; geometry: Geometry };
type Root = { provinces?: Rec[]; states?: Rec[] };

export function getCanadaProvincePaths(): PathRec[] {
  const root = data as unknown as Root;
  const recs = root.provinces ?? root.states ?? [];
  return recordsToPaths(recs, (r) => r.abbreviation);
}
