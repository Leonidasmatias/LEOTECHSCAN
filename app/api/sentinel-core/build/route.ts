import { NextRequest, NextResponse } from "next/server";
import { buildGraph } from "@/sentinel-core/engine";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  return NextResponse.json(buildGraph({ limit: Number(body.limit || 1000), reset: body.reset !== false }));
}
