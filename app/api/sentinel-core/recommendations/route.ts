import { NextRequest, NextResponse } from "next/server";
import { getRecommendationsForScope } from "@/sentinel-core/engine";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(request: NextRequest) {
  return NextResponse.json(getRecommendationsForScope(request.nextUrl.searchParams.get("scope") || "global"));
}
