import { NextRequest, NextResponse } from "next/server";
import { searchKnowledge } from "@/sentinel-core/engine";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(request: NextRequest) {
  return NextResponse.json(searchKnowledge(request.nextUrl.searchParams.get("q") || ""));
}
