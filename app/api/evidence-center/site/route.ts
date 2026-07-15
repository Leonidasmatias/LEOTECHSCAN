import { NextRequest, NextResponse } from "next/server";
import { getWritableDb } from "@/lib/db";
import { evidenceCenterForSite } from "@/services/evidence-center-engine";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const id = Number(request.nextUrl.searchParams.get("id") || 0);
    const dossier = evidenceCenterForSite(getWritableDb(), id, true);
    if (!dossier) return NextResponse.json({ error: "Site nao encontrado." }, { status: 404 });
    return NextResponse.json(dossier);
  } catch (error) {
    console.error("evidence_center_site_failed", error instanceof Error ? error.message : "unknown");
    return NextResponse.json({ error: "Evidence Center indisponivel." }, { status: 500 });
  }
}
