// STAGE 1 -- WP1.8 Cluster API.
//
// Returns deterministic, server-side grid clusters (WP1.5's fixed-cell
// grid) of the sites inside a caller-supplied bounding box, instead of
// every individual site -- the payload-size control a map viewport needs
// once a zoomed-out view would otherwise contain thousands of markers.
//
// Thin HTTP adapter only, reusing Checkpoint 2 logic without
// reimplementation:
//   - request parsing/validation: services/geospatial/request-params.ts
//   - bbox-prefiltered candidate fetch + deterministic clustering:
//     getClustersInBoundingBox() in
//     services/geospatial/spatial-intelligence-engine.ts, which itself
//     calls the pure aggregateIntoGridClusters() in
//     services/geospatial/spatial-query-utils.ts
// See tests/geospatial-api-contract.test.ts (source inspection) and
// docs/stage-1/08_TEST_RESULTS.md for why this route cannot be imported
// directly by a Vitest test file.
import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getClustersInBoundingBox } from "@/services/geospatial/spatial-intelligence-engine";
import { parseBoundingBox, parseResolution, parseOptionalPositiveInt } from "@/services/geospatial/request-params";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Default resolution 1 (~11km cells) -- a reasonable middle ground for a
// city/region-scale viewport; callers zoomed to the whole country or to a
// single neighborhood are expected to pass an explicit resolution (0-3).
const DEFAULT_CLUSTER_RESOLUTION = 1;

export async function GET(request: NextRequest) {
  try {
    const params = request.nextUrl.searchParams;
    const bboxResult = parseBoundingBox(params);
    if (!bboxResult.ok) return NextResponse.json({ error: "Bounding box invalido.", reasons: bboxResult.errors }, { status: 400 });

    const resolutionResult = parseResolution(params, DEFAULT_CLUSTER_RESOLUTION);
    if (!resolutionResult.ok) return NextResponse.json({ error: "Parametro invalido.", reasons: resolutionResult.errors }, { status: 400 });

    const limitResult = parseOptionalPositiveInt(params, "limit");
    if (!limitResult.ok) return NextResponse.json({ error: "Parametro invalido.", reasons: limitResult.errors }, { status: 400 });

    const result = getClustersInBoundingBox(getDb(), bboxResult.value, resolutionResult.value, { limit: limitResult.value });
    if (result.error) return NextResponse.json({ error: "Bounding box invalido.", reasons: result.error }, { status: 400 });
    return NextResponse.json(result);
  } catch (error) {
    console.error("geospatial_clusters_failed", error instanceof Error ? error.message : "unknown");
    return NextResponse.json({ error: "Clusters geoespaciais indisponiveis." }, { status: 500 });
  }
}
