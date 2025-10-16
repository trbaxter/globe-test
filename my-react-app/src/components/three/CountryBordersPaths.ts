import data from '@/assets/data/coordinates/world_country_borders.json';

type LonLat = [number, number];
type Ring = LonLat[];
type Polygon = Ring[];
type MultiPolygon = Ring[][];
type Geometry =
  | { type: 'Polygon'; coordinates: Polygon }
  | { type: 'MultiPolygon'; coordinates: MultiPolygon };

type Rec = { name: string; abbreviation?: string; code?: string; geometry: Geometry };
type Root = { countries?: Rec[]; states?: Rec[]; provinces?: Rec[] };

export type PathPoint = { lat: number; lng: number };
export type CountryPath = { id: string; name: string; abbr: string; points: PathPoint[] };

function toPoints(ring: Ring): PathPoint[] {
  const pts = ring.map(([lon, lat]) => ({ lat, lng: lon }));
  const a = pts[0],
    b = pts[pts.length - 1];
  if (!b || a.lat !== b.lat || a.lng !== b.lng) pts.push({ ...a }); // close ring
  return pts;
}

export function getWorldCountryPaths(): CountryPath[] {
  const root = data as unknown as Root;
  const records: Rec[] = root.countries ?? root.states ?? root.provinces ?? [];
  const out: CountryPath[] = [];

  for (const s of records) {
    const abbr = s.abbreviation ?? s.code ?? s.name.slice(0, 3).toUpperCase();
    if (s.geometry.type === 'Polygon') {
      s.geometry.coordinates.forEach((ring, i) =>
        out.push({ id: `${abbr}-p0-r${i}`, name: s.name, abbr, points: toPoints(ring) })
      );
    } else {
      s.geometry.coordinates.forEach((poly, p) =>
        poly.forEach((ring, r) =>
          out.push({ id: `${abbr}-p${p}-r${r}`, name: s.name, abbr, points: toPoints(ring) })
        )
      );
    }
  }
  return out;
}
