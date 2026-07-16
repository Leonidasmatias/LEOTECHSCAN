// STAGE 1 -- WP1.9 Radius API.
//
// Returns the sites within a caller-supplied radius (km) of a center point,
// sorted by distance, as compact payloads. Thin HTTP adapter only:
//   - request parsing/validation: services/geospatial/request-params.ts
//   - bbox-prefiltered candidate fetch + exact-distance filtering:
//     getSitesWithinRadius() in
//     services/geospatial/spatial-intelligence-engine.ts (itself built on
//     the pure radiusToBoundingBox/withDistances/filterWithinRadius in
//     services/geospatial/spatial-query-utils.ts)
//   - compact response shaping: services/geospatial/compact-site.ts
// See tests/geospatial-api-contract.test.ts (source inspection) and
// docs/stage-1/08_TEST_RESULTS.md for why this route cannot be imported
// directly by a Vitest test file.
import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getSitesWithinRadius } from "@/services/geospatial/spatial-intelligence-engine";
import { parseLatLon, parseRadiusKm, parseOptionalPositiveInt } from "@/services/geospatial/request-params";
import { toCompactSiteWithDistance } from "@/services/geospatial/compact-site";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DEFAULT_RADIUS_KM = 10;
// Hard ceiling on the radius itself (independent of the result-count limit
// already enforced inside getSitesWithinRadius) -- without this, a caller
// could request a 5,000km radius and force the engine to scan a bounding
// box covering most of the country before the result-count limit ever
// kicks in.
const MAX_RADIUS_KM = 300;

export async function GET(request: NextRequest) {
  try {
    const params = request.nextUrl.searchParams;
    const centerResult = parseLatLon(params);
    if (!centerResult.ok) return NextResponse.json({ error: "Parametro invalido.", reasons: centerResult.errors }, { status: 400 });

    const radiusResult = parseRadiusKm(params, { fallback: DEFAULT_RADIUS_KM, max: MAX_RADIUS_KM });
    if (!radiusResult.ok) return NextResponse.json({ error: "Parametro invalido.", reasons: radiusResult.errors }, { status: 400 });

    const limitResult = parseOptionalPositiveInt(params, "limit");
    if (!limitResult.ok) return NextResponse.json({ error: "Parametro invalido.", reasons: limitResult.errors }, { status: 400 });

    const result = getSitesWithinRadius(getDb(), centerResult.value, radiusResult.value, { limit: limitResult.value });
    return NextResponse.json({
      items: (result.items as Array<Record<string, unknown>>).map(toCompactSiteWithDistance),
      count: result.count,
      radiusKm: result.radiusKm,
      truncated: result.truncated,
    });
  } catch (error) {
    console.error("geospatial_radius_failed", error instanceof Error ? error.message : "unknown");
    return NextResponse.json({ error: "Busca por raio indisponivel." }, { status: 500 });
  }
}
