import { NextResponse } from "next/server";
import { getWritableDb } from "@/lib/db";
import { copernicusStatus } from "@/services/copernicus-engine";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return NextResponse.json(copernicusStatus(getWritableDb()));
  } catch (error) {
    console.error("copernicus_status_failed", error instanceof Error ? error.message : "unknown");
    return NextResponse.json({ error: "Status Copernicus indisponivel." }, { status: 500 });
  }
}
