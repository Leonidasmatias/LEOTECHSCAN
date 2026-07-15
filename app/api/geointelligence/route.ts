import { NextRequest, NextResponse } from "next/server";
import { getWritableDb } from "@/lib/db";
import { geointelligence } from "@/services/enterprise-v3-engine";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const siteId = Number(request.nextUrl.searchParams.get("siteId") || 0);
    const radiusKm = Number(request.nextUrl.searchParams.get("radiusKm") || 30);
    const gis = geointelligence(getWritableDb(), siteId, radiusKm);
    if (!gis) return NextResponse.json({ error: "Site nao encontrado." }, { status: 404 });
    return NextResponse.json(gis);
  } catch (error) {
    console.error("geointelligence_failed", error instanceof Error ? error.message : "unknown");
    return NextResponse.json({ error: "Advanced Geointelligence indisponivel." }, { status: 500 });
  }
}
