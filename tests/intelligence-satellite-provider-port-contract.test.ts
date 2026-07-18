// GENESIS PHASE 2 -- Increment 10 (Satellite Intelligence), Wave 1.
// Dependency-boundary and neutrality contract tests for
// services/intelligence-runtime/satellite-intelligence-provider-port.ts,
// following the established pattern (tests/intelligence-data-trust-adapter-contract.test.ts):
// comments are stripped before matching for the neutrality sweep so prose
// citing a forbidden identifier as evidence for its own absence cannot
// false-positive. The raw-source import-boundary check below intentionally
// does NOT strip comments, mirroring tests/intelligence-runtime-registry.test.ts's
// own binding, non-comment-stripped literal-substring convention for
// services/intelligence-runtime/.
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import type {
  SatelliteCoverageMetadata,
  SatelliteProviderScene,
  SatelliteProviderQualitySummary,
  SatelliteTemporalWindow,
  SatelliteProviderRequest,
  SatelliteProviderOutcome,
  SatelliteProviderPort,
} from "@/services/intelligence-runtime/satellite-intelligence-provider-port";

const PORT_FILE = path.resolve(__dirname, "..", "services", "intelligence-runtime", "satellite-intelligence-provider-port.ts");

function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
}

describe("Increment 10 Wave 1: satellite-intelligence-provider-port.ts exists", () => {
  it("the port file exists at the frozen path", () => {
    expect(fs.existsSync(PORT_FILE)).toBe(true);
  });
});

describe("Increment 10 Wave 1: provider port neutrality (source inspection, comments stripped)", () => {
  const source = stripComments(fs.readFileSync(PORT_FILE, "utf8"));

  it("contains no orbitDirection reference", () => {
    expect(source).not.toMatch(/orbitDirection/);
  });

  it("contains no polarization reference", () => {
    expect(source).not.toMatch(/polarization/);
  });

  it("contains no relativeOrbit reference", () => {
    expect(source).not.toMatch(/relativeOrbit/);
  });

  it("contains no CopernicusScene reference", () => {
    expect(source).not.toMatch(/CopernicusScene/);
  });
});

describe("Increment 10 Wave 1: provider port raw-source import boundary (not comment-stripped)", () => {
  const raw = fs.readFileSync(PORT_FILE, "utf8");

  it("contains none of the forbidden literal substrings, even in a comment", () => {
    expect(raw).not.toMatch(/from\s*["']node:sqlite["']/);
    expect(raw).not.toMatch(/from\s*["']next\/server["']/);
    expect(raw).not.toMatch(/from\s*["']next["']/);
    expect(raw).not.toMatch(/@\/lib\/db/);
    expect(raw).not.toMatch(/@\/app\/api/);
  });

  it("does not import any legacy services/*-engine.ts module", () => {
    expect(raw).not.toMatch(/from\s*["'][^"']*services\/[a-z-]+-engine[^"']*["']/);
  });

  it("is not coupled to sentinel-core", () => {
    expect(raw).not.toMatch(/sentinel-core/);
  });
});

describe("Increment 10 Wave 1: provider port async fetch() signature", () => {
  const source = fs.readFileSync(PORT_FILE, "utf8");

  it("declares fetch(request: SatelliteProviderRequest): Promise<SatelliteProviderOutcome>", () => {
    expect(source).toMatch(/fetch\(request:\s*SatelliteProviderRequest\):\s*Promise<SatelliteProviderOutcome>/);
  });

  it("has no Promise.all in this file (exactly one provider call per request, no concurrency machinery here)", () => {
    expect(source).not.toMatch(/Promise\.all/);
  });
});

describe("Increment 10 Wave 1: provider port type-level export surface (compile-time)", () => {
  it("every required type is importable from the port module", () => {
    // If any of these types did not exist, `npx tsc --noEmit` would fail
    // to compile this file -- this is the type-only-module equivalent of
    // a runtime "is exported" assertion.
    const typeCheck: {
      coverage: SatelliteCoverageMetadata;
      scene: SatelliteProviderScene;
      quality: SatelliteProviderQualitySummary;
      window: SatelliteTemporalWindow;
      request: SatelliteProviderRequest;
      outcome: SatelliteProviderOutcome;
      port: SatelliteProviderPort;
    } | null = null;
    expect(typeCheck).toBeNull();
  });
});
