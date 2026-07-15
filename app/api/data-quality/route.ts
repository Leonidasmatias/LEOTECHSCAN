import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { dataQualitySnapshot } from "@/services/data-quality-engine";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return NextResponse.json(dataQualitySnapshot(getDb()));
  } catch (error) {
    console.error("data_quality_failed", error instanceof Error ? error.message : "unknown");
    return NextResponse.json({ error: "Qualidade cadastral indisponivel." }, { status: 500 });
  }
}
