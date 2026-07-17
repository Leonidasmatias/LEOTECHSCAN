// GENESIS PHASE 2 -- Increment 7 (Canonical Read-Only Data Trust Path).
// Dependency-boundary and architectural contract tests via source inspection,
// following the established pattern (tests/intelligence-recommendation-adapter-contract.test.ts):
// comments are stripped before matching so prose citing a forbidden import path as
// evidence for NOT importing it cannot false-positive.
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { runtimeEngineRegistry } from "@/services/intelligence-runtime";
import capabilities from "@/config/capabilities.json";

const ROOT = path.resolve(__dirname, "..");
const OUTER_ADAPTER_FILE = path.join(ROOT, "services", "intelligence-adapters", "data-trust-read-adapter.ts");
const ORCHESTRATOR_CORE_FILE = path.join(ROOT, "services", "intelligence-runtime", "intelligence-orchestrator.ts");
const ORCHESTRATOR_INSTANCE_FILE = path.join(ROOT, "services", "intelligence-runtime", "intelligence-orchestrator-instance.ts");
const PROJECTION_ADAPTER_FILE = path.join(ROOT, "services", "intelligence-adapters", "api-projection-adapter.ts");
const ROUTE_FILE = path.join(ROOT, "app", "api", "intelligence", "data-trust", "site", "route.ts");
const HANDLER_FILE = path.join(ROOT, "app", "api", "intelligence", "data-trust", "site", "handler.ts");
const LEGACY_ROUTE_FILE = path.join(ROOT, "app", "api", "data-trust", "site", "route.ts");

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

describe("Increment 7: Data Trust outer adapter (data-trust-read-adapter.ts)", () => {
  const source = read(OUTER_ADAPTER_FILE);

  it("calls dataTrustForSite with a literal false persist argument, never omitted or true", () => {
    expect(source).toMatch(/dataTrustForSite\(\s*db\s*,\s*siteId\s*,\s*false\s*\)/);
    expect(source).not.toMatch(/dataTrustForSite\(\s*db\s*,\s*siteId\s*\)/);
    expect(source).not.toMatch(/dataTrustForSite\([^)]*,\s*true\s*\)/);
  });

  it("imports dataTrustForSite and getWritableDb (not getDb)", () => {
    expect(source).toMatch(/from\s*["']@\/services\/data-trust-engine["']/);
    expect(source).toMatch(/import\s*\{\s*getWritableDb\s*\}\s*from\s*["']@\/lib\/db["']/);
    expect(source).not.toMatch(/\bgetDb\(/);
  });

  it("performs no canonical translation (no toIdentifier/Score/Recommendation construction)", () => {
    expect(source).not.toMatch(/toIdentifier/);
    expect(source).not.toMatch(/kind:\s*["']Score["']/);
    expect(source).not.toMatch(/kind:\s*["']Recommendation["']/);
  });

  it("performs no HTTP projection and imports no route/Next.js code", () => {
    expect(source).not.toMatch(/from\s*["']next\/server["']/);
    expect(source).not.toMatch(/NextResponse/);
  });

  it("never writes (no INSERT/recordAudit call of its own)", () => {
    expect(source).not.toMatch(/\.run\(/);
    expect(source).not.toMatch(/recordAudit/);
  });
});

describe("Increment 7: minimal Orchestrator core (intelligence-orchestrator.ts) stays DB-free", () => {
  const source = read(ORCHESTRATOR_CORE_FILE);

  it("has no value-level (non-type-only) import of any node:sqlite-touching module", () => {
    expect(source).not.toMatch(/^import\s*\{[^}]*\}\s*from\s*["']@\/services\/data-trust-engine["']/m);
    expect(source).not.toMatch(/^import\s*\{[^}]*\}\s*from\s*["']@\/lib\/db["']/m);
    expect(source).not.toMatch(/^import\s*\{[^}]*\}\s*from\s*["']@\/services\/intelligence-adapters\/data-trust-read-adapter["']/m);
  });

  it("imports data-trust-read-adapter's type only via 'import type'", () => {
    expect(source).toMatch(/import\s+type\s*\{[^}]*LegacyDataTrustReadResult[^}]*\}\s*from\s*["']@\/services\/intelligence-adapters\/data-trust-read-adapter["']/);
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
});

describe("Increment 7: pure API Projection Adapter (api-projection-adapter.ts)", () => {
  const source = read(PROJECTION_ADAPTER_FILE);

  it("has no database, engine, or route import", () => {
    expect(source).not.toMatch(/from\s*["']node:sqlite["']/);
    expect(source).not.toMatch(/from\s*["']@\/lib\/db["']/);
    expect(source).not.toMatch(/from\s*["']@\/services\/data-trust-engine["']/);
    expect(source).not.toMatch(/from\s*["']next\/server["']/);
    expect(source).not.toMatch(/dataTrustForSite/);
  });

  it("has no Date.now(), Math.random(), crypto.randomUUID(), or environment-variable read", () => {
    expect(source).not.toMatch(/Date\.now\(/);
    expect(source).not.toMatch(/Math\.random\(/);
    expect(source).not.toMatch(/crypto\.randomUUID\(/);
    expect(source).not.toMatch(/process\.env/);
  });

  it("post-audit fix: the envelope no longer declares a notFound field", () => {
    expect(source).not.toMatch(/notFound/);
  });
});

describe("Increment 7: canonical route (app/api/intelligence/data-trust/site/route.ts)", () => {
  const source = read(ROUTE_FILE);

  it("imports requireAdminAuth from @/lib/auth-guard", () => {
    expect(source).toMatch(/import\s*\{[^}]*\brequireAdminAuth\b[^}]*\}\s*from\s*["']@\/lib\/auth-guard["']/);
  });

  it("never statically imports dataTrustForSite, @/lib/db, or the legacy data-trust engine at module top level", () => {
    expect(source).not.toMatch(/^import[^;]*from\s*["']@\/services\/data-trust-engine["']/m);
    expect(source).not.toMatch(/^import[^;]*from\s*["']@\/lib\/db["']/m);
    expect(source).not.toMatch(/dataTrustForSite\(/);
  });

  it("references the Orchestrator via a dynamic import, not a static one", () => {
    expect(source).toMatch(/await\s+import\(\s*["']@\/services\/intelligence-runtime\/intelligence-orchestrator-instance["']\s*\)/);
    expect(source).not.toMatch(/^import[^;]*from\s*["']@\/services\/intelligence-runtime\/intelligence-orchestrator-instance["']/m);
  });

  it("post-audit fix: authentication is checked and returns on failure strictly before the dynamic import is reached", () => {
    const authCallIndex = source.indexOf("requireAdminAuth(request)");
    const authReturnIndex = source.indexOf("if (!auth.authorized) return auth.response;");
    const dynamicImportIndex = source.indexOf('await import(');
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

  it("exports only the Next.js-recognized route fields (runtime, dynamic, GET) -- no extra named export, matching the App Router route-type checker's requirement", () => {
    const exportNames = [...source.matchAll(/^export\s+(?:const|async function|function)\s+(\w+)/gm)].map((m) => m[1]);
    expect(exportNames.sort()).toEqual(["GET", "dynamic", "runtime"].sort());
  });
});

describe("Increment 7: route handler (app/api/intelligence/data-trust/site/handler.ts)", () => {
  const source = read(HANDLER_FILE);

  it("never statically imports dataTrustForSite, @/lib/db, or the Orchestrator wiring", () => {
    expect(source).not.toMatch(/^import[^;]*from\s*["']@\/services\/data-trust-engine["']/m);
    expect(source).not.toMatch(/^import[^;]*from\s*["']@\/lib\/db["']/m);
    expect(source).not.toMatch(/^import[^;]*from\s*["']@\/services\/intelligence-runtime\/intelligence-orchestrator-instance["']/m);
    expect(source).not.toMatch(/dataTrustForSite\(/);
    expect(source).not.toMatch(/getWritableDb/);
    expect(source).not.toMatch(/\bgetDb\(/);
  });

  it("never leaks a stack trace or raw error message to the client", () => {
    expect(source).not.toMatch(/error\.message/);
    expect(source).not.toMatch(/error\.stack/);
  });

  it("post-audit fix: no longer performs or references authentication -- that is route.ts's job, checked before this handler is ever invoked", () => {
    expect(source).not.toMatch(/requireAdminAuth/);
    expect(source).not.toMatch(/\bauth\.authorized\b/);
    expect(source).not.toMatch(/from\s*["']@\/lib\/auth-guard["']/);
  });

  it("the envelope-producing function is never called for a notFound result -- 404 is returned before projection", () => {
    const notFoundIndex = source.indexOf("result.notFound");
    const projectionCallIndex = source.indexOf("projectCanonicalDataTrustResponse(result)");
    expect(notFoundIndex).toBeGreaterThan(-1);
    expect(projectionCallIndex).toBeGreaterThan(-1);
    expect(notFoundIndex).toBeLessThan(projectionCallIndex);
  });
});

describe("Increment 7: legacy route is untouched", () => {
  it("app/api/data-trust/site/route.ts still calls dataTrustForSite with persist=true, unchanged", () => {
    const source = fs.readFileSync(LEGACY_ROUTE_FILE, "utf8");
    expect(source).toMatch(/dataTrustForSite\(getWritableDb\(\),\s*id,\s*true\)/);
  });
});

describe("Increment 7: runtime registry and manifests remain unchanged", () => {
  it("data-trust manifest remains 'planned'", () => {
    expect(runtimeEngineRegistry.getManifest("data-trust").status).toBe("planned");
  });

  it("recommendation manifest remains 'planned'", () => {
    expect(runtimeEngineRegistry.getManifest("recommendation").status).toBe("planned");
  });

  it("no engine is marked active", () => {
    expect(runtimeEngineRegistry.listManifestsByStatus("active")).toHaveLength(0);
  });

  it("no new EngineId was registered for Increment 7", () => {
    expect(runtimeEngineRegistry.listManifests()).toHaveLength(3);
  });
});

describe("Increment 7: config/capabilities.json remains unchanged", () => {
  it("has no entry referencing the new canonical route or Increment 7 modules", () => {
    const raw = JSON.stringify(capabilities);
    expect(raw).not.toMatch(/intelligence\/data-trust/);
    expect(raw).not.toMatch(/intelligence-orchestrator/);
  });
});

describe("Increment 7: no existing caller is migrated to the new canonical route", () => {
  const newRoutePath = "/api/intelligence/data-trust/site";

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
    for (const file of walkTsFiles(apiDir, [path.join("intelligence", "data-trust", "site")])) {
      const source = fs.readFileSync(file, "utf8");
      expect(source).not.toContain(newRoutePath);
    }
  });
});
