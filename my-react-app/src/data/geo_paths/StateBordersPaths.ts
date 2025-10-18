import data from '@/assets/coordinates/us_state_borders.json';
import { recordsToPaths, type Geometry, type PathRec } from '@/utils';

type Rec = { name: string; abbreviation: string; geometry: Geometry };
type Root = { states: Rec[] };

export function getUSStatePaths(): PathRec[] {
  const { states } = data as unknown as Root;
  return recordsToPaths(states, (r) => r.abbreviation);
}
