import { NextRequest, NextResponse } from "next/server";
import { getMunicipalityKnowledge } from "@/sentinel-core/engine";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(request: NextRequest) {
  return NextResponse.json(getMunicipalityKnowledge(request.nextUrl.searchParams.get("municipio") || "", request.nextUrl.searchParams.get("uf") || ""));
}
