import { NextRequest, NextResponse } from "next/server";
import { projectCanonicalDataTrustResponse } from "@/services/intelligence-adapters/api-projection-adapter";
import type { CanonicalDataTrustOrchestrationResult } from "@/services/intelligence-runtime/intelligence-orchestrator";

/**
 * Genesis Phase 2 — Increment 7. Request-handling logic for
 * `GET /api/intelligence/data-trust/site`, factored out of `route.ts` itself.
 *
 * WHY THIS LOGIC LIVES IN ITS OWN FILE, NOT IN `route.ts`
 * ---------------------------------------------------------------------------
 * Next.js's App Router route-type checker (`.next/types/app/**`) rejects any named
 * export from a `route.ts` file other than the recognized set (`GET`/`POST`/.../
 * `runtime`/`dynamic`/`config`/...) -- confirmed directly by `next build` failing
 * with "Property 'handleCanonicalDataTrustSiteRequest' is incompatible with index
 * signature" when this function was first exported from `route.ts` alongside `GET`.
 * Moving the testable, dependency-injected handler here, and keeping `route.ts`
 * itself limited to `runtime`/`dynamic`/`GET`, satisfies that checker while
 * preserving the same testability this module needs: this file has no static
 * import of the DB-touching Orchestrator wiring at all (only a type-only import of
 * its result shape), so importing it in a test never triggers the `node:sqlite`
 * chain that `services/intelligence-runtime/intelligence-orchestrator-instance.ts`
 * carries (see that file's and `route.ts`'s own header comments for the full
 * reasoning).
 *
 * AUTHENTICATION ORDERING (post-audit fix, Increment 7 required-fix pass)
 * ---------------------------------------------------------------------------
 * This module no longer performs authentication itself. An independent audit found
 * that the previous design -- where `route.ts` dynamically imported the real,
 * DB-touching Orchestrator wiring unconditionally, then delegated to this handler,
 * which checked `requireAdminAuth` only after that import had already resolved --
 * meant the Orchestrator/outer-adapter/legacy-engine module graph was resolved for
 * every request, authorized or not. `route.ts` now checks `requireAdminAuth` first
 * and returns immediately on failure, before ever dynamically importing the
 * Orchestrator wiring or calling this handler at all. This handler therefore only
 * ever runs for an already-authorized request, and its own dependency surface
 * (`CanonicalDataTrustRouteDeps`) no longer includes an auth function -- there is
 * nothing left here to authenticate twice.
 *
 * Never opens a database itself, never imports `dataTrustForSite` or `lib/db`,
 * never leaks a stack trace or raw error message to the client.
 */
export interface CanonicalDataTrustRouteDeps {
  readonly getCanonicalDataTrustForSite: (siteId: number) => CanonicalDataTrustOrchestrationResult;
}

function parseSiteId(request: NextRequest): number | null {
  const raw = (request.nextUrl.searchParams.get("id") ?? "").trim();
  if (!raw) return null;
  if (!/^\d+$/.test(raw)) return null;
  const parsed = Number(raw);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

/**
 * Handles an already-authorized request: parses/validates the Site identifier,
 * invokes the Orchestrator, and maps the result to an HTTP response. The Orchestrator
 * result and the projection adapter are never both null/populated in the sense of the
 * caller getting a canonical envelope for a not-found Site -- a not-found result is
 * mapped straight to a 404 without ever calling `projectCanonicalDataTrustResponse`
 * (post-audit fix: the envelope itself carries no `notFound` field, since that state
 * can never reach a real HTTP response body).
 */
export async function handleCanonicalDataTrustSiteRequest(
  request: NextRequest,
  deps: CanonicalDataTrustRouteDeps,
): Promise<NextResponse> {
  const siteId = parseSiteId(request);
  if (siteId === null) {
    return NextResponse.json({ error: "Missing or invalid 'id' parameter." }, { status: 400 });
  }

  try {
    const result = deps.getCanonicalDataTrustForSite(siteId);
    if (result.notFound) {
      return NextResponse.json({ error: "Site not found." }, { status: 404 });
    }
    const envelope = projectCanonicalDataTrustResponse(result);
    return NextResponse.json(envelope, { status: result.success ? 200 : 422 });
  } catch (error) {
    console.error("intelligence_data_trust_site_failed", error instanceof Error ? error.name : "unknown");
    return NextResponse.json({ error: "Data Trust intelligence assessment unavailable." }, { status: 500 });
  }
}
