import { NextRequest, NextResponse } from "next/server";
import { projectSiteIntelligenceResponse } from "@/services/intelligence-adapters/site-intelligence-projection-adapter";
import type { SiteIntelligenceOrchestrationResult } from "@/services/intelligence-runtime/site-intelligence-aggregator";

/**
 * Genesis Phase 2 — Increment 9. Request-handling logic for
 * `GET /api/intelligence/site`, factored out of `route.ts` itself -- the
 * same route/handler split Increments 7 and 8 established, applied from
 * the start (see those increments' own header comments and Increment 7's
 * post-audit required-fix pass for why): Next.js's App Router route-type
 * checker rejects any named export from a `route.ts` file other than the
 * recognized set (`GET`/`POST`/.../`runtime`/`dynamic`/`config`/...), and
 * authentication must be checked in `route.ts` before this handler (and
 * the wired Aggregator instance it needs) is ever reached.
 *
 * This module performs no authentication itself -- that is `route.ts`'s
 * job, checked before this handler is ever invoked, so there is nothing
 * here to authenticate twice. Never opens a database itself, never
 * imports either legacy engine or `lib/db`, never leaks a stack trace or
 * raw error message to the client.
 */
export interface SiteIntelligenceRouteDeps {
  readonly getCanonicalSiteIntelligence: (siteId: number) => SiteIntelligenceOrchestrationResult;
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
 * identifier, invokes the Aggregator, and maps the result to an HTTP
 * response.
 *
 * Status mapping (per the hardened planning document, Section 7/8/11):
 * - both capabilities agree the Site does not exist -> `result.notFound`
 *   is checked strictly first -> 404, no envelope built, `result.status`
 *   is never inspected for this case (post-audit hardening, F-2: the
 *   internal `status` value for this case is `"notFound"`, never
 *   `"failed"` -- see `site-intelligence-aggregator.ts` -- but this
 *   check's own ordering, not that internal value, is what guarantees
 *   404 here; `notFound` is evaluated before any `status` comparison is
 *   ever reached).
 * - `status: "complete"` or `"partial"` -> 200, envelope built.
 * - `status: "failed"` (neither capability produced a usable result, due
 *   to unexpected runtime failure -- never "both adaptation.success was
 *   false", which stays `"partial"` with two real envelopes present) ->
 *   a sanitized 500, identical in shape to the aggregator's own
 *   thrown-exception case below -- never a 200-class status for a
 *   response containing zero real capability data.
 * - an unexpected exception anywhere in this handler's own logic (e.g. a
 *   bug in projection itself) -> the identical sanitized 500.
 *
 * Post-audit hardening, F-3: every non-2xx-worthy condition above that
 * does not already carry a client-visible sanitized body of its own is
 * additionally logged server-side only, with a stable diagnostic code
 * and each underlying error's already-sanitized `.name` -- never
 * `.message`, `.stack`, request headers, or payload data.
 */
export async function handleSiteIntelligenceRequest(
  request: NextRequest,
  deps: SiteIntelligenceRouteDeps,
): Promise<NextResponse> {
  const siteId = parseSiteId(request);
  if (siteId === null) {
    return NextResponse.json({ error: "Missing or invalid 'id' parameter." }, { status: 400 });
  }

  try {
    const result = deps.getCanonicalSiteIntelligence(siteId);
    if (result.notFound) {
      return NextResponse.json({ error: "Site not found." }, { status: 404 });
    }

    // Post-audit hardening, F-3: sanitized, server-side-only diagnostic
    // logging for each capability that did not produce a usable result --
    // only a stable diagnostic code and the already-sanitized `.name` of
    // the underlying error (never `.message`, `.stack`, request headers,
    // or payload data) is ever logged, matching this project's
    // established convention. Logged independently of the overall
    // `status` -- a single crashed capability masked by the other
    // succeeding (an overall "partial"/200 response) is now visible
    // server-side too, not only a total "failed"/500 response.
    if (result.dataTrust.state === "unavailable") {
      console.error("intelligence_site_data_trust_unavailable", result.dataTrust.errorName);
    }
    if (result.evidenceCenter.state === "unavailable") {
      console.error("intelligence_site_evidence_center_unavailable", result.evidenceCenter.errorName);
    }

    if (result.status === "failed") {
      console.error("intelligence_site_status_failed", {
        dataTrust: result.dataTrust.errorName,
        evidenceCenter: result.evidenceCenter.errorName,
      });
      return NextResponse.json(
        { error: "Site intelligence assessment unavailable." },
        { status: 500 },
      );
    }
    const envelope = projectSiteIntelligenceResponse(result);
    return NextResponse.json(envelope, { status: 200 });
  } catch (error) {
    console.error("intelligence_site_failed", error instanceof Error ? error.name : "unknown");
    return NextResponse.json({ error: "Site intelligence assessment unavailable." }, { status: 500 });
  }
}
