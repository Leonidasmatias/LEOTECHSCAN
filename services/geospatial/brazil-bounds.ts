// STAGE 1 -- WP1.3 Brazil Geographic Bounds.
//
// This is a plain bounding-box check, NOT a real municipality/UF polygon
// lookup. LeoTechScan has no municipality or state boundary geometries
// anywhere in the codebase (confirmed during the Stage 1 pre-implementation
// inspection) -- adding a claim of polygon-accurate validation here would be
// exactly the kind of false precision the Stage 1 safety rules prohibit
// ("do not claim exact site-location accuracy without evidence"). A site can
// pass this check and still be in the wrong municipality, or even the wrong
// country if it happens to fall inside Brazil's bounding rectangle without
// being in Brazil (the rectangle also covers parts of Bolivia, Paraguay,
// Peru, etc., near the borders) -- that limitation is intentional and must
// stay documented, not quietly forgotten.
//
// The bounds below are deliberately the SAME ones already used by
// services/data-quality-engine.ts's "coordenadas-invalidas" check (added in
// Stage 0). Reusing the exact numbers means a site cannot be "outside Brazil"
// in one part of the app and "fine" in another -- a single source of truth
// for this specific rectangle, even though this module and
// data-quality-engine.ts remain otherwise independent.

export const BRAZIL_BOUNDS = {
  minLatitude: -34,
  maxLatitude: 6,
  minLongitude: -75,
  maxLongitude: -32,
} as const;

// How close to an edge of the bounding box (in decimal degrees) counts as
// "near the border" rather than a confident inside/outside call. ~0.5
// degrees is roughly 55km at the equator -- wide enough to flag genuine
// border-adjacent sites for human review without flagging most of the
// country's interior.
export const NEAR_BORDER_TOLERANCE_DEGREES = 0.5;

export type BrazilBoundsClassification = "inside" | "near_border" | "outside" | "cannot_validate";

function isFiniteCoordinate(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

export function classifyBrazilBounds(
  latitude: number | null | undefined,
  longitude: number | null | undefined,
): BrazilBoundsClassification {
  if (!isFiniteCoordinate(latitude) || !isFiniteCoordinate(longitude)) return "cannot_validate";

  const { minLatitude, maxLatitude, minLongitude, maxLongitude } = BRAZIL_BOUNDS;
  const insideStrict =
    latitude >= minLatitude && latitude <= maxLatitude && longitude >= minLongitude && longitude <= maxLongitude;

  const distanceInsideEdge = Math.min(latitude - minLatitude, maxLatitude - latitude, longitude - minLongitude, maxLongitude - longitude);

  if (insideStrict) {
    return distanceInsideEdge < NEAR_BORDER_TOLERANCE_DEGREES ? "near_border" : "inside";
  }

  const outsideButNear =
    latitude >= minLatitude - NEAR_BORDER_TOLERANCE_DEGREES &&
    latitude <= maxLatitude + NEAR_BORDER_TOLERANCE_DEGREES &&
    longitude >= minLongitude - NEAR_BORDER_TOLERANCE_DEGREES &&
    longitude <= maxLongitude + NEAR_BORDER_TOLERANCE_DEGREES;

  return outsideButNear ? "near_border" : "outside";
}

// Reversed-coordinate heuristic: a common data-entry mistake is swapping
// latitude and longitude. If the raw pair fails the bounds check but the
// SWAPPED pair would pass (or land near-border), that is a strong, specific
// signal worth surfacing -- but only as a suggestion. Nothing in Stage 1
// auto-corrects a coordinate; the pair is left exactly as imported and this
// only contributes a "suspicious" reason for a human to review.
export function suspectedLatLonSwap(latitude: number | null | undefined, longitude: number | null | undefined): boolean {
  if (!isFiniteCoordinate(latitude) || !isFiniteCoordinate(longitude)) return false;
  const rawClass = classifyBrazilBounds(latitude, longitude);
  if (rawClass === "inside" || rawClass === "near_border") return false;
  const swappedClass = classifyBrazilBounds(longitude, latitude);
  return swappedClass === "inside" || swappedClass === "near_border";
}
