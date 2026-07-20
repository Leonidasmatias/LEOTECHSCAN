import { NextRequest, NextResponse } from "next/server";
import { projectSatelliteIntelligenceResponse } from "@/services/intelligence-adapters/satellite-projection-adapter";
import type { SatelliteCapabilityOutcome } from "@/services/intelligence-runtime/satellite-intelligence-orchestrator";

/**
 * Genesis Phase 2 — Increment 10 (Satellite Intelligence), Wave 7.
 *
 * Request-handling logic for `GET /api/intelligence/satellite/site`,
 * factored out of `route.ts` itself, per
 * `docs/genesis-phase-2/30_INCREMENT_10_SATELLITE_INTELLIGENCE_IMPLEMENTATION_PLAN.md`
 * Section 9.12 -- the same route/handler split every existing capability
 * establishes: Next.js's App Router route-type checker rejects any named
 * export from a `route.ts` file other than the recognized set, and
 * authentication must be checked in `route.ts` before this handler (and the
 * wired orchestrator instance it needs) is ever reached.
 *
 * This module performs no authentication itself -- that is `route.ts`'s
 * job, checked before this handler is ever invoked. Never opens a
 * database itself, never imports the legacy Copernicus engine, never
 * leaks a stack trace or raw error message to the client.
 *
 * ACA-002-B: supports only `?id=<siteId>` -- no `radiusKm`/`temporalWindow`
 * override, since the frozen Wave 5 orchestrator entry point accepts only
 * `siteId` and computes its own defaults internally.
 */
export interface SatelliteIntelligenceRouteDeps {
  readonly getCanonicalSatelliteIntelligenceForSite: (siteId: number) => Promise<SatelliteCapabilityOutcome>;
}

function parseSiteId(request: NextRequest): number | null {
  const raw = (request.nextUrl.searchParams.get("id") ?? "").trim();
  if (!raw) return null;
  if (!/^\d+$/.test(raw)) return null;
  const parsed = Number(raw);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function issueCodes(issues: SatelliteCapabilityOutcome["issues"]): string[] {
  return Array.from(new Set(issues.map((issue) => issue.code)));
}

/**
 * Handles an already-authorized request: parses/validates the Site
 * identifier, invokes the orchestrator, and maps the result to an HTTP
 * response.
 *
 * Status mapping (frozen plan Section 15, F-7; ACA-002-A for the
 * collapsed provider-unavailable diagnostic):
 * - `result.notFound` is checked strictly first -> 404, no envelope built.
 * - `status: "failed"` -> a sanitized 500, identical in shape to the
 *   orchestrator's own thrown-exception case below.
 * - `status: "unavailable"` with `coordinateEligibility: "ineligible"` ->
 *   200, a truthful, disclosed non-result -- the Site exists, the request
 *   was well-formed, and no provider or transport failure is involved.
 * - `status: "unavailable"` with at least one adaptation issue (every
 *   scene the provider returned was rejected) -> 502 -- the provider was
 *   reached and responded, but the response could not be used.
 * - `status: "unavailable"` otherwise (the provider itself could not be
 *   reached or errored) -> 503. Per ACA-002-A, the frozen outcome type
 *   exposes no field distinguishing `misconfigured`/`invalid_credentials`
 *   from `timeout`/`rate_limited`/`unexpected_error`, so a single
 *   diagnostic code (`satellite_provider_unavailable`) covers both.
 * - `status: "partial"` or `"complete"` -> 200, envelope built via
 *   `projectSatelliteIntelligenceResponse` exclusively -- never manually
 *   reconstructed.
 * - an unexpected exception anywhere in this handler's own logic (e.g. a
 *   bug in projection itself) -> the identical sanitized 500.
 *
 * Every non-2xx-worthy condition above that does not already carry a
 * client-visible sanitized body of its own is additionally logged
 * server-side only, with a stable diagnostic code -- never a raw error
 * message, stack trace, or payload data (frozen plan Section 21).
 */
export async function handleSatelliteIntelligenceRequest(
  request: NextRequest,
  deps: SatelliteIntelligenceRouteDeps,
): Promise<NextResponse> {
  const siteId = parseSiteId(request);
  if (siteId === null) {
    return NextResponse.json({ error: "Missing or invalid 'id' parameter." }, { status: 400 });
  }

  try {
    const result = await deps.getCanonicalSatelliteIntelligenceForSite(siteId);

    if (result.notFound) {
      return NextResponse.json({ error: "Site not found." }, { status: 404 });
    }

    if (result.status === "failed") {
      console.error("satellite_intelligence_failed");
      return NextResponse.json({ error: "Satellite intelligence assessment unavailable." }, { status: 500 });
    }

    if (result.status === "unavailable") {
      if (result.coordinateEligibility === "ineligible") {
        console.error("satellite_coordinates_unavailable");
        return NextResponse.json(projectSatelliteIntelligenceResponse(result), { status: 200 });
      }
      if (result.issues.length > 0) {
        console.error("satellite_provider_adaptation_failed", {
          rejectedScenes: result.issues.length,
          issueCodes: issueCodes(result.issues),
        });
        return NextResponse.json(
          { error: "Satellite intelligence could not be adapted from the provider response." },
          { status: 502 },
        );
      }
      console.error("satellite_provider_unavailable");
      return NextResponse.json({ error: "Satellite intelligence provider unavailable." }, { status: 503 });
    }

    if (result.status === "complete" && result.observations.length === 0) {
      console.error("satellite_no_coverage");
    }

    if (result.status === "partial" && result.issues.length > 0) {
      console.error("satellite_provider_adaptation_failed", {
        rejectedScenes: result.issues.length,
        issueCodes: issueCodes(result.issues),
      });
    }

    return NextResponse.json(projectSatelliteIntelligenceResponse(result), { status: 200 });
  } catch (error) {
    console.error("satellite_intelligence_failed", error instanceof Error ? error.name : "unknown");
    return NextResponse.json({ error: "Satellite intelligence assessment unavailable." }, { status: 500 });
  }
}
