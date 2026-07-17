import { NextRequest, NextResponse } from "next/server";
import { requireAdminAuth } from "@/lib/auth-guard";
import { handleSiteIntelligenceRequest } from "./handler";

/**
 * Genesis Phase 2 — Increment 9. `GET /api/intelligence/site` -- the
 * federated Site Intelligence Aggregator anticipated by ADR-020 (Final
 * Intelligence API Architecture, Option C), composing the two frozen
 * capability routes (Data Trust, Increment 7; Evidence Center, Increment
 * 8) via their own orchestrators, never their HTTP routes or handlers.
 *
 * Per `12_DEPENDENCY_GRAPH.md`'s forbidden dependency #3 and ADR-020
 * Section 11's explicit prohibition on internal HTTP self-composition,
 * this route never calls either legacy engine, either capability route,
 * or either capability handler directly -- it calls the minimal Site
 * Intelligence Aggregator only, which itself calls only the two frozen
 * capability orchestrators' own already-public entry points.
 *
 * This file is deliberately minimal (only `runtime`/`dynamic`/`GET`) --
 * Next.js's App Router route-type checker rejects any other named export
 * from a `route.ts` file, so the actual, unit-testable request-handling
 * logic (validation, projection, error mapping) lives in the sibling
 * `./handler.ts` module instead.
 *
 * AUTHENTICATION BEFORE THE DYNAMIC IMPORT (applying Increment 7's
 * post-audit required fix, and Increment 8's from-the-start application,
 * from the start here too)
 * ---------------------------------------------------------------------------
 * `requireAdminAuth` is checked here, first, before anything else --
 * including before the dynamic `import()` below. Checking auth first and
 * returning immediately on failure means an unauthorized or
 * malformed-credential request never triggers the dynamic import at all,
 * and therefore never resolves the Aggregator/capability-orchestrator/
 * outer-adapter/legacy-engine module chain. `handler.ts` performs no
 * authentication itself (no double-check) -- it only ever runs for an
 * already-authorized request.
 *
 * WHY THE AGGREGATOR IS IMPORTED DYNAMICALLY, INSIDE `GET`, NOT STATICALLY
 * AT THE TOP
 * ---------------------------------------------------------------------------
 * The real Aggregator wiring
 * (`services/intelligence-runtime/site-intelligence-aggregator-instance.ts`)
 * transitively resolves both frozen capability instance modules, which in
 * turn transitively import a database driver via each capability's own
 * outer read adapter -- and this repository's established,
 * repeatedly-confirmed convention is that a Vitest file transitively
 * importing that driver cannot be safely collected. Dynamically
 * `import()`ing the real Aggregator only inside `GET`, after
 * authentication succeeds, keeps this file itself free of any static
 * database-touching import and avoids resolving that module graph for
 * rejected requests.
 *
 * Requirements enforced here: authenticated (fail-closed, reusing
 * Increment 0's `requireAdminAuth` -- the strongest existing mechanism in
 * the repository, per ADR-020 Section 16); read-only; additive; isolated;
 * unused by any existing caller. No stack trace or internal error message
 * is ever forwarded to the client.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest): Promise<NextResponse> {
  const auth = requireAdminAuth(request);
  if (!auth.authorized) return auth.response;

  const { getCanonicalSiteIntelligence } = await import(
    "@/services/intelligence-runtime/site-intelligence-aggregator-instance"
  );
  return handleSiteIntelligenceRequest(request, { getCanonicalSiteIntelligence });
}
