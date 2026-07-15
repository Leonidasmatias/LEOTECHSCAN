import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { strategicPlanning } from "@/services/enterprise-v3-engine";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    return NextResponse.json(strategicPlanning(getDb(), body));
  } catch (error) {
    console.error("strategic_planning_failed", error instanceof Error ? error.message : "unknown");
    return NextResponse.json({ error: "Strategic Planning indisponivel." }, { status: 500 });
  }
}
