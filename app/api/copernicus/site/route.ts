import { NextRequest, NextResponse } from "next/server";
import { getWritableDb } from "@/lib/db";
import { copernicusForSite } from "@/services/copernicus-engine";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const id = Number(request.nextUrl.searchParams.get("id") || 0);
    const result = copernicusForSite(getWritableDb(), id, undefined, undefined, false);
    if (!result) return NextResponse.json({ error: "Site nao encontrado." }, { status: 404 });
    return NextResponse.json(result);
  } catch (error) {
    console.error("copernicus_site_failed", error instanceof Error ? error.message : "unknown");
    return NextResponse.json({ error: "Copernicus Site Intelligence indisponivel." }, { status: 500 });
  }
}
