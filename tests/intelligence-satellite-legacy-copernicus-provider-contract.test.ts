// GENESIS PHASE 2 -- Increment 10 (Satellite Intelligence), Wave 3.
// Dependency-boundary and behavioral contract tests for
// services/intelligence-adapters/io/legacy-copernicus-provider.ts.
//
// This file is never imported directly: it transitively resolves
// node:sqlite via getWritableDb() (@/lib/db) and the legacy Copernicus
// engine, the same collection hazard every other io/-classified file in
// this project carries. Every behavioral assertion below is
// source-inspection only (comments stripped before matching), following
// the established, already-validated pattern used throughout this
// project for exactly this class of file.
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

const PROVIDER_FILE = path.resolve(
  __dirname,
  "..",
  "services",
  "intelligence-adapters",
  "io",
  "legacy-copernicus-provider.ts",
);

const ADAPTER_DIR = path.resolve(__dirname, "..", "services", "intelligence-adapters");

function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
}

function walkTsFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walkTsFiles(full));
    else if (entry.name.endsWith(".ts")) out.push(full);
  }
  return out;
}

describe("Increment 10 Wave 3: legacy-copernicus-provider.ts exists", () => {
  it("the file exists at the frozen path", () => {
    expect(fs.existsSync(PROVIDER_FILE)).toBe(true);
  });
});

describe("Increment 10 Wave 3: legacy Copernicus import chokepoint (services/intelligence-adapters/**, two-file allowlist)", () => {
  // Per docs/genesis-phase-2/30_INCREMENT_10_SATELLITE_INTELLIGENCE_IMPLEMENTATION_PLAN.md
  // Section 10.3 and 31_INCREMENT_10_IMPLEMENTATION_CONTRACT.md Section 11
  // (both as amended by the Wave 3 Change Control decision, tag
  // genesis-phase-2-increment-10-wave-3-change-control-v1): exactly two
  // files across the whole services/intelligence-adapters/** tree are
  // authorized to import copernicus-engine or copernicus-truth -- this
  // file (the authorized Increment 10 provider) and
  // services/intelligence-adapters/evidence-adapter.ts (a formally
  // authorized, grandfathered pre-existing exception, Increment 5/8,
  // limited to its existing copernicus-truth import only). This sweep
  // scans every file under services/intelligence-adapters/** and excludes
  // only that one named, formally authorized exception; any other
  // matching file fails the check.
  const KNOWN_PRE_EXISTING_EXCEPTIONS = [path.join(ADAPTER_DIR, "evidence-adapter.ts")];

  it("only legacy-copernicus-provider.ts imports copernicus-engine or copernicus-truth across services/intelligence-adapters/**, apart from the one authorized grandfathered exception", () => {
    const files = walkTsFiles(ADAPTER_DIR).filter(
      (file) => !KNOWN_PRE_EXISTING_EXCEPTIONS.includes(file),
    );
    const matches: string[] = [];
    for (const file of files) {
      const source = stripComments(fs.readFileSync(file, "utf8"));
      if (/copernicus-engine|copernicus-truth/.test(source)) {
        matches.push(file);
      }
    }
    expect(matches).toHaveLength(1);
    expect(matches[0]).toBe(PROVIDER_FILE);
  });
});

describe("Increment 10 Wave 3: legacy-copernicus-provider.ts import boundary", () => {
  const source = stripComments(fs.readFileSync(PROVIDER_FILE, "utf8"));

  it("imports exactly the authorized dependencies", () => {
    expect(source).toMatch(/import type \{ DatabaseSync \} from ["']node:sqlite["']/);
    expect(source).toMatch(/import \{ getWritableDb \} from ["']@\/lib\/db["']/);
    expect(source).toMatch(/import \{ copernicusForSite \} from ["']@\/services\/copernicus-engine["']/);
    expect(source).toMatch(/from ["']@\/services\/intelligence-runtime\/satellite-intelligence-provider-port["']/);
  });

  it("never imports any other *-engine module", () => {
    const engineImports = source.match(/from\s*["'][^"']*-engine[^"']*["']/g) ?? [];
    for (const line of engineImports) {
      expect(line).toMatch(/copernicus-engine/);
    }
  });

  it("never imports next, next/server, or @/app/api", () => {
    expect(source).not.toMatch(/from\s*["']next\/server["']/);
    expect(source).not.toMatch(/from\s*["']next["']/);
    expect(source).not.toMatch(/@\/app\/api/);
  });
});

describe("Increment 10 Wave 3: persist=false and satelliteValidationForSite trap", () => {
  const source = stripComments(fs.readFileSync(PROVIDER_FILE, "utf8"));

  it("calls copernicusForSite with the literal false persist argument, never omitted, never a variable", () => {
    const calls = source.match(/copernicusForSite\([^)]*\)/g) ?? [];
    expect(calls.length).toBeGreaterThan(0);
    for (const call of calls) {
      expect(call).toMatch(/,\s*false\s*\)$/);
    }
  });

  it("never calls satelliteValidationForSite", () => {
    expect(source).not.toMatch(/satelliteValidationForSite\(/);
  });

  it("forwards request.siteId and request.radiusKm directly, without reinterpretation", () => {
    expect(source).toMatch(/copernicusForSite\(\s*db,\s*request\.siteId,\s*request\.radiusKm,\s*lookbackDays,\s*false\s*\)/);
  });
});

describe("Increment 10 Wave 3: async provider-port contract", () => {
  const source = stripComments(fs.readFileSync(PROVIDER_FILE, "utf8"));

  it("declares fetch as async, returning Promise<SatelliteProviderOutcome>", () => {
    expect(source).toMatch(/async fetch\(request:\s*SatelliteProviderRequest\):\s*Promise<SatelliteProviderOutcome>/);
  });

  it("every return path inside fetch() resolves via Promise.resolve, never a bare throw or rejection", () => {
    const fetchBodyStart = source.indexOf("async fetch(request");
    const fetchBody = source.slice(fetchBodyStart);
    const returns = fetchBody.match(/return\s+[^;]+;/g) ?? [];
    expect(returns.length).toBeGreaterThan(0);
    for (const ret of returns) {
      expect(ret).toMatch(/Promise\.resolve\(/);
    }
  });

  it("wraps the entire legacy call in try/catch, so fetch() itself never rejects", () => {
    expect(source).toMatch(/try\s*\{/);
    expect(source).toMatch(/\}\s*catch/);
  });

  it("has no Promise.all (exactly one provider call per request)", () => {
    expect(source).not.toMatch(/Promise\.all/);
  });

  it("declares the frozen providerCode literal", () => {
    expect(source).toMatch(/providerCode:\s*PROVIDER_CODE/);
    expect(source).toMatch(/PROVIDER_CODE\s*=\s*["']copernicus-legacy-simulated["']/);
  });
});

describe("Increment 10 Wave 3: legacy scoring logic is reused, never duplicated", () => {
  const source = stripComments(fs.readFileSync(PROVIDER_FILE, "utf8"));

  it("does not reimplement the legacy scoring weights (validCoordinate/recentScene/multipleScenes/metadataCompleteness)", () => {
    expect(source).not.toMatch(/rules\.scoring/);
    expect(source).not.toMatch(/validationScore\s*=\s*Math\.min\(100/);
  });

  it("does not reimplement coordinate validation or scene generation", () => {
    expect(source).not.toMatch(/function validateSiteCoordinates/);
    expect(source).not.toMatch(/function mockScenes/);
    expect(source).not.toMatch(/function fetchSentinel1Metadata/);
  });

  it("maps the legacy 0-100 validationScore to a 0-1 overallScore by simple division", () => {
    expect(source).toMatch(/result\.validation\.validationScore\s*\/\s*100/);
  });

  it("maps every legacy evidenceLevel literal to its canonical classification, matching the frozen plan's table exactly", () => {
    expect(source).toMatch(/Alta:\s*["']high["']/);
    expect(source).toMatch(/Media:\s*["']medium["']/);
    expect(source).toMatch(/Baixa:\s*["']low["']/);
    expect(source).toMatch(/Insuficiente:\s*["']insufficient["']/);
  });

  it("threads the legacy scene fields through verbatim, never fabricating cloudCoveragePercent or spatialResolutionMeters", () => {
    expect(source).toMatch(/sourceSceneId:\s*scene\.sceneId\s*\?\?\s*null/);
    expect(source).toMatch(/capturedAt:\s*scene\.acquisitionDate\s*\?\?\s*null/);
    expect(source).toMatch(/spatialResolutionMeters:\s*null/);
    expect(source).toMatch(/cloudCoveragePercent:\s*null/);
  });

  it("preserves provider-specific fields only inside the bounded sourceAttributes bag", () => {
    expect(source).toMatch(/sourceAttributes:\s*\{/);
    expect(source).toMatch(/orbitDirection:\s*scene\.orbitDirection/);
    expect(source).toMatch(/polarization:\s*scene\.polarization/);
    expect(source).toMatch(/relativeOrbit:\s*scene\.relativeOrbit/);
  });
});

describe("Increment 10 Wave 3: no_coverage and determinism", () => {
  const source = stripComments(fs.readFileSync(PROVIDER_FILE, "utf8"));

  it("returns kind: no_coverage when the legacy call produces zero scenes", () => {
    expect(source).toMatch(/result\.scenes\.length === 0/);
    expect(source).toMatch(/kind:\s*["']no_coverage["']/);
  });

  it("has no Date.now(), Math.random(), or crypto.randomUUID()", () => {
    expect(source).not.toMatch(/Date\.now\(/);
    expect(source).not.toMatch(/Math\.random\(/);
    expect(source).not.toMatch(/crypto\.randomUUID\(/);
  });

  it("derives lookbackDays deterministically from the temporal window via Date.parse only, never a live clock", () => {
    expect(source).toMatch(/Date\.parse\(window\.endAt\)/);
    expect(source).toMatch(/Date\.parse\(window\.startAt\)/);
    expect(source).toMatch(/Math\.max\(\s*1,/);
  });

  it("reuses request.temporalWindow.endAt as retrievedAt, never a fresh clock read", () => {
    expect(source).toMatch(/const retrievedAt = request\.temporalWindow\.endAt;/);
  });
});
