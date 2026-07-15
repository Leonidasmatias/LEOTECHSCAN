import { NextRequest, NextResponse } from "next/server";
import { getWritableDb } from "@/lib/db";
import { digitalTwinSite } from "@/services/enterprise-v3-engine";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const id = Number(request.nextUrl.searchParams.get("id") || 0);
    const twin = digitalTwinSite(getWritableDb(), id);
    if (!twin) return NextResponse.json({ error: "Site nao encontrado." }, { status: 404 });
    return NextResponse.json(twin);
  } catch (error) {
    console.error("digital_twin_failed", error instanceof Error ? error.message : "unknown");
    return NextResponse.json({ error: "Digital Twin indisponivel." }, { status: 500 });
  }
}
