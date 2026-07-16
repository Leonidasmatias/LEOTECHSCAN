// STAGE 1 -- WP1.7-1.9 Geospatial APIs: pure, dependency-free compact site
// payload shaping.
//
// services/site-service.ts's siteRow() (Stage 0) maps a raw `sites` row into
// a ~24-field object -- exactly right for a single-site detail view, but far
// too heavy to repeat 2,000-5,000 times in a single viewport/cluster/radius
// response (Checkpoint 3 requirement 5: "return compact payloads only").
// toCompactSite() trims a raw db row down to the handful of fields a map
// marker or a list of nearby sites actually needs. It is not a
// re-implementation of siteRow() -- it reads the same underlying raw column
// names (see api/site-query.ts's SITE_SELECT_COLUMNS) and does no
// classification/scoring logic of its own, so there is nothing here that
// could drift out of sync with siteRow()'s field mapping in a way that
// matters (both ultimately just read `raw.column_name`).
//
// Zero imports of node:sqlite (directly or transitively) -- takes a plain
// `Record<string, unknown>` row, the same shape `db.prepare(...).all()`
// returns, so this is directly unit-testable with plain object literals.
// See tests/geospatial-compact-site.test.ts.

export type CompactSite = {
  id: number;
  site: string;
  municipio: string;
  uf: string;
  operadora: string;
  tecnologia: string;
  status: string;
  latitude: number;
  longitude: number;
  geoScore: number;
};

const COMPACT_SITE_KEYS: readonly (keyof CompactSite)[] = [
  "id",
  "site",
  "municipio",
  "uf",
  "operadora",
  "tecnologia",
  "status",
  "latitude",
  "longitude",
  "geoScore",
];

// Exported so the API-contract test can assert, by name, exactly which
// fields a compact payload is allowed to carry -- without having to
// duplicate this list a second time inside the test file.
export { COMPACT_SITE_KEYS };

function str(value: unknown): string {
  return value === null || value === undefined ? "" : String(value);
}

function num(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

/** Trims a raw `sites` row (or a distanceKm-annotated variant of one) down to the compact map/list payload shape. */
export function toCompactSite(raw: Record<string, unknown>): CompactSite {
  return {
    id: num(raw.id),
    site: str(raw.site ?? raw.site_id),
    municipio: str(raw.municipio),
    uf: str(raw.uf ?? raw.estado),
    operadora: str(raw.operadora_classificada ?? raw.operadora_origem),
    tecnologia: str(raw.tecnologia),
    status: str(raw.status_normalizado ?? raw.status),
    latitude: num(raw.latitude),
    longitude: num(raw.longitude),
    geoScore: num(raw.geo_score),
  };
}

/** Same as toCompactSite(), but preserves a distanceKm field already attached by the radius/nearest engine functions. */
export function toCompactSiteWithDistance(raw: Record<string, unknown> & { distanceKm?: number }): CompactSite & { distanceKm: number } {
  return { ...toCompactSite(raw), distanceKm: num(raw.distanceKm) };
}
