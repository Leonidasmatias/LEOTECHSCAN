import { NextRequest, NextResponse } from "next/server";
import { getOperatorKnowledge } from "@/sentinel-core/engine";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(request: NextRequest) {
  return NextResponse.json(getOperatorKnowledge(request.nextUrl.searchParams.get("operadora") || "TIM"));
}
