// GENESIS PHASE 2 -- Increment 0 Security Floor (docs/genesis-phase-2/14_IMPLEMENTATION_ROADMAP.md).
//
// Dependency-free shared-secret guard for the "Privileged recalculation" operation class
// (docs/genesis-phase-2/10_SECURITY_BOUNDARY.md). This is a minimal floor, not full
// authentication (ADR-011, 15_ARCHITECTURE_DECISIONS.md) -- it exists only to close the
// highest-severity open risk (unauthenticated compute/write-intensive routes) with the
// smallest possible footprint. Fails closed: any ambiguity resolves to "not authorized".
import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";

export const ADMIN_KEY_HEADER = "x-sentinel-admin-key";
export const ADMIN_KEY_ENV = "SENTINEL_ADMIN_KEY";

/** Constant-time string comparison. Never throws on mismatched lengths. */
function secretsMatch(provided: string, expected: string): boolean {
  const providedBuf = Buffer.from(provided, "utf8");
  const expectedBuf = Buffer.from(expected, "utf8");
  if (providedBuf.length !== expectedBuf.length) {
    // Still perform a same-cost comparison so a length mismatch doesn't short-circuit early.
    timingSafeEqual(expectedBuf, expectedBuf);
    return false;
  }
  return timingSafeEqual(providedBuf, expectedBuf);
}

export type AdminAuthResult = { authorized: true } | { authorized: false; response: NextResponse };

/**
 * Fail-closed shared-secret check for privileged mutation routes. Call this before any
 * database access, request-body processing, engine execution, persistence, or audit write.
 * Never logs or echoes the client-provided or configured secret.
 */
export function requireAdminAuth(request: Request): AdminAuthResult {
  const expected = process.env[ADMIN_KEY_ENV];
  if (!expected) {
    console.error("sentinel_admin_key_not_configured");
    return {
      authorized: false,
      response: NextResponse.json({ error: "Servico de autorizacao indisponivel." }, { status: 503 }),
    };
  }
  const provided = request.headers.get(ADMIN_KEY_HEADER) || "";
  if (!provided || !secretsMatch(provided, expected)) {
    return {
      authorized: false,
      response: NextResponse.json({ error: "Nao autorizado." }, { status: 401 }),
    };
  }
  return { authorized: true };
}
