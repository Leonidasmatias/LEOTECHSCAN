// STAGE 1 -- WP1.9 Nearest-Sites API.
//
// Returns the N nearest sites to a caller-supplied center point, using an
// expanding-radius search capped at maxRadiusKm (never an unbounded/full
// national scan). Thin HTTP adapter only:
//   - request parsing/validation: services/geospatial/request-params.ts
//   - expanding-radius nearest search: getNearestSites() in
//     services/geospatial/spatial-intelligence-engine.ts
//   - compact response shaping: services/geospatial/compact-site.ts
// See tests/geospatial-api-contract.test.ts (source inspection) and
// docs/stage-1/08_TEST_RESULTS.md for why this route cannot be imported
// directly by a Vitest test file.
//
// excludeSiteId is optional and typically used when a caller already has a
// site open (e.g. a future site-detail page) and wants "other sites near
// this one" without the site itself appearing in its own nearest-neighbor
// list.
import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getNearestSites } from "@/services/geospatial/spatial-intelligence-engine";
import { parseLatLon, parseOptionalPositiveInt } from "@/services/geospatial/request-params";
import { toCompactSiteWithDistance } from "@/services/geospatial/compact-site";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DEFAULT_MAX_RADIUS_KM = 200;
const MAX_MAX_RADIUS_KM = 500;

export async function GET(request: NextRequest) {
  try {
    const params = request.nextUrl.searchParams;
    const centerResult = parseLatLon(params);
    if (!centerResult.ok) return NextResponse.json({ error: "Parametro invalido.", reasons: centerResult.errors }, { status: 400 });

    const excludeResult = parseOptionalPositiveInt(params, "excludeSiteId");
    if (!excludeResult.ok) return NextResponse.json({ error: "Parametro invalido.", reasons: excludeResult.errors }, { status: 400 });

    const maxRadiusResult = parseOptionalPositiveInt(params, "maxRadiusKm");
    if (!maxRadiusResult.ok) return NextResponse.json({ error: "Parametro invalido.", reasons: maxRadiusResult.errors }, { status: 400 });
    const maxRadiusKm = Math.min(maxRadiusResult.value ?? DEFAULT_MAX_RADIUS_KM, MAX_MAX_RADIUS_KM);

    const limitResult = parseOptionalPositiveInt(params, "limit");
    if (!limitResult.ok) return NextResponse.json({ error: "Parametro invalido.", reasons: limitResult.errors }, { status: 400 });

    const result = getNearestSites(getDb(), centerResult.value, {
      limit: limitResult.value,
      excludeSiteId: excludeResult.value,
      maxRadiusKm,
    });
    return NextResponse.json({
      items: (result.items as Array<Record<string, unknown>>).map(toCompactSiteWithDistance),
      count: result.count,
      searchedRadiusKm: result.searchedRadiusKm,
    });
  } catch (error) {
    console.error("geospatial_nearest_failed", error instanceof Error ? error.message : "unknown");
    return NextResponse.json({ error: "Busca por sites proximos indisponivel." }, { status: 500 });
  }
}
