// GENESIS PHASE 2 -- Increment 8 (Canonical Evidence Path).
// Dependency-boundary and architectural contract tests via source inspection,
// following the established pattern (tests/intelligence-increment-7-contract.test.ts):
// comments are stripped before matching so prose citing a forbidden import path as
// evidence for NOT importing it cannot false-positive.
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { runtimeEngineRegistry } from "@/services/intelligence-runtime";
import capabilities from "@/config/capabilities.json";

const ROOT = path.resolve(__dirname, "..");
const CHECKSUM_FILE = path.join(ROOT, "services", "intelligence-adapters", "evidence-checksum.ts");
const OUTER_ADAPTER_FILE = path.join(ROOT, "services", "intelligence-adapters", "evidence-center-read-adapter.ts");
const ORCHESTRATOR_CORE_FILE = path.join(ROOT, "services", "intelligence-runtime", "intelligence-evidence-orchestrator.ts");
const ORCHESTRATOR_INSTANCE_FILE = path.join(ROOT, "services", "intelligence-runtime", "intelligence-evidence-orchestrator-instance.ts");
const PROJECTION_ADAPTER_FILE = path.join(ROOT, "services", "intelligence-adapters", "evidence-projection-adapter.ts");
const ROUTE_FILE = path.join(ROOT, "app", "api", "intelligence", "evidence-center", "site", "route.ts");
const HANDLER_FILE = path.join(ROOT, "app", "api", "intelligence", "evidence-center", "site", "handler.ts");

const DATA_TRUST_ROUTE_FILE = path.join(ROOT, "app", "api", "intelligence", "data-trust", "site", "route.ts");
const DATA_TRUST_HANDLER_FILE = path.join(ROOT, "app", "api", "intelligence", "data-trust", "site", "handler.ts");
const LEGACY_EVIDENCE_SITE_ROUTE = path.join(ROOT, "app", "api", "evidence-center", "site", "route.ts");
const LEGACY_EVIDENCE_EXPORT_ROUTE = path.join(ROOT, "app", "api", "evidence-center", "export", "route.ts");
const LEGACY_COPERNICUS_SITE_ROUTE = path.join(ROOT, "app", "api", "copernicus", "site", "route.ts");

function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
}

function read(file: string): string {
  return stripComments(fs.readFileSync(file, "utf8"));
}

function walkTsFiles(dir: string, exclude: string[] = []): string[] {
  const out: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (exclude.some((ex) => full.includes(ex))) continue;
    if (entry.isDirectory()) out.push(...walkTsFiles(full, exclude));
    else if (entry.name.endsWith(".ts") || entry.name.endsWith(".tsx")) out.push(full);
  }
  return out;
}

describe("Increment 8: exact production file inventory exists", () => {
  it("all seven new production files exist", () => {
    for (const file of [CHECKSUM_FILE, OUTER_ADAPTER_FILE, ORCHESTRATOR_CORE_FILE, ORCHESTRATOR_INSTANCE_FILE, PROJECTION_ADAPTER_FILE, ROUTE_FILE, HANDLER_FILE]) {
      expect(fs.existsSync(file)).toBe(true);
    }
  });

  it("did not itself introduce the aggregate route (/api/intelligence/site) -- Increment 9 is the approved increment that does, and it now exists", () => {
    const aggregateDir = path.join(ROOT, "app", "api", "intelligence", "site");
    expect(fs.existsSync(aggregateDir)).toBe(true);
  });
});

describe("Increment 8: checksum helper (evidence-checksum.ts) is pure", () => {
  const source = read(CHECKSUM_FILE);

  it("has no database, engine, or route import", () => {
    expect(source).not.toMatch(/from\s*["']node:sqlite["']/);
    expect(source).not.toMatch(/from\s*["']@\/lib\/db["']/);
    expect(source).not.toMatch(/from\s*["']@\/services\/evidence-center-engine["']/);
    expect(source).not.toMatch(/from\s*["']next\/server["']/);
  });

  it("has no Date.now(), Math.random(), or external package beyond node:crypto", () => {
    expect(source).not.toMatch(/Date\.now\(/);
    expect(source).not.toMatch(/Math\.random\(/);
    expect(source).not.toMatch(/new Date\(/);
    expect(source).toMatch(/from\s*["']node:crypto["']/);
  });
});

describe("Increment 8: Evidence Center outer adapter is isolated from pure translators", () => {
  const outerSource = read(OUTER_ADAPTER_FILE);
  const projectionSource = read(PROJECTION_ADAPTER_FILE);
  const checksumSource = read(CHECKSUM_FILE);

  it("the projection adapter never imports the outer adapter", () => {
    expect(projectionSource).not.toMatch(/evidence-center-read-adapter/);
  });

  it("the checksum helper never imports the outer adapter", () => {
    expect(checksumSource).not.toMatch(/evidence-center-read-adapter/);
  });

  it("the outer adapter never imports the checksum helper or the projection adapter", () => {
    expect(outerSource).not.toMatch(/evidence-checksum/);
    expect(outerSource).not.toMatch(/evidence-projection-adapter/);
  });
});

describe("Increment 8: minimal Evidence Orchestrator core stays DB-free", () => {
  const source = read(ORCHESTRATOR_CORE_FILE);

  it("has no value-level (non-type-only) import of any node:sqlite-touching module", () => {
    expect(source).not.toMatch(/^import\s*\{[^}]*\}\s*from\s*["']@\/services\/evidence-center-engine["']/m);
    expect(source).not.toMatch(/^import\s*\{[^}]*\}\s*from\s*["']@\/lib\/db["']/m);
    expect(source).not.toMatch(/^import\s*\{[^}]*\}\s*from\s*["']@\/services\/intelligence-adapters\/evidence-center-read-adapter["']/m);
  });

  it("imports evidence-center-read-adapter's type only via 'import type'", () => {
    expect(source).toMatch(/import\s+type\s*\{[^}]*LegacyEvidenceCenterReadResult[^}]*\}\s*from\s*["']@\/services\/intelligence-adapters\/evidence-center-read-adapter["']/);
  });

  it("has no Date.now(), Math.random(), or crypto.randomUUID() (determinism -- time/environment are injected)", () => {
    expect(source).not.toMatch(/Date\.now\(/);
    expect(source).not.toMatch(/Math\.random\(/);
    expect(source).not.toMatch(/crypto\.randomUUID\(/);
    expect(source).not.toMatch(/new Date\(/);
    expect(source).not.toMatch(/process\.env/);
  });

  it("performs no persistence, cache write, or audit-log write (no such dependency is even injectable)", () => {
    expect(source).not.toMatch(/\.run\(/);
    expect(source).not.toMatch(/recordAudit/);
    expect(source).not.toMatch(/INSERT|UPDATE|DELETE/);
  });

  it("never changes an engine manifest's status", () => {
    expect(source).not.toMatch(/status:\s*["']active["']/);
    expect(source).not.toMatch(/runtimeEngineRegistry/);
  });

  it("does not call adaptLegacyEvidenceList (the batch wrapper) -- calls adaptLegacyEvidence individually", () => {
    expect(source).not.toMatch(/adaptLegacyEvidenceList/);
    expect(source).toMatch(/deps\.adaptLegacyEvidence\(/);
  });
});

describe("Increment 8: pure Evidence Projection Adapter (evidence-projection-adapter.ts)", () => {
  const source = read(PROJECTION_ADAPTER_FILE);

  it("has no database, engine, or route import", () => {
    expect(source).not.toMatch(/from\s*["']node:sqlite["']/);
    expect(source).not.toMatch(/from\s*["']@\/lib\/db["']/);
    expect(source).not.toMatch(/from\s*["']@\/services\/evidence-center-engine["']/);
    expect(source).not.toMatch(/from\s*["']next\/server["']/);
    expect(source).not.toMatch(/evidenceCenterForSite/);
  });

  it("has no Date.now(), Math.random(), crypto.randomUUID(), or environment-variable read", () => {
    expect(source).not.toMatch(/Date\.now\(/);
    expect(source).not.toMatch(/Math\.random\(/);
    expect(source).not.toMatch(/crypto\.randomUUID\(/);
    expect(source).not.toMatch(/process\.env/);
  });

  it("the envelope declares no notFound field", () => {
    expect(source).not.toMatch(/notFound/);
  });
});

describe("Increment 8: canonical route (app/api/intelligence/evidence-center/site/route.ts)", () => {
  const source = read(ROUTE_FILE);

  it("imports requireAdminAuth from @/lib/auth-guard", () => {
    expect(source).toMatch(/import\s*\{[^}]*\brequireAdminAuth\b[^}]*\}\s*from\s*["']@\/lib\/auth-guard["']/);
  });

  it("never statically imports evidenceCenterForSite, @/lib/db, or the legacy Evidence Center engine at module top level", () => {
    expect(source).not.toMatch(/^import[^;]*from\s*["']@\/services\/evidence-center-engine["']/m);
    expect(source).not.toMatch(/^import[^;]*from\s*["']@\/lib\/db["']/m);
    expect(source).not.toMatch(/evidenceCenterForSite\(/);
  });

  it("references the Orchestrator via a dynamic import, not a static one", () => {
    expect(source).toMatch(/await\s+import\(\s*["']@\/services\/intelligence-runtime\/intelligence-evidence-orchestrator-instance["']\s*\)/);
    expect(source).not.toMatch(/^import[^;]*from\s*["']@\/services\/intelligence-runtime\/intelligence-evidence-orchestrator-instance["']/m);
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

  it("never imports a database helper directly", () => {
    expect(source).not.toMatch(/getWritableDb/);
    expect(source).not.toMatch(/\bgetDb\(/);
  });

  it("declares the Node runtime and dynamic rendering, matching this project's route convention", () => {
    expect(source).toContain('export const runtime = "nodejs"');
    expect(source).toContain('export const dynamic = "force-dynamic"');
  });

  it("exports only the Next.js-recognized route fields (runtime, dynamic, GET)", () => {
    const exportNames = [...source.matchAll(/^export\s+(?:const|async function|function)\s+(\w+)/gm)].map((m) => m[1]);
    expect(exportNames.sort()).toEqual(["GET", "dynamic", "runtime"].sort());
  });
});

describe("Increment 8: route handler (app/api/intelligence/evidence-center/site/handler.ts)", () => {
  const source = read(HANDLER_FILE);

  it("never statically imports evidenceCenterForSite, @/lib/db, or the Orchestrator wiring", () => {
    expect(source).not.toMatch(/^import[^;]*from\s*["']@\/services\/evidence-center-engine["']/m);
    expect(source).not.toMatch(/^import[^;]*from\s*["']@\/lib\/db["']/m);
    expect(source).not.toMatch(/^import[^;]*from\s*["']@\/services\/intelligence-runtime\/intelligence-evidence-orchestrator-instance["']/m);
    expect(source).not.toMatch(/evidenceCenterForSite\(/);
    expect(source).not.toMatch(/getWritableDb/);
    expect(source).not.toMatch(/\bgetDb\(/);
  });

  it("never leaks a stack trace or raw error message to the client", () => {
    expect(source).not.toMatch(/error\.message/);
    expect(source).not.toMatch(/error\.stack/);
  });

  it("no longer performs or references authentication", () => {
    expect(source).not.toMatch(/requireAdminAuth/);
    expect(source).not.toMatch(/\bauth\.authorized\b/);
    expect(source).not.toMatch(/from\s*["']@\/lib\/auth-guard["']/);
  });

  it("the envelope-producing function is never called for a notFound result -- 404 is returned before projection", () => {
    const notFoundIndex = source.indexOf("result.notFound");
    const projectionCallIndex = source.indexOf("projectCanonicalEvidenceResponse(result)");
    expect(notFoundIndex).toBeGreaterThan(-1);
    expect(projectionCallIndex).toBeGreaterThan(-1);
    expect(notFoundIndex).toBeLessThan(projectionCallIndex);
  });
});

describe("Increment 8: Increment 7's Data Trust route/handler are unchanged", () => {
  it("Data Trust route.ts still authenticates before its own dynamic import, unaffected by Increment 8", () => {
    const source = read(DATA_TRUST_ROUTE_FILE);
    expect(source).toMatch(/await\s+import\(\s*["']@\/services\/intelligence-runtime\/intelligence-orchestrator-instance["']\s*\)/);
  });

  it("Data Trust handler.ts still has no auth dependency, unaffected by Increment 8", () => {
    const source = read(DATA_TRUST_HANDLER_FILE);
    expect(source).not.toMatch(/requireAdminAuth/);
  });
});

describe("Increment 8: legacy routes are untouched", () => {
  it("app/api/evidence-center/site/route.ts still calls evidenceCenterForSite with persist=true, unchanged", () => {
    const source = fs.readFileSync(LEGACY_EVIDENCE_SITE_ROUTE, "utf8");
    expect(source).toMatch(/evidenceCenterForSite\(getWritableDb\(\),\s*id,\s*true\)/);
  });

  it("app/api/evidence-center/export/route.ts still calls evidenceCenterForSite with persist=true, unchanged", () => {
    const source = fs.readFileSync(LEGACY_EVIDENCE_EXPORT_ROUTE, "utf8");
    expect(source).toMatch(/evidenceCenterForSite\(db,\s*id,\s*true\)/);
  });

  it("app/api/copernicus/site/route.ts still calls copernicusForSite with persist=false, unchanged", () => {
    const source = fs.readFileSync(LEGACY_COPERNICUS_SITE_ROUTE, "utf8");
    expect(source).toMatch(/copernicusForSite\(getWritableDb\(\),\s*id,\s*undefined,\s*undefined,\s*false\)/);
  });
});

describe("Increment 8: runtime registry and manifests remain unchanged", () => {
  it("data-trust manifest remains 'planned'", () => {
    expect(runtimeEngineRegistry.getManifest("data-trust").status).toBe("planned");
  });

  it("recommendation manifest remains 'planned'", () => {
    expect(runtimeEngineRegistry.getManifest("recommendation").status).toBe("planned");
  });

  it("no engine is marked active", () => {
    expect(runtimeEngineRegistry.listManifestsByStatus("active")).toHaveLength(0);
  });

  it("no new EngineId was registered for Increment 8 (still exactly 3 manifests)", () => {
    expect(runtimeEngineRegistry.listManifests()).toHaveLength(3);
    expect(runtimeEngineRegistry.hasManifest("evidence")).toBe(false);
  });
});

describe("Increment 8: config/capabilities.json remains unchanged", () => {
  it("has no entry referencing the new canonical route or Increment 8 modules", () => {
    const raw = JSON.stringify(capabilities);
    expect(raw).not.toMatch(/intelligence\/evidence-center/);
    expect(raw).not.toMatch(/intelligence-evidence-orchestrator/);
  });
});

describe("Increment 8: no existing caller is migrated to the new canonical route", () => {
  const newRoutePath = "/api/intelligence/evidence-center/site";

  it("no file under components/** references the new canonical route", () => {
    const componentsDir = path.join(ROOT, "components");
    if (!fs.existsSync(componentsDir)) return;
    for (const file of walkTsFiles(componentsDir)) {
      const source = fs.readFileSync(file, "utf8");
      expect(source).not.toContain(newRoutePath);
    }
  });

  it("no other app/api/** route references the new canonical route", () => {
    const apiDir = path.join(ROOT, "app", "api");
    for (const file of walkTsFiles(apiDir, [path.join("intelligence", "evidence-center", "site")])) {
      const source = fs.readFileSync(file, "utf8");
      expect(source).not.toContain(newRoutePath);
    }
  });
});

describe("Increment 8: architecture documents exist", () => {
  it("ADR-020 exists", () => {
    expect(fs.existsSync(path.join(ROOT, "docs", "genesis-phase-2", "ADR_020_FINAL_INTELLIGENCE_API_ARCHITECTURE.md"))).toBe(true);
  });

  it("the Increment 8 implementation plan exists", () => {
    expect(fs.existsSync(path.join(ROOT, "docs", "genesis-phase-2", "26_INCREMENT_8_IMPLEMENTATION_PLAN.md"))).toBe(true);
  });

  it("the Increment 8 implementation document exists", () => {
    expect(fs.existsSync(path.join(ROOT, "docs", "genesis-phase-2", "25_INCREMENT_8_CANONICAL_EVIDENCE_PATH.md"))).toBe(true);
  });
});
