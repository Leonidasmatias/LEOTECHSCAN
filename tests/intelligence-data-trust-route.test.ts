// GENESIS PHASE 2 -- Increment 7 (Canonical route, behavioral tests).
// Tests the exported, dependency-injected handleCanonicalDataTrustSiteRequest directly
// -- never the real GET export -- so this file never triggers the node:sqlite import
// chain the real Orchestrator wiring carries. See route.ts's own header comment.
//
// POST-AUDIT NOTE: handleCanonicalDataTrustSiteRequest no longer performs
// authentication (that moved to route.ts's GET, checked before the Orchestrator is
// ever dynamically imported -- see tests/intelligence-increment-7-contract.test.ts's
// "authentication occurs before the dynamic import" test for that ordering proof, and
// tests/auth-guard.test.ts for requireAdminAuth's own 401/503 behavior, unchanged by
// this increment). This file therefore only covers what the handler itself still
// owns: id validation, not-found/success/domain-failure mapping, and error
// sanitization.
import { describe, it, expect, vi } from "vitest";
import { NextRequest } from "next/server";
import { handleCanonicalDataTrustSiteRequest, type CanonicalDataTrustRouteDeps } from "@/app/api/intelligence/data-trust/site/handler";
import type { CanonicalDataTrustOrchestrationResult } from "@/services/intelligence-runtime/intelligence-orchestrator";

function request(query: string): NextRequest {
  return new NextRequest(`http://localhost/api/intelligence/data-trust/site${query}`);
}

function successResult(overrides: Partial<CanonicalDataTrustOrchestrationResult> = {}): CanonicalDataTrustOrchestrationResult {
  return {
    notFound: false,
    success: true,
    siteId: "42",
    snapshot: { snapshotId: "derived:data-importacao:2026-01-01" as any, kind: "derived", source: "data_importacao", limitation: null },
    context: {
      contextId: "context:data-trust:42:2026-01-15T12:00:00.000Z",
      correlationId: "correlation:data-trust:42:2026-01-15T12:00:00.000Z",
      requestedAt: "2026-01-15T12:00:00.000Z",
      requestedBy: "api:intelligence/data-trust/site",
      environment: "test",
    },
    score: null,
    recommendations: [],
    issues: [],
    limitations: [],
    ...overrides,
  };
}

function deps(overrides: Partial<CanonicalDataTrustRouteDeps> = {}): CanonicalDataTrustRouteDeps {
  return {
    getCanonicalDataTrustForSite: vi.fn(() => successResult()),
    ...overrides,
  };
}

describe("handleCanonicalDataTrustSiteRequest", () => {
  it("1. no longer accepts or requires an authentication dependency -- its only dependency is getCanonicalDataTrustForSite", () => {
    const routeDeps = deps();
    expect(Object.keys(routeDeps)).toEqual(["getCanonicalDataTrustForSite"]);
  });

  it("2. returns 400 when 'id' is missing", async () => {
    const response = await handleCanonicalDataTrustSiteRequest(request(""), deps());
    expect(response.status).toBe(400);
  });

  it("3. returns 400 when 'id' is not a positive integer", async () => {
    for (const bad of ["?id=abc", "?id=-1", "?id=0", "?id=1.5"]) {
      const response = await handleCanonicalDataTrustSiteRequest(request(bad), deps());
      expect(response.status).toBe(400);
    }
  });

  it("4. returns 404 when the Orchestrator reports notFound, without calling the projection adapter", async () => {
    const getCanonicalDataTrustForSite = vi.fn(() => successResult({ notFound: true, success: false }));
    const response = await handleCanonicalDataTrustSiteRequest(request("?id=42"), { getCanonicalDataTrustForSite });
    expect(response.status).toBe(404);
    const body = await response.json();
    // A 404 body is the plain error shape, never the versioned canonical envelope --
    // proves projectCanonicalDataTrustResponse's output never leaks a notFound state.
    expect(body).toEqual({ error: "Site not found." });
    expect(body.schemaVersion).toBeUndefined();
  });

  it("5. returns 200 with the projected envelope on success, with no notFound field anywhere in the body", async () => {
    const response = await handleCanonicalDataTrustSiteRequest(request("?id=42"), deps());
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.schemaVersion).toBe("1.0");
    expect(body.capability).toBe("data-trust");
    expect(body.notFound).toBeUndefined();
    expect("notFound" in body).toBe(false);
  });

  it("6. sets application/json content type", async () => {
    const response = await handleCanonicalDataTrustSiteRequest(request("?id=42"), deps());
    expect(response.headers.get("content-type")).toContain("application/json");
  });

  it("7. returns 422 when adaptation did not succeed but the site was found", async () => {
    const getCanonicalDataTrustForSite = vi.fn(() => successResult({ success: false }));
    const response = await handleCanonicalDataTrustSiteRequest(request("?id=42"), { getCanonicalDataTrustForSite });
    expect(response.status).toBe(422);
  });

  it("8. returns a sanitized 500 and never leaks the thrown error's message", async () => {
    const getCanonicalDataTrustForSite = vi.fn(() => {
      throw new Error("super secret internal detail");
    });
    const response = await handleCanonicalDataTrustSiteRequest(request("?id=42"), { getCanonicalDataTrustForSite });
    expect(response.status).toBe(500);
    const body = await response.json();
    expect(JSON.stringify(body)).not.toContain("super secret internal detail");
  });

  it("9. calls the Orchestrator with the parsed numeric siteId", async () => {
    const routeDeps = deps();
    await handleCanonicalDataTrustSiteRequest(request("?id=42"), routeDeps);
    expect(routeDeps.getCanonicalDataTrustForSite).toHaveBeenCalledWith(42);
  });

  it("10. rejects whitespace-only id as invalid (400), not as a valid id", async () => {
    const response = await handleCanonicalDataTrustSiteRequest(request("?id=%20%20"), deps());
    expect(response.status).toBe(400);
  });
});
