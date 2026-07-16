// STAGE 1 -- WP1.10 Geospatial Summary API.
//
// A national-scale overview -- grid-cell site density and coordinate-quality
// classification counts -- deliberately never a list of individual sites,
// so this endpoint's payload size does not grow with the size of the
// dataset the way viewport/radius/nearest necessarily do.
//
// Thin HTTP adapter only, reusing Checkpoint 1/2 logic without
// reimplementation:
//   - request parsing/validation: services/geospatial/request-params.ts
//   - grid density: getGridSummary() in
//     services/geospatial/spatial-intelligence-engine.ts, reading the
//     already-classified site_geospatial_status table (WP1.1/WP1.11)
//   - coordinate-quality counts: getCoordinateQualitySummary(), same table
// See tests/geospatial-api-contract.test.ts (source inspection) and
// docs/stage-1/08_TEST_RESULTS.md for why this route cannot be imported
// directly by a Vitest test file.
import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getGridSummary, getCoordinateQualitySummary } from "@/services/geospatial/spatial-intelligence-engine";
import { parseResolution, parseOptionalPositiveInt } from "@/services/geospatial/request-params";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Default resolution 0 (~111km cells) -- appropriate for a national-scale
// summary; a caller wanting a finer breakdown passes an explicit
// resolution.
const DEFAULT_SUMMARY_RESOLUTION = 0;

export async function GET(request: NextRequest) {
  try {
    const params = request.nextUrl.searchParams;
    const resolutionResult = parseResolution(params, DEFAULT_SUMMARY_RESOLUTION);
    if (!resolutionResult.ok) return NextResponse.json({ error: "Parametro invalido.", reasons: resolutionResult.errors }, { status: 400 });

    const limitResult = parseOptionalPositiveInt(params, "limit");
    if (!limitResult.ok) return NextResponse.json({ error: "Parametro invalido.", reasons: limitResult.errors }, { status: 400 });

    const db = getDb();
    const grid = getGridSummary(db, resolutionResult.value, { limit: limitResult.value });
    const coordinateQuality = getCoordinateQualitySummary(db);
    return NextResponse.json({ grid, coordinateQuality });
  } catch (error) {
    console.error("geospatial_summary_failed", error instanceof Error ? error.message : "unknown");
    return NextResponse.json({ error: "Resumo geoespacial indisponivel." }, { status: 500 });
  }
}
