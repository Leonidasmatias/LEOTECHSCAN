import { NextRequest, NextResponse } from "next/server";
import { projectCanonicalEvidenceResponse } from "@/services/intelligence-adapters/evidence-projection-adapter";
import type { CanonicalEvidenceOrchestrationResult } from "@/services/intelligence-runtime/intelligence-evidence-orchestrator";

/**
 * Genesis Phase 2 — Increment 8. Request-handling logic for
 * `GET /api/intelligence/evidence-center/site`, factored out of `route.ts`
 * itself -- the same route/handler split Increment 7 established, applied
 * from the start this time (see that increment's own header comments and
 * post-audit required-fix pass for why): Next.js's App Router route-type
 * checker rejects any named export from a `route.ts` file other than the
 * recognized set (`GET`/`POST`/.../`runtime`/`dynamic`/`config`/...), and
 * authentication must be checked in `route.ts` before this handler (and the
 * DB-touching Orchestrator wiring it needs) is ever reached.
 *
 * This module performs no authentication itself -- that is `route.ts`'s
 * job, checked before this handler is ever invoked, so there is nothing
 * here to authenticate twice. Never opens a database itself, never imports
 * `evidenceCenterForSite` or `lib/db`, never leaks a stack trace or raw
 * error message to the client.
 */
export interface CanonicalEvidenceCenterRouteDeps {
  readonly getCanonicalEvidenceForSite: (siteId: number) => CanonicalEvidenceOrchestrationResult;
}

function parseSiteId(request: NextRequest): number | null {
  const raw = (request.nextUrl.searchParams.get("id") ?? "").trim();
  if (!raw) return null;
  if (!/^\d+$/.test(raw)) return null;
  const parsed = Number(raw);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

/**
 * Handles an already-authorized request: parses/validates the Site
 * identifier, invokes the Orchestrator, and maps the result to an HTTP
 * response. A not-found result is mapped straight to a 404 without ever
 * calling `projectCanonicalEvidenceResponse` -- the envelope itself carries
 * no `notFound` field, since that state can never reach a real HTTP
 * response body.
 */
export async function handleCanonicalEvidenceCenterSiteRequest(
  request: NextRequest,
  deps: CanonicalEvidenceCenterRouteDeps,
): Promise<NextResponse> {
  const siteId = parseSiteId(request);
  if (siteId === null) {
    return NextResponse.json({ error: "Missing or invalid 'id' parameter." }, { status: 400 });
  }

  try {
    const result = deps.getCanonicalEvidenceForSite(siteId);
    if (result.notFound) {
      return NextResponse.json({ error: "Site not found." }, { status: 404 });
    }
    const envelope = projectCanonicalEvidenceResponse(result);
    return NextResponse.json(envelope, { status: result.success ? 200 : 422 });
  } catch (error) {
    console.error("intelligence_evidence_center_site_failed", error instanceof Error ? error.name : "unknown");
    return NextResponse.json({ error: "Evidence intelligence assessment unavailable." }, { status: 500 });
  }
}
