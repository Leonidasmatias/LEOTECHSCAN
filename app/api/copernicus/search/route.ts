import { NextRequest, NextResponse } from "next/server";
import { getWritableDb } from "@/lib/db";
import { copernicusForSite } from "@/services/copernicus-engine";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const siteId = Number(request.nextUrl.searchParams.get("siteId") || 0);
    const radiusKm = Number(request.nextUrl.searchParams.get("radiusKm") || 2);
    const lookbackDays = Number(request.nextUrl.searchParams.get("lookbackDays") || 90);
    const result = copernicusForSite(getWritableDb(), siteId, radiusKm, lookbackDays, true);
    if (!result) return NextResponse.json({ error: "Site nao encontrado." }, { status: 404 });
    return NextResponse.json(result);
  } catch (error) {
    console.error("copernicus_search_failed", error instanceof Error ? error.message : "unknown");
    return NextResponse.json({ error: "Busca Copernicus indisponivel." }, { status: 500 });
  }
}
