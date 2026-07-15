// STAGE 0 -- WP0.11 System Health Endpoint.
//
// Returns only safe, non-sensitive operational signals: whether the database is reachable,
// a handful of aggregate counts, the schema/import metadata already stored in the database's
// own metadata table, the app's own package version, and process uptime.
//
// Explicitly NEVER included, by design: credentials, tokens, connection strings, environment
// variables of any kind, full filesystem paths, user/account names, or any per-row data. If a
// future change to this file would add one of those, that change is out of scope for what this
// endpoint is for -- see docs/stage-0/06_BUILD_VALIDATION.md / 08_REMAINING_RISKS.md for why
// this boundary matters (this endpoint is reachable without authentication, per audit-v4 risk
// R2, which Stage 0 did not close).
import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import capabilitiesRegistry from "@/config/capabilities.json";
import packageJson from "@/package.json";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type CapabilityStatus = "operational" | "partial" | "simulated" | "disabled" | "planned" | "unavailable";

function capabilitiesSummary() {
  const entries = (capabilitiesRegistry as { capabilities: Array<{ status: CapabilityStatus }> }).capabilities;
  const summary: Record<CapabilityStatus, number> = {
    operational: 0,
    partial: 0,
    simulated: 0,
    disabled: 0,
    planned: 0,
    unavailable: 0,
  };
  for (const entry of entries) {
    if (entry.status in summary) summary[entry.status] += 1;
  }
  return { total: entries.length, byStatus: summary };
}

export async function GET() {
  const timestamp = new Date().toISOString();
  const base = {
    timestamp,
    appVersion: packageJson.version,
    uptimeSeconds: Math.round(process.uptime()),
    capabilities: capabilitiesSummary(),
  };

  try {
    const db = getDb();
    const tableCount = (db.prepare("SELECT COUNT(*) AS n FROM sqlite_master WHERE type='table'").get() as { n: number }).n;
    const journalMode = (db.prepare("PRAGMA journal_mode").get() as { journal_mode: string }).journal_mode;

    let sitesRowCount: number | null = null;
    let schemaVersion: string | null = null;
    let lastImportedAt: string | null = null;
    try {
      sitesRowCount = (db.prepare("SELECT COUNT(*) AS n FROM sites").get() as { n: number }).n;
    } catch {
      sitesRowCount = null; // table may not exist yet on a fresh/empty database -- not an error condition
    }
    try {
      const rows = db.prepare("SELECT key, value FROM metadata WHERE key IN ('schema_version','imported_at')").all() as Array<{ key: string; value: string }>;
      for (const row of rows) {
        if (row.key === "schema_version") schemaVersion = row.value;
        if (row.key === "imported_at") lastImportedAt = row.value;
      }
    } catch {
      // metadata table may not exist yet -- leave both fields null, not an error condition
    }

    return NextResponse.json({
      status: "ok",
      ...base,
      database: {
        reachable: true,
        journalMode,
        tableCount,
        sitesRowCount,
        schemaVersion,
        lastImportedAt,
      },
    });
  } catch (error) {
    // Deliberately do not forward error.message or any stack trace -- both can contain absolute
    // filesystem paths (e.g. the SQLite driver's own error strings include the DB file path).
    console.error("system_health_db_check_failed", error instanceof Error ? error.name : "unknown");
    return NextResponse.json(
      {
        status: "degraded",
        ...base,
        database: { reachable: false },
      },
      { status: 503 },
    );
  }
}
