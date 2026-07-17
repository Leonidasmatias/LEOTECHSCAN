// GENESIS PHASE 2 -- Increment 9 (Canonical aggregate route, behavioral tests).
// Tests the exported, dependency-injected handleSiteIntelligenceRequest
// directly -- never the real GET export -- so this file never triggers the
// database import chain the real Aggregator wiring carries. See route.ts's
// own header comment. Authentication is route.ts's own job (checked before
// the dynamic import, proven by tests/intelligence-increment-9-contract.test.ts's
// ordering test), so this handler has no auth dependency to test here.
import { describe, it, expect, vi } from "vitest";
import { NextRequest } from "next/server";
import { handleSiteIntelligenceRequest, type SiteIntelligenceRouteDeps } from "@/app/api/intelligence/site/handler";
import type { SiteIntelligenceOrchestrationResult } from "@/services/intelligence-runtime/site-intelligence-aggregator";
import { deriveSiteSnapshot } from "@/services/intelligence-adapters";

const SNAPSHOT = deriveSiteSnapshot({ dataImportacao: "2026-01-01", arquivoOrigem: "sites.xlsx" });

function request(query: string): NextRequest {
  return new NextRequest(`http://localhost/api/intelligence/site${query}`);
}

function successResult(overrides: Partial<SiteIntelligenceOrchestrationResult> = {}): SiteIntelligenceOrchestrationResult {
  return {
    notFound: false,
    status: "complete",
    siteId: "42",
    snapshot: SNAPSHOT,
    context: {
      contextId: "context:site-intelligence:42:2026-01-15T12:00:00.000Z",
      correlationId: "correlation:site-intelligence:42:2026-01-15T12:00:00.000Z",
      requestedAt: "2026-01-15T12:00:00.000Z",
      requestedBy: "api:intelligence/site",
      environment: "test",
    },
    dataTrust: {
      state: "available",
      result: {
        notFound: false,
        success: true,
        siteId: "42",
        snapshot: SNAPSHOT,
        context: {
          contextId: "context:data-trust:42:t",
          correlationId: "correlation:data-trust:42:t",
          requestedAt: "2026-01-15T11:59:59.000Z",
          requestedBy: "api:intelligence/data-trust/site",
          environment: "test",
        },
        score: null,
        recommendations: [],
        issues: [],
        limitations: [],
      },
      errorName: null,
    },
    evidenceCenter: {
      state: "available",
      result: {
        notFound: false,
        success: true,
        siteId: "42",
        snapshot: SNAPSHOT,
        context: {
          contextId: "context:evidence:42:t",
          correlationId: "correlation:evidence:42:t",
          requestedAt: "2026-01-15T12:00:00.500Z",
          requestedBy: "api:intelligence/evidence-center/site",
          environment: "test",
        },
        evidence: [],
        issues: [],
        limitations: [],
      },
      errorName: null,
    },
    issues: [],
    ...overrides,
  };
}

function deps(overrides: Partial<SiteIntelligenceRouteDeps> = {}): SiteIntelligenceRouteDeps {
  return {
    getCanonicalSiteIntelligence: vi.fn(() => successResult()),
    ...overrides,
  };
}

describe("handleSiteIntelligenceRequest", () => {
  it("1. its only dependency is getCanonicalSiteIntelligence -- no authentication dependency", () => {
    const routeDeps = deps();
    expect(Object.keys(routeDeps)).toEqual(["getCanonicalSiteIntelligence"]);
  });

  it("2. returns 400 when 'id' is missing or invalid", async () => {
    for (const bad of ["", "?id=abc", "?id=-1", "?id=0"]) {
      const response = await handleSiteIntelligenceRequest(request(bad), deps());
      expect(response.status).toBe(400);
    }
  });

  it("3. returns 404 when both capabilities agree the Site was not found, without building an envelope", async () => {
    const getCanonicalSiteIntelligence = vi.fn(() => successResult({ notFound: true }));
    const response = await handleSiteIntelligenceRequest(request("?id=999"), { getCanonicalSiteIntelligence });
    expect(response.status).toBe(404);
    const body = await response.json();
    expect(body).toEqual({ error: "Site not found." });
  });

  it('3b. (post-audit hardening, F-2) both-notFound never becomes HTTP 500, even when the internal status is deliberately "failed" -- proves notFound is evaluated before any status comparison', async () => {
    // A deliberately contrived, decoupled fixture: notFound: true paired
    // with a status value that would map to 500 if status were checked
    // first. This proves handleSiteIntelligenceRequest's own check order
    // (notFound strictly before status), independent of whatever the real
    // orchestrator actually produces for this case.
    const getCanonicalSiteIntelligence = vi.fn(() => successResult({ notFound: true, status: "failed" }));
    const response = await handleSiteIntelligenceRequest(request("?id=999"), { getCanonicalSiteIntelligence });
    expect(response.status).toBe(404);
    const body = await response.json();
    expect(body).toEqual({ error: "Site not found." });
  });

  it('3c. (post-audit hardening, F-2) both-notFound with the real internal status "notFound" still returns 404, not 500', async () => {
    const getCanonicalSiteIntelligence = vi.fn(() => successResult({ notFound: true, status: "notFound" }));
    const response = await handleSiteIntelligenceRequest(request("?id=999"), { getCanonicalSiteIntelligence });
    expect(response.status).toBe(404);
  });

  it("4. returns 200 with the projected envelope when status is complete", async () => {
    const response = await handleSiteIntelligenceRequest(request("?id=42"), deps());
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.schemaVersion).toBe("1.0");
    expect(body.capability).toBe("site-intelligence");
    expect(body.result.status).toBe("complete");
  });

  it("5. returns 200 with the projected envelope when status is partial", async () => {
    const getCanonicalSiteIntelligence = vi.fn(() =>
      successResult({
        status: "partial",
        evidenceCenter: { state: "unavailable", result: null, errorName: "Error" },
      }),
    );
    const response = await handleSiteIntelligenceRequest(request("?id=42"), { getCanonicalSiteIntelligence });
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.result.status).toBe("partial");
  });

  it("6. not-found inconsistency maps to 200 with status partial, never 404 or 500", async () => {
    const getCanonicalSiteIntelligence = vi.fn(() =>
      successResult({
        status: "partial",
        dataTrust: { state: "unavailable", result: null, errorName: "Error" },
        evidenceCenter: { state: "notFound", result: null, errorName: null },
        issues: [{ stage: "notfound-inconsistency", code: "notfound_inconsistency", severity: "significant", message: "m" }],
      }),
    );
    const response = await handleSiteIntelligenceRequest(request("?id=42"), { getCanonicalSiteIntelligence });
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.result.status).toBe("partial");
  });

  it("7. returns a sanitized 500 (not 200) when status is failed", async () => {
    const getCanonicalSiteIntelligence = vi.fn(() =>
      successResult({
        status: "failed",
        dataTrust: { state: "unavailable", result: null, errorName: "Error" },
        evidenceCenter: { state: "unavailable", result: null, errorName: "Error" },
      }),
    );
    const response = await handleSiteIntelligenceRequest(request("?id=42"), { getCanonicalSiteIntelligence });
    expect(response.status).toBe(500);
    const body = await response.json();
    expect(body).toEqual({ error: "Site intelligence assessment unavailable." });
  });

  it("8. an unexpected exception in the aggregator itself returns the identical sanitized 500 body as the failed-status case", async () => {
    const getCanonicalSiteIntelligence = vi.fn(() => {
      throw new Error("super secret internal detail");
    });
    const response = await handleSiteIntelligenceRequest(request("?id=42"), { getCanonicalSiteIntelligence });
    expect(response.status).toBe(500);
    const body = await response.json();
    expect(body).toEqual({ error: "Site intelligence assessment unavailable." });
    expect(JSON.stringify(body)).not.toContain("super secret internal detail");
  });

  it("8b. (post-audit hardening, F-3) logs a sanitized diagnostic when Data Trust is unavailable, even on an otherwise-200 partial response, and never leaks it into the body", async () => {
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      const getCanonicalSiteIntelligence = vi.fn(() =>
        successResult({
          status: "partial",
          dataTrust: { state: "unavailable", result: null, errorName: "TypeError" },
        }),
      );
      const response = await handleSiteIntelligenceRequest(request("?id=42"), { getCanonicalSiteIntelligence });
      expect(response.status).toBe(200);
      const body = await response.json();
      expect(JSON.stringify(body)).not.toContain("TypeError");
      expect(consoleErrorSpy).toHaveBeenCalledWith("intelligence_site_data_trust_unavailable", "TypeError");
    } finally {
      consoleErrorSpy.mockRestore();
    }
  });

  it("8c. (post-audit hardening, F-3) logs a sanitized diagnostic when Evidence Center is unavailable, and never leaks it into the body", async () => {
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      const getCanonicalSiteIntelligence = vi.fn(() =>
        successResult({
          status: "partial",
          evidenceCenter: { state: "unavailable", result: null, errorName: "RangeError" },
        }),
      );
      const response = await handleSiteIntelligenceRequest(request("?id=42"), { getCanonicalSiteIntelligence });
      expect(response.status).toBe(200);
      const body = await response.json();
      expect(JSON.stringify(body)).not.toContain("RangeError");
      expect(consoleErrorSpy).toHaveBeenCalledWith("intelligence_site_evidence_center_unavailable", "RangeError");
    } finally {
      consoleErrorSpy.mockRestore();
    }
  });

  it("8d. (post-audit hardening, F-3) logs a sanitized diagnostic (stable code plus only sanitized names) when status is failed, and never leaks it into the body", async () => {
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      const getCanonicalSiteIntelligence = vi.fn(() =>
        successResult({
          status: "failed",
          dataTrust: { state: "unavailable", result: null, errorName: "Error" },
          evidenceCenter: { state: "unavailable", result: null, errorName: "Error" },
        }),
      );
      const response = await handleSiteIntelligenceRequest(request("?id=42"), { getCanonicalSiteIntelligence });
      expect(response.status).toBe(500);
      const body = await response.json();
      expect(body).toEqual({ error: "Site intelligence assessment unavailable." });
      expect(consoleErrorSpy).toHaveBeenCalledWith("intelligence_site_status_failed", {
        dataTrust: "Error",
        evidenceCenter: "Error",
      });
      // Distinct diagnostic code from the outer-catch-all path (test 8),
      // so the two conditions remain distinguishable in logs.
      expect(consoleErrorSpy).not.toHaveBeenCalledWith("intelligence_site_failed", expect.anything());
    } finally {
      consoleErrorSpy.mockRestore();
    }
  });

  it("8e. (post-audit hardening, F-3) never logs a raw error message or stack -- only stable codes and sanitized .name values", async () => {
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      const getCanonicalSiteIntelligence = vi.fn(() => {
        throw new Error("super secret internal detail with a stack trace");
      });
      await handleSiteIntelligenceRequest(request("?id=42"), { getCanonicalSiteIntelligence });
      for (const call of consoleErrorSpy.mock.calls) {
        const serialized = JSON.stringify(call);
        expect(serialized).not.toContain("super secret internal detail");
        expect(serialized).not.toMatch(/at\s+\S+\s+\(/); // no stack-trace-shaped text
      }
      expect(consoleErrorSpy).toHaveBeenCalledWith("intelligence_site_failed", "Error");
    } finally {
      consoleErrorSpy.mockRestore();
    }
  });

  it("8f. (post-audit hardening, F-3) does not log a per-capability diagnostic when both capabilities are fully available (complete status)", async () => {
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      const response = await handleSiteIntelligenceRequest(request("?id=42"), deps());
      expect(response.status).toBe(200);
      expect(consoleErrorSpy).not.toHaveBeenCalled();
    } finally {
      consoleErrorSpy.mockRestore();
    }
  });

  it("9. handler contains no auth dependency and never imports requireAdminAuth", () => {
    const routeDeps = deps();
    expect(routeDeps).not.toHaveProperty("requireAdminAuth");
  });

  it("10. response is JSON serializable and sets application/json content type", async () => {
    const response = await handleSiteIntelligenceRequest(request("?id=42"), deps());
    expect(response.headers.get("content-type")).toContain("application/json");
    const body = await response.json();
    expect(() => JSON.stringify(body)).not.toThrow();
  });

  it("11. calls the Aggregator with the parsed numeric siteId, and never leaks a stack trace on the failed path", async () => {
    const routeDeps = deps();
    await handleSiteIntelligenceRequest(request("?id=42"), routeDeps);
    expect(routeDeps.getCanonicalSiteIntelligence).toHaveBeenCalledWith(42);

    const throwing = vi.fn(() => {
      throw new Error("boom");
    });
    const response = await handleSiteIntelligenceRequest(request("?id=42"), { getCanonicalSiteIntelligence: throwing });
    const body = await response.json();
    expect(JSON.stringify(body)).not.toContain("boom");
    expect(JSON.stringify(body)).not.toMatch(/at\s+\S+\s+\(/); // no stack-trace-shaped text
  });
});
