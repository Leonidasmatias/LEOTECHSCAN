import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { alertRows } from "@/services/alert-engine";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const alerts = alertRows(getDb());
    return NextResponse.json({ alerts, summary: { total: alerts.length, critical: alerts.filter((item) => item.criticidade === "Critica").length, high: alerts.filter((item) => item.criticidade === "Alta").length } });
  } catch (error) {
    console.error("alerts_failed", error instanceof Error ? error.message : "unknown");
    return NextResponse.json({ error: "Alert Center indisponivel." }, { status: 500 });
  }
}
