import { NextResponse } from "next/server";
import { getGraphStatus } from "@/sentinel-core/engine";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET() {
  return NextResponse.json(getGraphStatus());
}
