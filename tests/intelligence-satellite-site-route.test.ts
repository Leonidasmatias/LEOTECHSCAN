// GENESIS PHASE 2 -- Increment 10 (Satellite Intelligence), Wave 7.
// Behavioral and source-inspection tests for
// app/api/intelligence/satellite/site/handler.ts and route.ts, per
// docs/genesis-phase-2/29_INCREMENT_10_SATELLITE_INTELLIGENCE_PLAN.md Section 15
// and docs/genesis-phase-2/30_INCREMENT_10_SATELLITE_INTELLIGENCE_IMPLEMENTATION_PLAN.md
// Section 9.12/9.13, plus ACA-002-A/ACA-002-B. Tests the exported,
// dependency-injected handleSatelliteIntelligenceRequest directly -- never
// the real GET export -- so this file never triggers the database import
// chain the real orchestrator wiring carries. Authentication is route.ts's
// own job, verified here via source inspection (mirroring
// tests/intelligence-increment-9-contract.test.ts's own established
// technique), so the handler has no auth dependency to test.
import { describe, it, expect, vi } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { NextRequest } from "next/server";
import {
  handleSatelliteIntelligenceRequest,
  type SatelliteIntelligenceRouteDeps,
} from "@/app/api/intelligence/satellite/site/handler";
import type { SatelliteCapabilityOutcome } from "@/services/intelligence-runtime/satellite-intelligence-orchestrator";
import type { SatelliteObservation } from "@/services/intelligence-adapters/satellite-observation-model";
import type { SatelliteOrchestrationIssue } from "@/services/intelligence-adapters/satellite-observation-adapter";

const ROUTE_FILE = path.resolve(__dirname, "..", "app", "api", "intelligence", "satellite", "site", "route.ts");
const HANDLER_FILE = path.resolve(__dirname, "..", "app", "api", "intelligence", "satellite", "site", "handler.ts");

function request(query: string): NextRequest {
  return new NextRequest(`http://localhost/api/intelligence/satellite/site${query}`);
}

function baseObservation(overrides: Partial<SatelliteObservation> = {}): SatelliteObservation {
  return {
    observationId: "observation:42:S1A_TEST",
    observationType: "sar_scene_metadata",
    provider: {
      providerCode: "copernicus-legacy-simulated",
      dataset: "Sentinel-1 GRD",
      sourceType: "sar",
      retrievedAt: "2026-01-01T00:00:00.000Z",
    },
    spatial: {
      siteCoordinates: { latitude: -23.55, longitude: -46.63 },
      requestedRadiusKm: 2,
      coordinateEligibility: "eligible",
      coordinateStatus: "valid",
    },
    temporal: {
      captureTime: "2025-12-01T00:00:00.000Z",
      retrievedAt: "2026-01-01T00:00:00.000Z",
      imageryAgeDays: 31,
      freshness: "recent",
    },
    quality: {
      cloudCoveragePercent: null,
      noDataCoveragePercent: 0,
      spatialResolutionMeters: 10,
      sourceConfidence: 0.8,
      qualityClassification: "high",
      usable: true,
    },
    derivationMethod: "copernicus-legacy-simulated:v1",
    evidenceId: "satellite:copernicus-legacy-simulated:42:abc123",
    limitations: [],
    ...overrides,
  };
}

function baseIssue(overrides: Partial<SatelliteOrchestrationIssue> = {}): SatelliteOrchestrationIssue {
  return {
    stage: "observation",
    code: "missing_scene_id",
    severity: "significant",
    message: "Provider scene has no sourceSceneId; it cannot be adapted into a canonical observation.",
    canContinue: true,
    ...overrides,
  };
}

function baseOutcome(overrides: Partial<SatelliteCapabilityOutcome> = {}): SatelliteCapabilityOutcome {
  return {
    notFound: false,
    status: "complete",
    siteId: "42",
    coordinateEligibility: "eligible",
    observations: [baseObservation()],
    evidence: [],
    truthMetadata: {
      dataReality: "simulated",
      realSatelliteEvidence: false,
      simulationReason: "Data source: local_rule_engine (dataStatus=simulated).",
      sourceDisclosure: "dataStatus=simulated; source=local_rule_engine",
    },
    context: {
      contextId: "context:satellite-intelligence:42:2026-01-01T00:00:00.000Z",
      correlationId: "correlation:satellite-intelligence:42:2026-01-01T00:00:00.000Z",
      requestedAt: "2026-01-01T00:00:00.000Z",
      requestedBy: "api:intelligence/satellite/site",
      environment: "test",
    },
    issues: [],
    limitations: [],
    ...overrides,
  };
}

function deps(overrides: Partial<SatelliteIntelligenceRouteDeps> = {}): SatelliteIntelligenceRouteDeps {
  return {
    getCanonicalSatelliteIntelligenceForSite: vi.fn(() => Promise.resolve(baseOutcome())),
    ...overrides,
  };
}

describe("handleSatelliteIntelligenceRequest", () => {
  it("1. its only dependency is getCanonicalSatelliteIntelligenceForSite -- no authentication dependency", () => {
    const routeDeps = deps();
    expect(Object.keys(routeDeps)).toEqual(["getCanonicalSatelliteIntelligenceForSite"]);
  });

  it("2. returns 400 for every invalid 'id' value, and never calls the orchestrator", async () => {
    const cases: Array<[string, string]> = [
      ["empty", ""],
      ["whitespace only", "?id=%20%20%20"],
      ["decimal", "?id=42.5"],
      ["negative", "?id=-1"],
      ["zero", "?id=0"],
      ["non-numeric", "?id=abc"],
    ];
    for (const [label, query] of cases) {
      const getCanonicalSatelliteIntelligenceForSite = vi.fn(() => Promise.resolve(baseOutcome()));
      const response = await handleSatelliteIntelligenceRequest(request(query), { getCanonicalSatelliteIntelligenceForSite });
      expect(response.status, `case: ${label}`).toBe(400);
      expect(getCanonicalSatelliteIntelligenceForSite, `case: ${label}`).not.toHaveBeenCalled();
    }
  });

  it("2b. accepts an id with leading/trailing whitespace around otherwise-valid digits", async () => {
    const getCanonicalSatelliteIntelligenceForSite = vi.fn(() => Promise.resolve(baseOutcome()));
    const response = await handleSatelliteIntelligenceRequest(request("?id=%20%2042%20%20"), {
      getCanonicalSatelliteIntelligenceForSite,
    });
    expect(response.status).toBe(200);
    expect(getCanonicalSatelliteIntelligenceForSite).toHaveBeenCalledWith(42);
  });

  it("3. returns 404 with a sanitized body, without calling projection, when notFound is true", async () => {
    const getCanonicalSatelliteIntelligenceForSite = vi.fn(() => Promise.resolve(baseOutcome({ notFound: true })));
    const response = await handleSatelliteIntelligenceRequest(request("?id=999"), { getCanonicalSatelliteIntelligenceForSite });
    expect(response.status).toBe(404);
    const body = await response.json();
    expect(body).toEqual({ error: "Site not found." });
    expect(body).not.toHaveProperty("schemaVersion");
  });

  it("3b. notFound is evaluated before any status comparison, even when status is deliberately 'failed'", async () => {
    const getCanonicalSatelliteIntelligenceForSite = vi.fn(() =>
      Promise.resolve(baseOutcome({ notFound: true, status: "failed" })),
    );
    const response = await handleSatelliteIntelligenceRequest(request("?id=999"), { getCanonicalSatelliteIntelligenceForSite });
    expect(response.status).toBe(404);
  });

  it("4. returns 200 with the projected envelope when status is complete", async () => {
    const response = await handleSatelliteIntelligenceRequest(request("?id=42"), deps());
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.schemaVersion).toBe("1.0");
    expect(body.capability).toBe("satellite-intelligence");
    expect(body.result.status).toBe("complete");
  });

  it("5. returns 200 with the projected envelope when status is partial", async () => {
    const getCanonicalSatelliteIntelligenceForSite = vi.fn(() =>
      Promise.resolve(baseOutcome({ status: "partial", issues: [baseIssue()] })),
    );
    const response = await handleSatelliteIntelligenceRequest(request("?id=42"), { getCanonicalSatelliteIntelligenceForSite });
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.result.status).toBe("partial");
  });

  it("6. returns 200 with the projected envelope when status is unavailable due to ineligible coordinates", async () => {
    const getCanonicalSatelliteIntelligenceForSite = vi.fn(() =>
      Promise.resolve(baseOutcome({ status: "unavailable", coordinateEligibility: "ineligible", observations: [] })),
    );
    const response = await handleSatelliteIntelligenceRequest(request("?id=42"), { getCanonicalSatelliteIntelligenceForSite });
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.schemaVersion).toBe("1.0");
    expect(body.result.status).toBe("unavailable");
    expect(body.result.coordinateEligibility).toBe("ineligible");
  });

  it("7. returns 503 (sanitized error body, no envelope) when status is unavailable due to a provider-level failure", async () => {
    const getCanonicalSatelliteIntelligenceForSite = vi.fn(() =>
      Promise.resolve(baseOutcome({ status: "unavailable", observations: [], issues: [] })),
    );
    const response = await handleSatelliteIntelligenceRequest(request("?id=42"), { getCanonicalSatelliteIntelligenceForSite });
    expect(response.status).toBe(503);
    const body = await response.json();
    expect(body).toEqual({ error: "Satellite intelligence provider unavailable." });
    expect(body).not.toHaveProperty("schemaVersion");
  });

  it("8. returns 502 (sanitized error body, no envelope) when status is unavailable because every scene was rejected", async () => {
    const getCanonicalSatelliteIntelligenceForSite = vi.fn(() =>
      Promise.resolve(baseOutcome({ status: "unavailable", observations: [], issues: [baseIssue(), baseIssue()] })),
    );
    const response = await handleSatelliteIntelligenceRequest(request("?id=42"), { getCanonicalSatelliteIntelligenceForSite });
    expect(response.status).toBe(502);
    const body = await response.json();
    expect(body).toEqual({ error: "Satellite intelligence could not be adapted from the provider response." });
    expect(body).not.toHaveProperty("schemaVersion");
  });

  it("9. returns a sanitized 500 (not 200) when status is failed", async () => {
    const getCanonicalSatelliteIntelligenceForSite = vi.fn(() => Promise.resolve(baseOutcome({ status: "failed" })));
    const response = await handleSatelliteIntelligenceRequest(request("?id=42"), { getCanonicalSatelliteIntelligenceForSite });
    expect(response.status).toBe(500);
    const body = await response.json();
    expect(body).toEqual({ error: "Satellite intelligence assessment unavailable." });
  });

  it("10. an unexpected exception in the orchestrator itself returns the identical sanitized 500 body as the failed-status case", async () => {
    const getCanonicalSatelliteIntelligenceForSite = vi.fn(() => {
      throw new Error("super secret internal detail");
    });
    const response = await handleSatelliteIntelligenceRequest(request("?id=42"), { getCanonicalSatelliteIntelligenceForSite });
    expect(response.status).toBe(500);
    const body = await response.json();
    expect(body).toEqual({ error: "Satellite intelligence assessment unavailable." });
    expect(JSON.stringify(body)).not.toContain("super secret internal detail");
  });

  it("11. calls the orchestrator exactly once, with the parsed numeric siteId", async () => {
    const routeDeps = deps();
    await handleSatelliteIntelligenceRequest(request("?id=42"), routeDeps);
    expect(routeDeps.getCanonicalSatelliteIntelligenceForSite).toHaveBeenCalledTimes(1);
    expect(routeDeps.getCanonicalSatelliteIntelligenceForSite).toHaveBeenCalledWith(42);
  });

  it("12. response is JSON serializable and sets application/json content type, for both success and error paths", async () => {
    const successResponse = await handleSatelliteIntelligenceRequest(request("?id=42"), deps());
    expect(successResponse.headers.get("content-type")).toContain("application/json");
    expect(() => JSON.stringify(successResponse)).not.toThrow();

    const errorResponse = await handleSatelliteIntelligenceRequest(request("?id=abc"), deps());
    expect(errorResponse.headers.get("content-type")).toContain("application/json");
  });

  it("13. never mutates the outcome returned by the orchestrator", async () => {
    const outcome = baseOutcome({ status: "partial", issues: [baseIssue()], observations: [baseObservation()] });
    const snapshot = JSON.parse(JSON.stringify(outcome));
    const getCanonicalSatelliteIntelligenceForSite = vi.fn(() => Promise.resolve(outcome));
    await handleSatelliteIntelligenceRequest(request("?id=42"), { getCanonicalSatelliteIntelligenceForSite });
    expect(outcome).toEqual(snapshot);
  });

  it("14. produces a deterministic body for identical input across repeated calls", async () => {
    const routeDeps = deps();
    const first = await handleSatelliteIntelligenceRequest(request("?id=42"), routeDeps);
    const second = await handleSatelliteIntelligenceRequest(request("?id=42"), routeDeps);
    expect(await first.json()).toEqual(await second.json());
  });

  it("15. never exposes the internal notFound field or an evidence field on a 200 response", async () => {
    const response = await handleSatelliteIntelligenceRequest(request("?id=42"), deps());
    const body = await response.json();
    expect(body).not.toHaveProperty("notFound");
    expect(body).not.toHaveProperty("evidence");
    expect(body.result).not.toHaveProperty("evidence");
  });

  it("15b. (ACA-002-A) logs the single collapsed diagnostic code for provider-level unavailable, and never leaks it into the body", async () => {
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      const getCanonicalSatelliteIntelligenceForSite = vi.fn(() =>
        Promise.resolve(baseOutcome({ status: "unavailable", observations: [], issues: [] })),
      );
      const response = await handleSatelliteIntelligenceRequest(request("?id=42"), { getCanonicalSatelliteIntelligenceForSite });
      expect(response.status).toBe(503);
      expect(consoleErrorSpy).toHaveBeenCalledWith("satellite_provider_unavailable");
      // ACA-002-A: exactly one collapsed code, never the two originally-
      // envisioned, reason-specific codes doc 29 could not actually supply.
      expect(consoleErrorSpy).not.toHaveBeenCalledWith("satellite_provider_misconfigured");
      expect(consoleErrorSpy).not.toHaveBeenCalledWith("satellite_provider_timeout");
      const body = await response.json();
      expect(JSON.stringify(body)).not.toContain("satellite_provider_unavailable");
    } finally {
      consoleErrorSpy.mockRestore();
    }
  });

  it("15c. logs satellite_coordinates_unavailable for the ineligible-coordinates case, even though it returns 200", async () => {
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      const getCanonicalSatelliteIntelligenceForSite = vi.fn(() =>
        Promise.resolve(baseOutcome({ status: "unavailable", coordinateEligibility: "ineligible", observations: [] })),
      );
      const response = await handleSatelliteIntelligenceRequest(request("?id=42"), { getCanonicalSatelliteIntelligenceForSite });
      expect(response.status).toBe(200);
      expect(consoleErrorSpy).toHaveBeenCalledWith("satellite_coordinates_unavailable");
    } finally {
      consoleErrorSpy.mockRestore();
    }
  });

  it("15d. logs satellite_provider_adaptation_failed with a bounded rejected-scene count and distinct issue codes, for both the partial (200) and all-rejected (502) cases", async () => {
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      const issues = [baseIssue(), baseIssue()];

      const partialDeps = vi.fn(() => Promise.resolve(baseOutcome({ status: "partial", issues })));
      const partialResponse = await handleSatelliteIntelligenceRequest(request("?id=42"), {
        getCanonicalSatelliteIntelligenceForSite: partialDeps,
      });
      expect(partialResponse.status).toBe(200);
      expect(consoleErrorSpy).toHaveBeenCalledWith("satellite_provider_adaptation_failed", {
        rejectedScenes: 2,
        issueCodes: ["missing_scene_id"],
      });

      consoleErrorSpy.mockClear();

      const allRejectedDeps = vi.fn(() =>
        Promise.resolve(baseOutcome({ status: "unavailable", observations: [], issues })),
      );
      const allRejectedResponse = await handleSatelliteIntelligenceRequest(request("?id=42"), {
        getCanonicalSatelliteIntelligenceForSite: allRejectedDeps,
      });
      expect(allRejectedResponse.status).toBe(502);
      expect(consoleErrorSpy).toHaveBeenCalledWith("satellite_provider_adaptation_failed", {
        rejectedScenes: 2,
        issueCodes: ["missing_scene_id"],
      });
    } finally {
      consoleErrorSpy.mockRestore();
    }
  });

  it("15e. logs satellite_no_coverage for a complete status with zero observations", async () => {
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      const getCanonicalSatelliteIntelligenceForSite = vi.fn(() =>
        Promise.resolve(baseOutcome({ status: "complete", observations: [] })),
      );
      const response = await handleSatelliteIntelligenceRequest(request("?id=42"), { getCanonicalSatelliteIntelligenceForSite });
      expect(response.status).toBe(200);
      expect(consoleErrorSpy).toHaveBeenCalledWith("satellite_no_coverage");
    } finally {
      consoleErrorSpy.mockRestore();
    }
  });

  it("15f. does not log any diagnostic when status is complete with usable observations", async () => {
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      const response = await handleSatelliteIntelligenceRequest(request("?id=42"), deps());
      expect(response.status).toBe(200);
      expect(consoleErrorSpy).not.toHaveBeenCalled();
    } finally {
      consoleErrorSpy.mockRestore();
    }
  });

  it("15g. never logs a raw error message or stack -- only stable codes and sanitized .name values", async () => {
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      const getCanonicalSatelliteIntelligenceForSite = vi.fn(() => {
        throw new Error("super secret internal detail with a stack trace");
      });
      await handleSatelliteIntelligenceRequest(request("?id=42"), { getCanonicalSatelliteIntelligenceForSite });
      for (const call of consoleErrorSpy.mock.calls) {
        const serialized = JSON.stringify(call);
        expect(serialized).not.toContain("super secret internal detail");
        expect(serialized).not.toMatch(/at\s+\S+\s+\(/); // no stack-trace-shaped text
      }
      expect(consoleErrorSpy).toHaveBeenCalledWith("satellite_intelligence_failed", "Error");
    } finally {
      consoleErrorSpy.mockRestore();
    }
  });

  it("16. handler contains no auth dependency and never imports requireAdminAuth", () => {
    const routeDeps = deps();
    expect(routeDeps).not.toHaveProperty("requireAdminAuth");
  });
});

function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
}

describe("Increment 10 Wave 7: handler.ts source inspection", () => {
  const rawSource = fs.readFileSync(HANDLER_FILE, "utf8");
  const source = stripComments(rawSource);

  it("never imports requireAdminAuth or @/lib/auth-guard", () => {
    expect(source).not.toMatch(/requireAdminAuth/);
    expect(source).not.toMatch(/from\s*["']@\/lib\/auth-guard["']/);
  });

  it("never imports @/lib/db or node:sqlite", () => {
    expect(source).not.toMatch(/@\/lib\/db/);
    expect(source).not.toMatch(/from\s*["']node:sqlite["']/);
  });

  it("never imports the legacy Copernicus engine/truth module, or any other legacy *-engine module", () => {
    expect(source).not.toMatch(/copernicus-engine/);
    expect(source).not.toMatch(/copernicus-truth/);
    expect(source).not.toMatch(/from\s*["'][^"']*-engine[^"']*["']/);
  });

  it("never statically or dynamically imports the orchestrator instance -- it is received only via injected deps", () => {
    expect(source).not.toMatch(/satellite-intelligence-orchestrator-instance/);
  });

  it("never imports Wave 2's or Wave 4's adapters, or either Wave 3 io/ file", () => {
    expect(source).not.toMatch(/satellite-observation-adapter/);
    expect(source).not.toMatch(/satellite-evidence-adapter/);
    expect(source).not.toMatch(/io\/legacy-copernicus-provider/);
    expect(source).not.toMatch(/io\/satellite-site-read-adapter/);
  });

  it("imports projectSatelliteIntelligenceResponse and uses it for every non-error envelope -- never manually reconstructs the public shape", () => {
    expect(source).toMatch(/import\s*\{[^}]*\bprojectSatelliteIntelligenceResponse\b[^}]*\}\s*from/);
    expect(source).not.toMatch(/schemaVersion:\s*["']1\.0["']/);
  });

  it("has no Date.now(), Math.random(), or crypto.randomUUID()", () => {
    expect(source).not.toMatch(/Date\.now\(/);
    expect(source).not.toMatch(/Math\.random\(/);
    expect(source).not.toMatch(/crypto\.randomUUID\(/);
  });

  it("has no Promise.all", () => {
    expect(source).not.toMatch(/Promise\.all\(/);
  });
});

describe("Increment 10 Wave 7: route.ts source inspection", () => {
  const rawSource = fs.readFileSync(ROUTE_FILE, "utf8");
  const source = stripComments(rawSource);

  it("imports requireAdminAuth from @/lib/auth-guard", () => {
    expect(source).toMatch(/import\s*\{[^}]*\brequireAdminAuth\b[^}]*\}\s*from\s*["']@\/lib\/auth-guard["']/);
  });

  it("references the orchestrator instance via a dynamic import, never a static one", () => {
    expect(source).toMatch(
      /await\s+import\(\s*["']@\/services\/intelligence-runtime\/satellite-intelligence-orchestrator-instance["']\s*\)/,
    );
    expect(source).not.toMatch(
      /^import[^;]*from\s*["']@\/services\/intelligence-runtime\/satellite-intelligence-orchestrator-instance["']/m,
    );
  });

  it("authentication is checked and returns on failure strictly before the dynamic import is reached", () => {
    const authCallIndex = source.indexOf("requireAdminAuth(request)");
    const authReturnIndex = source.indexOf("if (!auth.authorized) return auth.response;");
    const dynamicImportIndex = source.indexOf("await import(");
    expect(authCallIndex).toBeGreaterThan(-1);
    expect(authReturnIndex).toBeGreaterThan(-1);
    expect(dynamicImportIndex).toBeGreaterThan(-1);
    expect(authCallIndex).toBeLessThan(dynamicImportIndex);
    expect(authReturnIndex).toBeLessThan(dynamicImportIndex);
  });

  it("never imports node:sqlite, @/lib/db, or any legacy *-engine module directly", () => {
    expect(source).not.toMatch(/from\s*["']node:sqlite["']/);
    expect(source).not.toMatch(/@\/lib\/db/);
    expect(source).not.toMatch(/from\s*["'][^"']*-engine[^"']*["']/);
    expect(source).not.toMatch(/copernicus-truth/);
  });

  it("exports exactly GET, runtime, and dynamic -- nothing else", () => {
    const exportedNames = Array.from(rawSource.matchAll(/^export\s+(?:async\s+function\s+(\w+)|const\s+(\w+))/gm)).map(
      (match) => match[1] ?? match[2],
    );
    expect(exportedNames.sort()).toEqual(["GET", "dynamic", "runtime"].sort());
  });

  it("declares runtime = \"nodejs\" and dynamic = \"force-dynamic\"", () => {
    expect(source).toMatch(/export\s+const\s+runtime\s*=\s*["']nodejs["']/);
    expect(source).toMatch(/export\s+const\s+dynamic\s*=\s*["']force-dynamic["']/);
  });

  it("GET is the only HTTP method handler exported", () => {
    const methodExports = rawSource.match(/^export\s+async\s+function\s+(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)\b/gm) ?? [];
    expect(methodExports).toHaveLength(1);
    expect(methodExports[0]).toContain("GET");
  });
});
