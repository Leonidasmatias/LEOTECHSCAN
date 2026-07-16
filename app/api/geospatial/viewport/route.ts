// STAGE 1 -- WP1.7 Viewport API.
//
// Returns the sites inside a caller-supplied bounding box (a map viewport),
// as compact payloads, prefiltered through the WP1.4 spatial index
// (R-Tree, or the composite-index fallback) rather than a full table scan.
//
// This route is a thin HTTP adapter only -- every piece of actual logic is
// reused, not reimplemented, from Checkpoint 2:
//   - request parsing/validation: services/geospatial/request-params.ts
//   - bounding-box query + spatial-index prefiltering: getSitesInBoundingBox()
//     in services/geospatial/spatial-intelligence-engine.ts
//   - compact response shaping: services/geospatial/compact-site.ts
// tests/geospatial-api-contract.test.ts confirms this wiring by source
// inspection (it cannot import this file directly -- see
// docs/stage-1/08_TEST_RESULTS.md for why any test file whose import graph
// reaches node:sqlite cannot be reliably collected by this project's
// Vitest pipeline; this route imports node:sqlite transitively via
// @/lib/db).
//
// Known limitation (inherited from validateBoundingBox in
// spatial-query-utils.ts): bounding boxes crossing the antimeridian
// (west > east) are rejected as invalid rather than handled -- not a
// concern for Brazil, where every viewport this application renders stays
// within a single, non-wrapping longitude range.
import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getSitesInBoundingBox } from "@/services/geospatial/spatial-intelligence-engine";
import { parseBoundingBox, parseOptionalPositiveInt } from "@/services/geospatial/request-params";
import { toCompactSite } from "@/services/geospatial/compact-site";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const params = request.nextUrl.searchParams;
    const bboxResult = parseBoundingBox(params);
    if (!bboxResult.ok) return NextResponse.json({ error: "Bounding box invalido.", reasons: bboxResult.errors }, { status: 400 });

    const limitResult = parseOptionalPositiveInt(params, "limit");
    if (!limitResult.ok) return NextResponse.json({ error: "Parametro invalido.", reasons: limitResult.errors }, { status: 400 });

    const result = getSitesInBoundingBox(getDb(), bboxResult.value, { limit: limitResult.value });
    if (result.error) return NextResponse.json({ error: "Bounding box invalido.", reasons: result.error }, { status: 400 });

    return NextResponse.json({
      items: (result.items as Array<Record<string, unknown>>).map(toCompactSite),
      count: result.count,
      totalCount: result.totalCount,
      truncated: result.truncated,
      limit: result.limit,
    });
  } catch (error) {
    console.error("geospatial_viewport_failed", error instanceof Error ? error.message : "unknown");
    return NextResponse.json({ error: "Viewport geoespacial indisponivel." }, { status: 500 });
  }
}
