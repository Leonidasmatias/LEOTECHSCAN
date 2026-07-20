import { NextRequest, NextResponse } from "next/server";
import { requireAdminAuth } from "@/lib/auth-guard";
import { handleSatelliteIntelligenceRequest } from "./handler";

/**
 * Genesis Phase 2 — Increment 10 (Satellite Intelligence), Wave 7.
 * `GET /api/intelligence/satellite/site?id=<siteId>`.
 *
 * This file is deliberately minimal (only `runtime`/`dynamic`/`GET`) --
 * Next.js's App Router route-type checker rejects any other named export
 * from a `route.ts` file, so the actual, unit-testable request-handling
 * logic (validation, projection, error mapping) lives in the sibling
 * `./handler.ts` module instead, per
 * `docs/genesis-phase-2/30_INCREMENT_10_SATELLITE_INTELLIGENCE_IMPLEMENTATION_PLAN.md`
 * Section 9.13.
 *
 * AUTHENTICATION BEFORE THE DYNAMIC IMPORT
 * ---------------------------------------------------------------------------
 * `requireAdminAuth` is checked here, first, before anything else --
 * including before the dynamic `import()` below. Checking auth first and
 * returning immediately on failure means an unauthorized or
 * malformed-credential request never triggers the dynamic import at all,
 * and therefore never resolves the orchestrator-instance/provider/legacy-
 * engine module chain. `handler.ts` performs no authentication itself (no
 * double-check) -- it only ever runs for an already-authorized request.
 *
 * WHY THE ORCHESTRATOR INSTANCE IS IMPORTED DYNAMICALLY, INSIDE `GET`, NOT
 * STATICALLY AT THE TOP
 * ---------------------------------------------------------------------------
 * `satellite-intelligence-orchestrator-instance.ts` transitively imports
 * the two Wave 3 `io/` files, which transitively import a database driver
 * -- and this repository's established, repeatedly-confirmed convention is
 * that a Vitest file transitively importing that driver cannot be safely
 * collected. Dynamically `import()`ing the real instance only inside
 * `GET`, after authentication succeeds, keeps this file itself free of any
 * static database-touching import and avoids resolving that module graph
 * for rejected requests.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest): Promise<NextResponse> {
  const auth = requireAdminAuth(request);
  if (!auth.authorized) return auth.response;

  const { getCanonicalSatelliteIntelligenceForSite } = await import(
    "@/services/intelligence-runtime/satellite-intelligence-orchestrator-instance"
  );
  return handleSatelliteIntelligenceRequest(request, { getCanonicalSatelliteIntelligenceForSite });
}
