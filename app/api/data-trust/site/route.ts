import { NextRequest, NextResponse } from "next/server";
import { getWritableDb } from "@/lib/db";
import { dataTrustForSite } from "@/services/data-trust-engine";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const id = Number(request.nextUrl.searchParams.get("id") || 0);
    const trust = dataTrustForSite(getWritableDb(), id, true);
    if (!trust) return NextResponse.json({ error: "Site nao encontrado." }, { status: 404 });
    return NextResponse.json(trust);
  } catch (error) {
    console.error("data_trust_site_failed", error instanceof Error ? error.message : "unknown");
    return NextResponse.json({ error: "Trust Score indisponivel." }, { status: 500 });
  }
}
