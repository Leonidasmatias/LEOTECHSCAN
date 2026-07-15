import { NextRequest, NextResponse } from "next/server";
import { getSiteKnowledge } from "@/sentinel-core/engine";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(request: NextRequest) {
  const data = getSiteKnowledge(Number(request.nextUrl.searchParams.get("id") || 0));
  return data ? NextResponse.json(data) : NextResponse.json({ error: "Site nao encontrado." }, { status: 404 });
}
