import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { rolloutRows } from "@/services/rollout-engine";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const opportunities = rolloutRows(getDb()).slice(0, 100);
    return NextResponse.json({ opportunities, summary: { total: opportunities.length, top: opportunities[0] ?? null } });
  } catch (error) {
    console.error("opportunities_failed", error instanceof Error ? error.message : "unknown");
    return NextResponse.json({ error: "Oportunidades indisponiveis." }, { status: 500 });
  }
}
