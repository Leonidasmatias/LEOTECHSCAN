import { NextRequest, NextResponse } from "next/server";
import { getWritableDb } from "@/lib/db";
import { geointelligence } from "@/services/enterprise-v3-engine";
import { clampQueryNumber } from "@/lib/request-guard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const siteId = clampQueryNumber(request.nextUrl.searchParams.get("siteId"), { min: 0, max: 100_000_000, fallback: 0 });
    // WP0.7: radiusKm was previously unbounded -- a huge value forced an unbounded-cost
    // bounding-box scan. Clamped to a generous but finite operational range.
    const radiusKm = clampQueryNumber(request.nextUrl.searchParams.get("radiusKm"), { min: 0.1, max: 500, fallback: 30 });
    const gis = geointelligence(getWritableDb(), siteId, radiusKm);
    if (!gis) return NextResponse.json({ error: "Site nao encontrado." }, { status: 404 });
    return NextResponse.json(gis);
  } catch (error) {
    console.error("geointelligence_failed", error instanceof Error ? error.message : "unknown");
    return NextResponse.json({ error: "Advanced Geointelligence indisponivel." }, { status: 500 });
  }
}
