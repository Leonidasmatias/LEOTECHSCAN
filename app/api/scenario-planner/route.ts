import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { scenarioPlanner } from "@/services/enterprise-v3-engine";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    return NextResponse.json(scenarioPlanner(getDb(), body));
  } catch (error) {
    console.error("scenario_planner_failed", error instanceof Error ? error.message : "unknown");
    return NextResponse.json({ error: "Scenario Planner indisponivel." }, { status: 500 });
  }
}
