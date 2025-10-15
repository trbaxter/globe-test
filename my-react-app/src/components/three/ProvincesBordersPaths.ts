import data from '@/assets/data/coordinates/canada_provinces_borders.json';

type LonLat = [number, number];
type Ring = LonLat[];
type Polygon = Ring[];
type MultiPolygon = Ring[][];
type Geometry =
  | { type: 'Polygon'; coordinates: Polygon }
  | { type: 'MultiPolygon'; coordinates: MultiPolygon };

type Rec = { name: string; abbreviation: string; geometry: Geometry };
type Root = { provinces?: Rec[]; states?: Rec[] }; // handle either root key

export type PathPoint = { lat: number; lng: number };
export type ProvincePath = { id: string; name: string; abbr: string; points: PathPoint[] };

function toPoints(ring: Ring): PathPoint[] {
  const pts = ring.map(([lon, lat]) => ({ lat, lng: lon }));
  const a = pts[0],
    b = pts[pts.length - 1];
  if (!b || a.lat !== b.lat || a.lng !== b.lng) pts.push({ ...a }); // ensure closed ring
  return pts;
}

export function getCanadaProvincePaths(): ProvincePath[] {
  const root = data as unknown as Root;
  const records: Rec[] = root.provinces ?? root.states ?? [];
  const out: ProvincePath[] = [];

  for (const s of records) {
    if (s.geometry.type === 'Polygon') {
      s.geometry.coordinates.forEach((ring, i) =>
        out.push({
          id: `${s.abbreviation}-p0-r${i}`,
          name: s.name,
          abbr: s.abbreviation,
          points: toPoints(ring)
        })
      );
    } else {
      s.geometry.coordinates.forEach((poly, p) =>
        poly.forEach((ring, r) =>
          out.push({
            id: `${s.abbreviation}-p${p}-r${r}`,
            name: s.name,
            abbr: s.abbreviation,
            points: toPoints(ring)
          })
        )
      );
    }
  }
  return out;
}
