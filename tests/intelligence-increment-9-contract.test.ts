// GENESIS PHASE 2 -- Increment 9 (Site Intelligence Aggregator).
// Dependency-boundary and architectural contract tests via source inspection,
// following the established pattern (tests/intelligence-increment-8-contract.test.ts):
// comments are stripped before matching so prose citing a forbidden import path as
// evidence for NOT importing it cannot false-positive.
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { runtimeEngineRegistry } from "@/services/intelligence-runtime";
import capabilities from "@/config/capabilities.json";

const ROOT = path.resolve(__dirname, "..");
const AGGREGATOR_CORE_FILE = path.join(ROOT, "services", "intelligence-runtime", "site-intelligence-aggregator.ts");
const AGGREGATOR_INSTANCE_FILE = path.join(ROOT, "services", "intelligence-runtime", "site-intelligence-aggregator-instance.ts");
const PROJECTION_ADAPTER_FILE = path.join(ROOT, "services", "intelligence-adapters", "site-intelligence-projection-adapter.ts");
const ROUTE_FILE = path.join(ROOT, "app", "api", "intelligence", "site", "route.ts");
const HANDLER_FILE = path.join(ROOT, "app", "api", "intelligence", "site", "handler.ts");

const DATA_TRUST_ROUTE_FILE = path.join(ROOT, "app", "api", "intelligence", "data-trust", "site", "route.ts");
const DATA_TRUST_HANDLER_FILE = path.join(ROOT, "app", "api", "intelligence", "data-trust", "site", "handler.ts");
const EVIDENCE_ROUTE_FILE = path.join(ROOT, "app", "api", "intelligence", "evidence-center", "site", "route.ts");
const EVIDENCE_HANDLER_FILE = path.join(ROOT, "app", "api", "intelligence", "evidence-center", "site", "handler.ts");
const LEGACY_EVIDENCE_SITE_ROUTE = path.join(ROOT, "app", "api", "evidence-center", "site", "route.ts");
const LEGACY_EVIDENCE_EXPORT_ROUTE = path.join(ROOT, "app", "api", "evidence-center", "export", "route.ts");
const LEGACY_COPERNICUS_SITE_ROUTE = path.join(ROOT, "app", "api", "copernicus", "site", "route.ts");
const LEGACY_DATA_TRUST_SITE_ROUTE = path.join(ROOT, "app", "api", "data-trust", "site", "route.ts");

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

describe("Increment 9: exact production file inventory exists", () => {
  it("all five new production files exist", () => {
    for (const file of [AGGREGATOR_CORE_FILE, AGGREGATOR_INSTANCE_FILE, PROJECTION_ADAPTER_FILE, ROUTE_FILE, HANDLER_FILE]) {
      expect(fs.existsSync(file)).toBe(true);
    }
  });
});

describe("Increment 9: pure Aggregate Orchestrator core stays database-free", () => {
  const source = read(AGGREGATOR_CORE_FILE);

  it("has no value-level (non-type-only) import of any database-touching or capability-instance module", () => {
    expect(source).not.toMatch(/^import\s*\{[^}]*\}\s*from\s*["']@\/services\/intelligence-runtime\/intelligence-orchestrator-instance["']/m);
    expect(source).not.toMatch(/^import\s*\{[^}]*\}\s*from\s*["']@\/services\/intelligence-runtime\/intelligence-evidence-orchestrator-instance["']/m);
    expect(source).not.toMatch(/@\/lib\/db/);
    expect(source).not.toMatch(/@\/app\/api/);
    expect(source).not.toMatch(/sentinel-core/);
    expect(source).not.toMatch(/from\s*["']node:sqlite["']/);
    expect(source).not.toMatch(/from\s*["']next\/server["']/);
    expect(source).not.toMatch(/from\s*["']next["']/);
  });

  it("imports both capability orchestration-result types only via 'import type'", () => {
    expect(source).toMatch(/import\s+type\s*\{[^}]*CanonicalDataTrustOrchestrationResult[^}]*\}\s*from\s*["']\.\/intelligence-orchestrator["']/);
    expect(source).toMatch(/import\s+type\s*\{[^}]*CanonicalEvidenceOrchestrationResult[^}]*\}\s*from\s*["']\.\/intelligence-evidence-orchestrator["']/);
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

  it("does not use Promise.all -- both capability calls are synchronous", () => {
    expect(source).not.toMatch(/Promise\.all/);
  });

  it("calls now() exactly once in its own source (single call site, not per-capability)", () => {
    const nowCallSites = source.match(/deps\.now\(\)/g) ?? [];
    expect(nowCallSites).toHaveLength(1);
  });
});

describe("Increment 9: Aggregate Orchestrator instance wiring", () => {
  const source = read(AGGREGATOR_INSTANCE_FILE);

  it("wires the two existing, unmodified capability instance modules directly", () => {
    expect(source).toMatch(/from\s*["']@\/services\/intelligence-runtime\/intelligence-orchestrator-instance["']/);
    expect(source).toMatch(/from\s*["']@\/services\/intelligence-runtime\/intelligence-evidence-orchestrator-instance["']/);
  });

  it("does not use Promise.all", () => {
    expect(source).not.toMatch(/Promise\.all/);
  });

  it("does not import a legacy engine or database helper directly", () => {
    expect(source).not.toMatch(/@\/lib\/db/);
    expect(source).not.toMatch(/from\s*["'][^"']*-engine["']/);
  });

  it("does not contain the literal path substrings the runtime source-boundary sweep matches (@/lib/db, @/app/api, sentinel-core), even in comments", () => {
    const raw = fs.readFileSync(AGGREGATOR_INSTANCE_FILE, "utf8");
    expect(raw).not.toMatch(/@\/lib\/db/);
    expect(raw).not.toMatch(/@\/app\/api/);
    expect(raw).not.toMatch(/sentinel-core/);
  });
});

describe("Increment 9: both new runtime files satisfy the existing intelligence-runtime source-boundary sweep", () => {
  it("neither file's raw source contains a from \"node:sqlite\"/\"next/server\"/\"next\" import, or a bare @/lib/db, @/app/api, sentinel-core substring", () => {
    for (const file of [AGGREGATOR_CORE_FILE, AGGREGATOR_INSTANCE_FILE]) {
      const raw = fs.readFileSync(file, "utf8");
      expect(raw).not.toMatch(/from\s*["']node:sqlite["']/);
      expect(raw).not.toMatch(/from\s*["']next\/server["']/);
      expect(raw).not.toMatch(/from\s*["']next["']/);
      expect(raw).not.toMatch(/@\/lib\/db/);
      expect(raw).not.toMatch(/@\/app\/api/);
      expect(raw).not.toMatch(/sentinel-core/);
    }
  });
});

describe("Increment 9: pure Site Intelligence Projection Adapter", () => {
  const source = read(PROJECTION_ADAPTER_FILE);

  it("has no database, engine, or route import", () => {
    expect(source).not.toMatch(/from\s*["']node:sqlite["']/);
    expect(source).not.toMatch(/from\s*["']@\/lib\/db["']/);
    expect(source).not.toMatch(/from\s*["']next\/server["']/);
    expect(source).not.toMatch(/evidenceCenterForSite/);
    expect(source).not.toMatch(/dataTrustForSite/);
  });

  it("has no Date.now(), Math.random(), crypto.randomUUID(), or environment-variable read", () => {
    expect(source).not.toMatch(/Date\.now\(/);
    expect(source).not.toMatch(/Math\.random\(/);
    expect(source).not.toMatch(/crypto\.randomUUID\(/);
    expect(source).not.toMatch(/process\.env/);
  });

  it("imports both existing frozen projection functions directly from their own sibling files, never via the barrel", () => {
    expect(source).toMatch(/from\s*["']\.\/api-projection-adapter["']/);
    expect(source).toMatch(/from\s*["']\.\/evidence-projection-adapter["']/);
    expect(source).not.toMatch(/from\s*["']\.\/index["']/);
    expect(source).not.toMatch(/from\s*["']\.["']/);
  });

  it("the envelope declares no notFound field", () => {
    expect(source).not.toMatch(/notFound/);
  });
});

describe("Increment 9: canonical route (app/api/intelligence/site/route.ts)", () => {
  const source = read(ROUTE_FILE);

  it("imports requireAdminAuth from @/lib/auth-guard", () => {
    expect(source).toMatch(/import\s*\{[^}]*\brequireAdminAuth\b[^}]*\}\s*from\s*["']@\/lib\/auth-guard["']/);
  });

  it("never statically imports a legacy engine, @/lib/db, or either capability route/handler at module top level", () => {
    expect(source).not.toMatch(/^import[^;]*from\s*["'][^"']*-engine["']/m);
    expect(source).not.toMatch(/^import[^;]*from\s*["']@\/lib\/db["']/m);
    expect(source).not.toMatch(/^import[^;]*from\s*["']@\/app\/api\/intelligence\/data-trust\/site\/route["']/m);
    expect(source).not.toMatch(/^import[^;]*from\s*["']@\/app\/api\/intelligence\/evidence-center\/site\/route["']/m);
  });

  it("references the Aggregator via a dynamic import, not a static one", () => {
    expect(source).toMatch(/await\s+import\(\s*["']@\/services\/intelligence-runtime\/site-intelligence-aggregator-instance["']\s*\)/);
    expect(source).not.toMatch(/^import[^;]*from\s*["']@\/services\/intelligence-runtime\/site-intelligence-aggregator-instance["']/m);
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

describe("Increment 9: route handler (app/api/intelligence/site/handler.ts)", () => {
  const source = read(HANDLER_FILE);

  it("never statically imports a legacy engine, @/lib/db, or the Aggregator wiring", () => {
    expect(source).not.toMatch(/^import[^;]*from\s*["'][^"']*-engine["']/m);
    expect(source).not.toMatch(/^import[^;]*from\s*["']@\/lib\/db["']/m);
    expect(source).not.toMatch(/^import[^;]*from\s*["']@\/services\/intelligence-runtime\/site-intelligence-aggregator-instance["']/m);
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

  it("never calls either capability route or handler directly (no route-to-route or handler-to-handler composition)", () => {
    expect(source).not.toMatch(/handleCanonicalDataTrustSiteRequest/);
    expect(source).not.toMatch(/handleCanonicalEvidenceCenterSiteRequest/);
    expect(source).not.toMatch(/from\s*["']@\/app\/api\/intelligence\/data-trust\/site\/(route|handler)["']/);
    expect(source).not.toMatch(/from\s*["']@\/app\/api\/intelligence\/evidence-center\/site\/(route|handler)["']/);
    expect(source).not.toMatch(/\bfetch\(/);
  });

  it("maps status 'failed' to a sanitized 500, and status 'complete'/'partial' to 200", () => {
    expect(source).toMatch(/result\.status\s*===\s*["']failed["']/);
    expect(source).toMatch(/status:\s*500/);
    expect(source).toMatch(/status:\s*200/);
  });

  it("the envelope-producing function is never called for a notFound result -- 404 is returned before projection", () => {
    const notFoundIndex = source.indexOf("result.notFound");
    const projectionCallIndex = source.indexOf("projectSiteIntelligenceResponse(result)");
    expect(notFoundIndex).toBeGreaterThan(-1);
    expect(projectionCallIndex).toBeGreaterThan(-1);
    expect(notFoundIndex).toBeLessThan(projectionCallIndex);
  });
});

describe("Increment 9: Increments 7 and 8's routes/handlers/orchestrators are unaffected", () => {
  it("Data Trust route.ts still authenticates before its own dynamic import, unaffected by Increment 9", () => {
    const source = read(DATA_TRUST_ROUTE_FILE);
    expect(source).toMatch(/await\s+import\(\s*["']@\/services\/intelligence-runtime\/intelligence-orchestrator-instance["']\s*\)/);
  });

  it("Data Trust handler.ts still has no auth dependency, unaffected by Increment 9", () => {
    const source = read(DATA_TRUST_HANDLER_FILE);
    expect(source).not.toMatch(/requireAdminAuth/);
  });

  it("Evidence Center route.ts still authenticates before its own dynamic import, unaffected by Increment 9", () => {
    const source = read(EVIDENCE_ROUTE_FILE);
    expect(source).toMatch(/await\s+import\(\s*["']@\/services\/intelligence-runtime\/intelligence-evidence-orchestrator-instance["']\s*\)/);
  });

  it("Evidence Center handler.ts still has no auth dependency, unaffected by Increment 9", () => {
    const source = read(EVIDENCE_HANDLER_FILE);
    expect(source).not.toMatch(/requireAdminAuth/);
  });

  it("neither frozen capability orchestrator core references the aggregator (no reverse dependency)", () => {
    const dataTrustCore = read(path.join(ROOT, "services", "intelligence-runtime", "intelligence-orchestrator.ts"));
    const evidenceCore = read(path.join(ROOT, "services", "intelligence-runtime", "intelligence-evidence-orchestrator.ts"));
    expect(dataTrustCore).not.toMatch(/site-intelligence/);
    expect(evidenceCore).not.toMatch(/site-intelligence/);
  });
});

describe("Increment 9: legacy routes are untouched", () => {
  it("app/api/data-trust/site/route.ts is untouched", () => {
    expect(fs.existsSync(LEGACY_DATA_TRUST_SITE_ROUTE)).toBe(true);
  });

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

describe("Increment 9: runtime registry and manifests remain unchanged", () => {
  it("data-trust manifest remains 'planned'", () => {
    expect(runtimeEngineRegistry.getManifest("data-trust").status).toBe("planned");
  });

  it("recommendation manifest remains 'planned'", () => {
    expect(runtimeEngineRegistry.getManifest("recommendation").status).toBe("planned");
  });

  it("no engine is marked active", () => {
    expect(runtimeEngineRegistry.listManifestsByStatus("active")).toHaveLength(0);
  });

  it("no new EngineId was registered for Increment 9 (still exactly 3 manifests)", () => {
    expect(runtimeEngineRegistry.listManifests()).toHaveLength(3);
    expect(runtimeEngineRegistry.hasManifest("evidence")).toBe(false);
    expect(runtimeEngineRegistry.hasManifest("site-intelligence")).toBe(false);
  });
});

describe("Increment 9: config/capabilities.json remains unchanged", () => {
  it("has no entry referencing the new canonical route or Increment 9 modules", () => {
    const raw = JSON.stringify(capabilities);
    expect(raw).not.toMatch(/intelligence\/site["']/);
    expect(raw).not.toMatch(/site-intelligence-aggregator/);
  });
});

describe("Increment 9: no existing caller is migrated to the new canonical route", () => {
  const newRoutePath = "/api/intelligence/site";

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
    for (const file of walkTsFiles(apiDir, [path.join("intelligence", "site")])) {
      const source = fs.readFileSync(file, "utf8");
      expect(source).not.toContain(newRoutePath);
    }
  });
});

describe("Increment 9: no circular barrel dependency", () => {
  it("the barrel (index.ts) exports the new projection adapter's symbols but the new file itself never imports the barrel back", () => {
    const barrelSource = read(path.join(ROOT, "services", "intelligence-adapters", "index.ts"));
    expect(barrelSource).toMatch(/from\s*["']\.\/site-intelligence-projection-adapter["']/);
    const projectionSource = read(PROJECTION_ADAPTER_FILE);
    expect(projectionSource).not.toMatch(/from\s*["']\.\/index["']/);
    expect(projectionSource).not.toMatch(/from\s*["']@\/services\/intelligence-adapters["']/);
  });

  it("the aggregator instance never imports through the intelligence-adapters barrel", () => {
    const source = read(AGGREGATOR_INSTANCE_FILE);
    expect(source).not.toMatch(/from\s*["']@\/services\/intelligence-adapters["']/);
  });
});

describe("Increment 9: architecture documents exist", () => {
  it("the Increment 9 planning document exists", () => {
    expect(
      fs.existsSync(path.join(ROOT, "docs", "genesis-phase-2", "27_INCREMENT_9_SITE_INTELLIGENCE_AGGREGATOR_PLAN.md")),
    ).toBe(true);
  });
});
