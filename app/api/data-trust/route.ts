import { NextResponse } from "next/server";
import { getWritableDb } from "@/lib/db";
import { dataTrustDashboard } from "@/services/data-trust-engine";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return NextResponse.json(dataTrustDashboard(getWritableDb()));
  } catch (error) {
    console.error("data_trust_dashboard_failed", error instanceof Error ? error.message : "unknown");
    return NextResponse.json({ error: "Data Trust indisponivel." }, { status: 500 });
  }
}
