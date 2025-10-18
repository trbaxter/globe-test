export type LonLat = [number, number];
export type Ring = LonLat[];
export type Polygon = Ring[];
export type MultiPolygon = Ring[][];
export type Geometry =
  | { type: 'Polygon'; coordinates: Polygon }
  | { type: 'MultiPolygon'; coordinates: MultiPolygon };

export type PathPoint = { lat: number; lng: number };
export type PathRec = { id: string; name: string; abbr: string; points: PathPoint[] };

const toPoints = (ring: Ring): PathPoint[] => {
  const pts = ring.map(([lon, lat]) => ({ lat, lng: lon }));
  const a = pts[0],
    b = pts[pts.length - 1];
  if (a && (!b || a.lat !== b.lat || a.lng !== b.lng)) pts.push({ ...a });
  return pts;
};

export function explodeRecord<
  T extends {
    name: string;
    abbreviation?: string;
    code?: string;
    geometry: Geometry;
  }
>(rec: T, abbrOverride?: string): PathRec[] {
  const abbr = abbrOverride ?? rec.abbreviation ?? rec.code ?? rec.name.slice(0, 3).toUpperCase();
  const out: PathRec[] = [];

  if (rec.geometry.type === 'Polygon') {
    rec.geometry.coordinates.forEach((ring, i) =>
      out.push({ id: `${abbr}-p0-r${i}`, name: rec.name, abbr, points: toPoints(ring) })
    );
  } else {
    rec.geometry.coordinates.forEach((poly, p) =>
      poly.forEach((ring, r) =>
        out.push({ id: `${abbr}-p${p}-r${r}`, name: rec.name, abbr, points: toPoints(ring) })
      )
    );
  }
  return out;
}

export function recordsToPaths<
  T extends {
    name: string;
    abbreviation?: string;
    code?: string;
    geometry: Geometry;
  }
>(records: T[], getAbbr?: (r: T) => string): PathRec[] {
  const out: PathRec[] = [];
  for (const rec of records) out.push(...explodeRecord(rec, getAbbr?.(rec)));
  return out;
}
