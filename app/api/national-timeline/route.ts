import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { nationalTimeline } from "@/services/national-timeline-engine";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return NextResponse.json(nationalTimeline(getDb()));
  } catch (error) {
    console.error("national_timeline_failed", error instanceof Error ? error.message : "unknown");
    return NextResponse.json({ error: "Timeline nacional indisponivel." }, { status: 500 });
  }
}
