import { NextRequest, NextResponse } from "next/server";
import { requireAdminAuth } from "@/lib/auth-guard";
import { handleCanonicalEvidenceCenterSiteRequest } from "./handler";

/**
 * Genesis Phase 2 — Increment 8. `GET /api/intelligence/evidence-center/site`
 * -- the second canonical, additive, read-only Intelligence capability
 * route, a peer to Increment 7's Data Trust route, per ADR-020 (Final
 * Intelligence API Architecture, Option C: federated capability APIs).
 *
 * Per `12_DEPENDENCY_GRAPH.md`'s forbidden dependency #3, this route never
 * calls `evidenceCenterForSite` or any legacy engine directly -- it calls
 * the minimal Evidence Orchestrator only.
 *
 * This file is deliberately minimal (only `runtime`/`dynamic`/`GET`) --
 * Next.js's App Router route-type checker rejects any other named export
 * from a `route.ts` file, so the actual, unit-testable request-handling
 * logic (validation, projection, error mapping) lives in the sibling
 * `./handler.ts` module instead.
 *
 * AUTHENTICATION BEFORE THE DYNAMIC IMPORT (applying Increment 7's
 * post-audit required fix from the start)
 * ---------------------------------------------------------------------------
 * `requireAdminAuth` is checked here, first, before anything else --
 * including before the dynamic `import()` below. Increment 7's own
 * independent audit found that importing the DB-touching Orchestrator
 * wiring before checking authentication meant that wiring's entire module
 * graph was resolved for every request, authorized or not. Checking auth
 * first and returning immediately on failure means an unauthorized or
 * malformed-credential request never triggers the dynamic import at all,
 * and therefore never resolves the Orchestrator/outer-adapter/legacy-engine
 * module chain. `handler.ts` performs no authentication itself (no
 * double-check) -- it only ever runs for an already-authorized request.
 *
 * WHY THE ORCHESTRATOR IS IMPORTED DYNAMICALLY, INSIDE `GET`, NOT STATICALLY
 * AT THE TOP
 * ---------------------------------------------------------------------------
 * The real Orchestrator wiring
 * (`services/intelligence-runtime/intelligence-evidence-orchestrator-instance.ts`)
 * transitively imports `node:sqlite` (via the Evidence Center outer adapter
 * -> `services/evidence-center-engine.ts` -> `services/site-service.ts` ->
 * `lib/db.ts`), and this repository's established, repeatedly-confirmed
 * convention is that a Vitest file transitively importing `node:sqlite`
 * cannot be safely collected -- no existing route or engine module is ever
 * imported directly by a test for this exact reason (every existing
 * route/engine contract test source-inspects the file as text instead).
 * Dynamically `import()`ing the real Orchestrator only inside `GET`, after
 * authentication succeeds, keeps this file itself free of any static
 * DB-touching import and avoids resolving that module graph for rejected
 * requests.
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

  const { getCanonicalEvidenceForSite } = await import(
    "@/services/intelligence-runtime/intelligence-evidence-orchestrator-instance"
  );
  return handleCanonicalEvidenceCenterSiteRequest(request, { getCanonicalEvidenceForSite });
}
