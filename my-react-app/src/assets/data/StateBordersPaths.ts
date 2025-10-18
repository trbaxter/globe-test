import data from '@/assets/data/coordinates/us_state_borders.json';
import { recordsToPaths, type Geometry, type PathRec } from '@/utils/geo/pathBuilder';

type Rec = { name: string; abbreviation: string; geometry: Geometry };
type Root = { states: Rec[] };

export function getUSStatePaths(): PathRec[] {
  const { states } = data as unknown as Root;
  return recordsToPaths(states, (r) => r.abbreviation);
}
