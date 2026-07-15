import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { rolloutRows } from "@/services/rollout-engine";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const rows = rolloutRows(getDb());
    return NextResponse.json({ national: rows.slice(0, 100), state: rows.slice(0, 100), municipal: rows.slice(0, 100), summary: { total: rows.length, veryHigh: rows.filter((row) => row.prioridade === "Muito Alta").length } });
  } catch (error) {
    console.error("rollout_failed", error instanceof Error ? error.message : "unknown");
    return NextResponse.json({ error: "Rollout Intelligence indisponivel." }, { status: 500 });
  }
}
