// GENESIS PHASE 2 -- Increment 8 (Canonical route, behavioral tests).
// Tests the exported, dependency-injected handleCanonicalEvidenceCenterSiteRequest
// directly -- never the real GET export -- so this file never triggers the
// node:sqlite import chain the real Orchestrator wiring carries. See route.ts's own
// header comment. Authentication is route.ts's own job (checked before the dynamic
// import, proven by tests/intelligence-increment-8-contract.test.ts's ordering test),
// so this handler has no auth dependency to test here.
import { describe, it, expect, vi } from "vitest";
import { NextRequest } from "next/server";
import { handleCanonicalEvidenceCenterSiteRequest, type CanonicalEvidenceCenterRouteDeps } from "@/app/api/intelligence/evidence-center/site/handler";
import type { CanonicalEvidenceOrchestrationResult } from "@/services/intelligence-runtime/intelligence-evidence-orchestrator";

function request(query: string): NextRequest {
  return new NextRequest(`http://localhost/api/intelligence/evidence-center/site${query}`);
}

function successResult(overrides: Partial<CanonicalEvidenceOrchestrationResult> = {}): CanonicalEvidenceOrchestrationResult {
  return {
    notFound: false,
    success: true,
    siteId: "42",
    snapshot: { snapshotId: "derived:data-importacao:2026-01-01" as any, kind: "derived", source: "data_importacao", limitation: null },
    context: {
      contextId: "context:evidence:42:2026-01-15T12:00:00.000Z",
      correlationId: "correlation:evidence:42:2026-01-15T12:00:00.000Z",
      requestedAt: "2026-01-15T12:00:00.000Z",
      requestedBy: "api:intelligence/evidence-center/site",
      environment: "test",
    },
    evidence: [],
    issues: [],
    limitations: [],
    ...overrides,
  };
}

function deps(overrides: Partial<CanonicalEvidenceCenterRouteDeps> = {}): CanonicalEvidenceCenterRouteDeps {
  return {
    getCanonicalEvidenceForSite: vi.fn(() => successResult()),
    ...overrides,
  };
}

describe("handleCanonicalEvidenceCenterSiteRequest", () => {
  it("1. its only dependency is getCanonicalEvidenceForSite -- no authentication dependency", () => {
    const routeDeps = deps();
    expect(Object.keys(routeDeps)).toEqual(["getCanonicalEvidenceForSite"]);
  });

  it("2. returns 400 when 'id' is missing", async () => {
    const response = await handleCanonicalEvidenceCenterSiteRequest(request(""), deps());
    expect(response.status).toBe(400);
  });

  it("3. returns 400 when 'id' is not a positive integer", async () => {
    for (const bad of ["?id=abc", "?id=-1", "?id=0", "?id=1.5", "?id=%20%20"]) {
      const response = await handleCanonicalEvidenceCenterSiteRequest(request(bad), deps());
      expect(response.status).toBe(400);
    }
  });

  it("4. returns 404 when the Orchestrator reports notFound, without calling the projection adapter", async () => {
    const getCanonicalEvidenceForSite = vi.fn(() => successResult({ notFound: true, success: false }));
    const response = await handleCanonicalEvidenceCenterSiteRequest(request("?id=42"), { getCanonicalEvidenceForSite });
    expect(response.status).toBe(404);
    const body = await response.json();
    expect(body).toEqual({ error: "Site not found." });
    expect(body.schemaVersion).toBeUndefined();
  });

  it("5. returns 200 with the projected envelope on success, with no notFound field anywhere in the body", async () => {
    const response = await handleCanonicalEvidenceCenterSiteRequest(request("?id=42"), deps());
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.schemaVersion).toBe("1.0");
    expect(body.capability).toBe("evidence-center");
    expect("notFound" in body).toBe(false);
  });

  it("6. sets application/json content type", async () => {
    const response = await handleCanonicalEvidenceCenterSiteRequest(request("?id=42"), deps());
    expect(response.headers.get("content-type")).toContain("application/json");
  });

  it("7. returns 422 when adaptation did not succeed but the site was found", async () => {
    const getCanonicalEvidenceForSite = vi.fn(() => successResult({ success: false }));
    const response = await handleCanonicalEvidenceCenterSiteRequest(request("?id=42"), { getCanonicalEvidenceForSite });
    expect(response.status).toBe(422);
  });

  it("8. returns a sanitized 500 and never leaks the thrown error's message", async () => {
    const getCanonicalEvidenceForSite = vi.fn(() => {
      throw new Error("super secret internal detail");
    });
    const response = await handleCanonicalEvidenceCenterSiteRequest(request("?id=42"), { getCanonicalEvidenceForSite });
    expect(response.status).toBe(500);
    const body = await response.json();
    expect(JSON.stringify(body)).not.toContain("super secret internal detail");
  });

  it("9. calls the Orchestrator with the parsed numeric siteId", async () => {
    const routeDeps = deps();
    await handleCanonicalEvidenceCenterSiteRequest(request("?id=42"), routeDeps);
    expect(routeDeps.getCanonicalEvidenceForSite).toHaveBeenCalledWith(42);
  });

  it("10. never leaks internal fields (e.g. a raw 'notFound' key) in any response body", async () => {
    const responses = await Promise.all([
      handleCanonicalEvidenceCenterSiteRequest(request("?id=42"), deps()),
      handleCanonicalEvidenceCenterSiteRequest(request("?id=42"), { getCanonicalEvidenceForSite: vi.fn(() => successResult({ notFound: true, success: false })) }),
    ]);
    for (const response of responses) {
      const body = await response.json();
      expect("notFound" in body).toBe(false);
    }
  });
});
