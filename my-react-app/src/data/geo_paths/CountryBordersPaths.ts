import data from '@/assets/coordinates/world_country_borders.json';
import { recordsToPaths, type Geometry, type PathRec } from '@/utils';

type Rec = { name: string; abbreviation?: string; code?: string; geometry: Geometry };
type Root = { countries?: Rec[]; states?: Rec[]; provinces?: Rec[] };

export function getWorldCountryPaths(): PathRec[] {
  const root = data as unknown as Root;
  const recs = root.countries ?? root.states ?? root.provinces ?? [];
  return recordsToPaths(recs);
}
